export type DocumentStatus =
  | "queued"
  | "parsing"
  | "chunking"
  | "embedding"
  | "indexed"
  | "failed";

export type DocType =
  | "10-K"
  | "10-Q"
  | "8-K"
  | "earnings_call"
  | "presentation"
  | "report"
  | "other";

export interface DocumentItem {
  _id: string;
  userId: string;
  title: string;
  storageKey: string;
  fileHash: string;
  fileSize: number;
  status: DocumentStatus;
  progress: number;
  errorMessage?: string;
  company: string;
  docType: DocType;
  fiscalYear?: number;
  fiscalQuarter?: string;
  pageCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  success: boolean;
  data: {
    documents: DocumentItem[];
  };
}

export interface DocumentSingleResponse {
  success: boolean;
  data: {
    document: DocumentItem;
  };
}

