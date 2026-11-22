# FinSight AI 📈
### Production-Grade Financial Document Intelligence & Grounded RAG Platform

FinSight AI is an enterprise-grade Retrieval-Augmented Generation (RAG) platform purpose-built for financial analysts, equity researchers, and compliance auditors. It ingests complex SEC filings (10-K, 10-Q, 8-K), earnings releases, and annual reports, converting unstructured text and financial tables into verifiable, auditable answers with bracketed page citations.

---

## 🏆 System Evaluation Benchmark (Step 12)

To demonstrate rigorous engineering and empirical validation, FinSight AI was evaluated using an ablation study across five architectural versions against a benchmark dataset of **40 financial questions** derived from the **Microsoft FY2026 Annual Report** (covering Income Statements, Balance Sheets, Cash Flows, Notes to Financial Statements, Executive Letters, and Auditor Reports).

### Ablation Study Results

| Version | Recall@5 | Numeric match | Refusal Accuracy |
| :--- | :---: | :---: | :---: |
| **Basic chunks + vector search** | **91.2%** | **65.4%** | **0.0%** |
| **+ table extraction** | **94.1%** | **73.1%** | **0.0%** |
| **+ hybrid search** | **100.0%** | **88.5%** | **0.0%** |
| **+ reranking** | **97.1%** | **80.8%** | **0.0%** |
| **+ refusal gate and numeric check** | **97.1%** | **84.6%** | **100.0%** |

> **Key Takeaway for Technical Interviews**:
> 1. **Table Extraction (+7.7% numeric match)**: Naive text splitting chops multi-period columns (FY24, FY25, FY26) away from row labels. Preserving tables as atomic units keeps financial line-items coherent.
> 2. **Hybrid Search (100% Recall@5, +15.4% numeric match)**: Dense embeddings capture conceptual questions, while BM25 sparse keyword search directly resolves exact financial tokens (e.g., "$331,839M", "AAA rating", "NOPAs", "74,199 holders").
> 3. **Refusal Gate & Numeric Guardrails (100% Refusal Accuracy)**: Without a refusal gate, baseline RAG models attempt to answer unanswerable questions, hallucinating nonexistent figures. FinSight AI strictly refuses questions not present in the filing with *"I couldn't find this in the uploaded documents."*

---

## 📊 Evaluation Dataset Breakdown

The evaluation dataset (`eval/dataset.json`) consists of **40 human-authored test cases** across 5 distinct categories:

- **Simple Factual (12 questions)**: Auditor identity, founding date, employee headcounts, share repurchases, credit ratings.
- **Table-Based Numerical (8 questions)**: Total revenue, gross margin, segment operating income, cash balances, long-term debt schedules, foreign tax credits.
- **Multi-Year Comparison (8 questions)**: 3-year revenue CAGR, GAAP vs. non-GAAP EPS growth, operating cash flows, CapEx acceleration, effective tax rates.
- **Qualitative & Contextual (6 questions)**: AI cost-to-outcome frontier architecture, OpenAI recapitalization dilution gains, IRS transfer pricing NOPAs, revenue recognition integration policies.
- **Unanswerable / Refusal Expected (6 questions)**: Standalone Q4 financial statements, FY27 forward guidance, Xbox Game Pass exact subscribers, Nuance purchase price, CEO bonus details, competitor cloud market shares.

---

## 🛠️ How to Run the Evaluation Suite

To run the automated evaluation script across all 5 architectural configurations:

```bash
# Navigate to the backend directory
cd finsight-backend

# Run the evaluation suite
npm run eval
# or
npx tsx scripts/runEval.ts
```

The script will execute all 40 questions against the 5 system versions, calculate real-time Recall@5, Numeric Match, and Refusal Accuracy, and output detailed artifacts to:
- `eval/results.json`: Machine-readable metrics and per-version progression.
- `eval/EVALUATION_REPORT.md`: Comprehensive QA and architectural analysis report.

---

## 🏗️ Architecture & Core Components

1. **Document Ingestion & Table Extraction**:
   - Page-by-page PDF parsing via `pdfjs-dist` with scanned image detection.
   - Header-aware chunking preserving tabular structures and footnote matrices.
   - Metadata tagging (company, docType, fiscalYear, fiscalQuarter, pageStart, pageEnd).

2. **Vector Indexing & Hybrid Retrieval**:
   - 1536-dimensional embeddings with Matryoshka truncation and L2 normalization.
   - MongoDB Atlas `$vectorSearch` with tenant isolation (`userId`) and pre-filtering.
   - BM25 sparse keyword matching combined with dense vector similarity via Reciprocal Rank Fusion (RRF).

3. **Grounded Generation & Guardrails**:
   - `answer.v1` system prompt enforcing citation markers (e.g. `[1]`, `[2]`) following each factual claim.
   - Score-thresholding refusal gate returning strict not-found messages when similarity is insufficient.
   - Backend citation validation pruning non-existent or hallucinated citation indices before client streaming.

---

## 📂 Repository Structure

```
finsight-ai/
├── eval/
│   ├── dataset.json                    # 40-question benchmark dataset
│   ├── results.json                    # Automated evaluation metrics & scores
│   ├── EVALUATION_REPORT.md            # Comprehensive Senior QA report
│   └── documents/
│       └── reportPages.json            # 24-page Microsoft FY2026 Annual Report corpus
├── scripts/
│   └── runEval.ts                      # Standalone evaluation runner
├── finsight-backend/
│   ├── eval/                           # Local backend evaluation assets
│   ├── scripts/
│   │   ├── runEval.ts                  # Automated evaluation suite
│   │   ├── testSearch.ts               # Search & retrieval test suite
│   │   └── testChat.ts                 # Chat & generation test suite
│   ├── src/
│   │   ├── rag/
│   │   │   ├── ingestion/              # PDF parser, chunker, embedder
│   │   │   ├── retrieval/              # Vector search, metadata filtering
│   │   │   ├── generation/             # LLM provider (Gemini / OpenAI), rewriter
│   │   │   └── prompts/                # Grounded financial answer prompts
│   │   └── services/                   # Business logic & chat service
│   └── package.json
└── finsight-frontend/                  # React + Vite + Tailwind frontend
```
