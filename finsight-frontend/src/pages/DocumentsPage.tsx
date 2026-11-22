import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentApi } from "../services/documentApi";
import type { DocumentItem } from "../types/document";
import { DocumentStatusBadge } from "../components/documents/DocumentStatusBadge";
import { UploadModal } from "../components/documents/UploadModal";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DocumentItem | null>(null);

  // TanStack Query with dynamic polling (3000ms while any status is not indexed/failed)
  const {
    data: documents = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["documents"],
    queryFn: documentApi.listDocuments,
    refetchInterval: (query) => {
      const docs = query.state.data || [];
      const hasActiveWork = docs.some(
        (doc) => doc.status !== "indexed" && doc.status !== "failed"
      );
      return hasActiveWork ? 3000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setConfirmDeleteDoc(null);
      setDeletingId(null);
    },
    onError: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = (doc: DocumentItem) => {
    setConfirmDeleteDoc(doc);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteDoc) return;
    setDeletingId(confirmDeleteDoc._id);
    deleteMutation.mutate(confirmDeleteDoc._id);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.company.toLowerCase().includes(q) ||
      doc.docType.toLowerCase().includes(q)
    );
  });

  const isPolling = documents.some(
    (doc) => doc.status !== "indexed" && doc.status !== "failed"
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Financial Documents
            </h1>
            {isPolling && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping mr-1" />
                Live Syncing
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Upload and manage your SEC filings, earnings reports, and financial PDFs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            title="Refresh List"
          >
            ↻ Refresh
          </Button>
          <Button
            variant="default"
            size="md"
            onClick={() => setIsUploadOpen(true)}
          >
            + Upload PDF
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="w-full max-w-sm">
          <input
            type="text"
            placeholder="Search by company, title, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>
        <div className="text-xs text-slate-400 hidden sm:block">
          Showing {filteredDocuments.length} of {documents.length} document(s)
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="p-0 overflow-hidden border-slate-800 bg-slate-900/50">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <div className="h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading your documents...</p>
          </div>
        ) : isError ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-red-400 text-sm">
              Failed to load documents: {(error as Error)?.message || "Network error"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="mx-auto h-16 w-16 text-slate-600 flex items-center justify-center rounded-2xl bg-slate-800/60 border border-slate-700/50 text-2xl">
              📂
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">No documents found</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                {searchQuery
                  ? "No documents match your search criteria. Try a different query."
                  : "Upload a financial PDF (such as a 10-K or 10-Q) to get started with analysis."}
              </p>
            </div>
            {!searchQuery && (
              <Button variant="default" size="sm" onClick={() => setIsUploadOpen(true)}>
                + Upload your first PDF
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Title / File</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Company</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Type</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Period</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Status</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold">Uploaded</th>
                  <th scope="col" className="px-6 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDocuments.map((doc) => (
                  <tr
                    key={doc._id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white truncate max-w-xs sm:max-w-sm">
                        {doc.title}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatFileSize(doc.fileSize)}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-medium text-slate-200">
                      {doc.company}
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {doc.docType}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-300">
                      {doc.fiscalYear
                        ? `${doc.fiscalQuarter || ""} ${doc.fiscalYear}`.trim()
                        : "—"}
                    </td>

                    <td className="px-6 py-4">
                      <DocumentStatusBadge
                        status={doc.status}
                        progress={doc.progress}
                      />
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-400">
                      {formatDate(doc.createdAt)}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => navigate(`/chat?documentId=${doc._id}`)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-medium transition-colors"
                        title="Chat with this document in FinSight AI"
                      >
                        <span>💬 Chat</span>
                      </button>
                      <a
                        href={documentApi.getDocumentFileUrl(doc._id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline px-2 py-1"
                      >
                        View PDF ↗
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-red-400 hover:bg-red-950/30"
                        onClick={() => handleDelete(doc)}
                        isLoading={deletingId === doc._id}
                        disabled={deletingId === doc._id}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["documents"] });
        }}
      />

      {/* Confirmation Modal */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Document</h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to permanently delete{" "}
              <strong className="text-white">&quot;{confirmDeleteDoc.title}&quot;</strong>? This
              will remove the stored PDF file and all metadata.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeleteDoc(null)}
                disabled={!!deletingId}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
                isLoading={!!deletingId}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;

