import { z } from "zod";

export const uploadDocumentSchema = z.object({
  company: z.string().trim().min(1, "Company name is required"),
  title: z.string().trim().optional(),
  docType: z
    .enum(["10-K", "10-Q", "8-K", "earnings_call", "presentation", "report", "other"])
    .default("10-K")
    .optional(),
  fiscalYear: z.coerce.number().int().min(1900).max(2100).optional(),
  fiscalQuarter: z.enum(["Q1", "Q2", "Q3", "Q4", "FY", "none", ""]).optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

