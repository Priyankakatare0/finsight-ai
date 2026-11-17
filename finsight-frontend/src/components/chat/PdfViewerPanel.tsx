import React, { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  AlertCircle,
  Bookmark,
} from "lucide-react";
import api from "../../lib/axios";
import type { MessageSource } from "../../types/chat";

// Configure worker for Vite using ES module build
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfViewerPanelProps {
  source: MessageSource | null;
  onClose: () => void;
}

export const PdfViewerPanel: React.FC<PdfViewerPanelProps> = ({ source, onClose }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sync pageNumber whenever selected source changes
  useEffect(() => {
    if (source?.page) {
      setPageNumber(source.page);
    }
  }, [source]);

  // Fetch PDF file as Blob using authenticated API client
  useEffect(() => {
    if (!source?.documentId) {
      setBlobUrl(null);
      return;
    }

    let isMounted = true;
    let createdUrl: string | null = null;

    const fetchPdf = async () => {
      setIsLoadingPdf(true);
      setLoadError(null);
      try {
        const response = await api.get(`/documents/${source.documentId}/file`, {
          responseType: "blob",
        });

        if (isMounted) {
          const blob = new Blob([response.data], { type: "application/pdf" });
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Failed to load PDF file:", err);
          setLoadError(err.message || "Failed to load document PDF.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPdf(false);
        }
      }
    };

    fetchPdf();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [source?.documentId]);

  if (!source) return null;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const jumpToCitedPage = () => {
    if (source.page) {
      setPageNumber(source.page);
    }
  };

  const isAtCitedPage = pageNumber === source.page;

  return (
    <div className="w-full md:w-[480px] lg:w-[540px] xl:w-[600px] border-l border-slate-800 bg-slate-950 flex flex-col h-full shrink-0 shadow-2xl z-20 transition-all">
      {/* 1. Header with Title & Close button */}
      <div className="h-14 px-4 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5 truncate mr-2">
          <div className="h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h3 className="text-xs font-semibold text-slate-100 truncate">
              {source.title || "Document Source"}
            </h3>
            <p className="text-[10px] text-slate-400">Cited at Page {source.page}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close PDF viewer (Esc)"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Source Snippet Banner (Requirement 2 & 4: showing snippet next to the page) */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 shrink-0 text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center space-x-1 font-semibold text-blue-400 text-[11px]">
            <Bookmark className="w-3.5 h-3.5 fill-blue-500/20" />
            <span>Cited Passage (Page {source.page})</span>
          </span>

          <div className="flex items-center space-x-2">
            {source.score !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800/50">
                {(source.score * 100).toFixed(1)}% match
              </span>
            )}
            {!isAtCitedPage && (
              <button
                type="button"
                onClick={jumpToCitedPage}
                className="text-[10px] text-blue-400 hover:underline flex items-center space-x-0.5 cursor-pointer"
              >
                <span>Jump to p.{source.page}</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-slate-300 text-[11px] leading-relaxed italic border-l-2 border-l-blue-500 max-h-24 overflow-y-auto">
          "{source.snippet}"
        </div>
      </div>

      {/* 3. PDF Page Controls Toolbar */}
      <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
        {/* Pagination Controls */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
            {pageNumber} / {numPages || "..."}
          </span>

          <button
            type="button"
            disabled={!numPages || pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            className="p-1 rounded hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
            className="p-1 rounded hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setScale(1.0)}
            className="p-1 rounded hover:bg-slate-800 transition-colors ml-1"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
          </button>
        </div>
      </div>

      {/* 4. PDF View Canvas (react-pdf) */}
      <div className="flex-1 overflow-auto bg-slate-950 p-4 flex justify-center items-start">
        {isLoadingPdf ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs">Loading PDF document...</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-sm space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-xs text-red-300">{loadError}</p>
            <p className="text-[11px] text-slate-500">
              The PDF file could not be rendered, but the passage snippet above is verified from this document.
            </p>
          </div>
        ) : blobUrl ? (
          <div className="shadow-2xl border border-slate-800 rounded bg-white overflow-hidden max-w-full">
            <Document
              file={blobUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="py-20 px-12 flex flex-col items-center space-y-2 text-slate-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs">Rendering page {pageNumber}...</span>
                </div>
              }
              error={
                <div className="py-12 px-6 text-center text-xs text-red-500">
                  Failed to render page.
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
        ) : (
          <div className="py-20 text-center text-xs text-slate-500">
            No document file attached to this citation.
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfViewerPanel;
