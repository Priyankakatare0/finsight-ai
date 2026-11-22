import mongoose, { type Types } from "mongoose";
import { DocumentModel } from "../../models/Document.model";
import { generateSmallCompletion } from "../generation/llm.provider";
import type { RetrievalFilters } from "./retriever";

export interface DetectedQueryMetadata {
  company: string | null;
  fiscalYear: number | null;
}

const METADATA_DETECTION_SYSTEM_PROMPT = `You are a financial query analyzer.
Your task is to extract any company name and fiscal/calendar year mentioned in the user's question.
Respond with ONLY a raw JSON object with this exact shape:
{"company": string or null, "fiscalYear": number or null}

Rules:
1. If fiscal year is mentioned as "FY24", "FY 2024", or "'24", convert it to the four-digit integer 2024.
2. If a company name is mentioned (e.g. "Apple", "Microsoft", "Alphabet", "Google"), extract the primary corporate name.
3. If no company is mentioned, return null for "company".
4. If no year is mentioned, return null for "fiscalYear".
5. Do NOT output markdown code blocks, backticks, or explanatory text. Return only valid JSON.`;

/**
 * Normalizes company strings for fuzzy/prefix comparison.
 * e.g. "Apple Inc." -> "apple", "Alphabet Inc" -> "alphabet"
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\.]/g, "")
    .replace(/\b(inc|corp|corporation|llc|ltd|co|company|holdings|group)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects company and fiscal year mentioned in a user query using the fast small model.
 */
export async function detectMetadataFromQuery(query: string): Promise<DetectedQueryMetadata> {
  const fallback: DetectedQueryMetadata = { company: null, fiscalYear: null };

  if (!query || query.trim().length === 0) {
    return fallback;
  }

  // Quick heuristic check: if query has no numbers and no obvious company name, skip LLM call
  const hasYearPattern = /\b(19|20)\d{2}\b|\bfy\s*'?\d{2,4}\b/i.test(query);
  const words = query.trim().split(/\s+/);
  if (words.length <= 3 && !hasYearPattern) {
    // Very short query without year
  }

  try {
    const rawResponse = await generateSmallCompletion(
      METADATA_DETECTION_SYSTEM_PROMPT,
      `Question: "${query}"`,
      0.0,
      5000 // 5s timeout
    );

    // Extract JSON from response (in case of wrapping markdown fences)
    const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return fallback;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    let company: string | null = null;
    let fiscalYear: number | null = null;

    if (typeof parsed.company === "string" && parsed.company.trim().length > 1) {
      company = parsed.company.trim();
    }

    if (typeof parsed.fiscalYear === "number" && !isNaN(parsed.fiscalYear) && parsed.fiscalYear > 1900 && parsed.fiscalYear < 2100) {
      fiscalYear = parsed.fiscalYear;
    } else if (typeof parsed.fiscalYear === "string") {
      const parsedNum = parseInt(parsed.fiscalYear.replace(/\D/g, ""), 10);
      if (!isNaN(parsedNum)) {
        fiscalYear = parsedNum < 100 ? (parsedNum > 50 ? 1900 + parsedNum : 2000 + parsedNum) : parsedNum;
      }
    }

    return { company, fiscalYear };
  } catch (error: any) {
    console.warn("[MetadataFilter] Warning during query metadata detection:", error?.message || error);
    return fallback;
  }
}

/**
 * Step 11.2: Metadata Filters
 * Matches detected metadata against the user's actual document records.
 * STRICT: Do not trust the model to invent names. Only apply filters if
 * the company or year matches an uploaded document owned by the user.
 */
export async function matchMetadataAgainstUserDocuments(
  detected: DetectedQueryMetadata,
  userId: string | Types.ObjectId,
  existingFilters?: RetrievalFilters
): Promise<RetrievalFilters> {
  const userObjectId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

  const filters: RetrievalFilters = {
    ...existingFilters,
  };

  // If user already explicitly bound a specific documentId, preserve it and do not restrict
  // or conflict with other document filters so chunks of the targeted document remain accessible.
  if (existingFilters?.documentId) {
    return filters;
  }

  // If both company and year are null, return existing filters untouched
  if (!detected.company && !detected.fiscalYear) {
    return filters;
  }

  // Fetch the user's actual uploaded documents for verification
  const userDocuments = await DocumentModel.find({
    userId: userObjectId,
    status: { $in: ["indexed", "embedding", "chunking"] },
  })
    .select("_id company fiscalYear docType")
    .lean();

  if (userDocuments.length === 0) {
    return filters;
  }

  let matchedDocs = [...userDocuments];
  let companyMatched = false;
  let yearMatched = false;

  // 1. Company Matching
  if (detected.company) {
    const normalizedDetectedCompany = normalizeCompanyName(detected.company);

    const docsMatchingCompany = userDocuments.filter((doc) => {
      if (!doc.company) return false;
      const normalizedDocCompany = normalizeCompanyName(doc.company);
      return (
        normalizedDocCompany === normalizedDetectedCompany ||
        normalizedDocCompany.includes(normalizedDetectedCompany) ||
        normalizedDetectedCompany.includes(normalizedDocCompany)
      );
    });

    if (docsMatchingCompany.length > 0) {
      matchedDocs = docsMatchingCompany;
      companyMatched = true;
      console.log(
        `[MetadataFilter] Matched company "${detected.company}" to ${docsMatchingCompany.length} user document(s):`,
        docsMatchingCompany.map((d) => `${d.company} (${d._id})`)
      );
    } else {
      console.log(
        `[MetadataFilter] Detected company "${detected.company}" did not match any uploaded user documents. Skipping company filter.`
      );
    }
  }

  // 2. Fiscal Year Matching
  if (detected.fiscalYear) {
    const targetYear = detected.fiscalYear;
    const docsMatchingYear = matchedDocs.filter((doc) => doc.fiscalYear === targetYear);

    if (docsMatchingYear.length > 0) {
      matchedDocs = docsMatchingYear;
      yearMatched = true;
      filters.fiscalYear = targetYear;
      console.log(`[MetadataFilter] Matched fiscalYear ${targetYear} to user documents.`);
    } else {
      // Check across all user documents in case company didn't narrow it
      const anyDocWithYear = userDocuments.some((doc) => doc.fiscalYear === targetYear);
      if (anyDocWithYear) {
        yearMatched = true;
        filters.fiscalYear = targetYear;
        console.log(`[MetadataFilter] Matched fiscalYear ${targetYear} across user documents.`);
      } else {
        console.log(
          `[MetadataFilter] Detected fiscalYear ${targetYear} did not match any user document records. Skipping year filter.`
        );
      }
    }
  }

  // If company was positively matched, or specific documents were narrowed down by matched criteria,
  // apply documentId filter (only if user didn't already bind an explicit single documentId)
  if (!filters.documentId && matchedDocs.length > 0) {
    if (companyMatched || (yearMatched && matchedDocs.length < userDocuments.length)) {
      const docIds = matchedDocs.map((d) => d._id);
      filters.documentId = docIds.length === 1 ? docIds[0]! : docIds;
    }
  }

  return filters;
}
