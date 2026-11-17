import api from "../lib/axios";
import type { DocumentItem, DocumentListResponse, DocumentSingleResponse } from "../types/document";

export interface UploadDocumentParams {
  file: File;
  company: string;
  title?: string;
  docType?: string;
  fiscalYear?: number | string;
  fiscalQuarter?: string;
  onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void;
}

export const documentApi = {
  async listDocuments(): Promise<DocumentItem[]> {
    const { data } = await api.get<DocumentListResponse>("/documents");
    return data.data.documents;
  },

  async getDocument(id: string): Promise<DocumentItem> {
    const { data } = await api.get<DocumentSingleResponse>(`/documents/${id}`);
    return data.data.document;
  },

  async uploadDocument(params: UploadDocumentParams): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append("file", params.file);
    formData.append("company", params.company);
    if (params.title) formData.append("title", params.title);
    if (params.docType) formData.append("docType", params.docType);
    if (params.fiscalYear) formData.append("fiscalYear", String(params.fiscalYear));
    if (params.fiscalQuarter) formData.append("fiscalQuarter", params.fiscalQuarter);

    const { data } = await api.post<DocumentSingleResponse>("/documents", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (params.onUploadProgress) {
          params.onUploadProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
          });
        }
      },
    });

    return data.data.document;
  },

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },

  getDocumentFileUrl(id: string): string {
    const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
    return `${baseURL}/documents/${id}/file`;
  },
};

export default documentApi;

