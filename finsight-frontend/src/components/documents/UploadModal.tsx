import React, { useState, useRef, useEffect } from "react";
import { documentApi } from "../../services/documentApi";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { DocumentItem } from "../../types/document";
import axios from "axios";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: (doc?: DocumentItem) => void;
  initialFile?: File | null;
}

const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  initialFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("10-K");
  const [fiscalYear, setFiscalYear] = useState<string>(new Date().getFullYear().toString());
  const [fiscalQuarter, setFiscalQuarter] = useState<string>("FY");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen && initialFile) {
      handleFileSelection(initialFile);
    }
  }, [isOpen, initialFile]);

  if (!isOpen) return null;

  const handleFileSelection = (selectedFile: File) => {
    setErrorMessage(null);

    if (
      !selectedFile.name.toLowerCase().endsWith(".pdf") &&
      selectedFile.type !== "application/pdf"
    ) {
      setErrorMessage("Please select a valid PDF file.");
      return;
    }

    if (selectedFile.size > MAX_SIZE_BYTES) {
      setErrorMessage(`File exceeds the maximum limit of ${MAX_SIZE_MB} MB.`);
      return;
    }

    setFile(selectedFile);
    const cleanBaseName = selectedFile.name.replace(/\.pdf$/i, "").trim();
    if (!title) {
      setTitle(cleanBaseName);
    }
    if (!company) {
      // Auto-suggest company from filename, e.g. "Apple_FY24_10K" -> "Apple"
      const parts = cleanBaseName.split(/[-_ ]+/);
      if (parts[0] && parts[0].length > 1) {
        setCompany(parts[0]);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Please select a PDF document to upload.");
      return;
    }

    if (!company.trim()) {
      setErrorMessage("Company name is required.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setErrorMessage(null);

      const uploadedDoc = await documentApi.uploadDocument({
        file,
        company: company.trim(),
        title: title.trim() || undefined,
        docType,
        fiscalYear: fiscalYear ? parseInt(fiscalYear, 10) : undefined,
        fiscalQuarter: fiscalQuarter || undefined,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percent);
          }
        },
      });

      // Reset and close
      setFile(null);
      setCompany("");
      setTitle("");
      setUploadProgress(0);
      onUploadSuccess?.(uploadedDoc);
      onClose();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.response?.data?.message;
        if (status === 409) {
          setErrorMessage("Duplicate file: You have already uploaded this exact document.");
        } else {
          setErrorMessage(msg || "Failed to upload document. Please check your file.");
        }
      } else {
        setErrorMessage("An unexpected error occurred during upload.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Upload Financial PDF</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload 10-K, 10-Q, 8-K filings or earnings reports (Max 25 MB)
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs sm:text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-950/30"
                : file
                ? "border-emerald-500/50 bg-emerald-950/20"
                : "border-slate-700 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-950"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
              accept="application/pdf,.pdf"
              className="hidden"
            />

            {file ? (
              <div className="space-y-1">
                <div className="text-emerald-400 font-semibold text-sm">✓ File Selected</div>
                <div className="text-slate-200 text-sm font-medium truncate max-w-xs mx-auto">
                  {file.name}
                </div>
                <div className="text-xs text-slate-400">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • Click or drag to change
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mx-auto h-10 w-10 text-slate-400 flex items-center justify-center rounded-full bg-slate-800">
                  📄
                </div>
                <div className="text-sm font-medium text-slate-200">
                  Click to browse or drop PDF here
                </div>
                <div className="text-xs text-slate-500">PDF documents up to 25 MB</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="company"
              label="Company / Ticker *"
              placeholder="e.g. Apple (AAPL)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label
                htmlFor="docType"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Document Type
              </label>
              <select
                id="docType"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="10-K">10-K (Annual Report)</option>
                <option value="10-Q">10-Q (Quarterly Report)</option>
                <option value="8-K">8-K (Current Report)</option>
                <option value="earnings_call">Earnings Call Transcript</option>
                <option value="presentation">Investor Presentation</option>
                <option value="report">Financial Report</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="fiscalYear"
              label="Fiscal Year"
              type="number"
              placeholder="2024"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
            />

            <div className="space-y-1.5">
              <label
                htmlFor="fiscalQuarter"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Quarter / Period
              </label>
              <select
                id="fiscalQuarter"
                value={fiscalQuarter}
                onChange={(e) => setFiscalQuarter(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="FY">Full Year (FY)</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
                <option value="">None / Not Applicable</option>
              </select>
            </div>
          </div>

          <Input
            id="title"
            label="Document Title (Optional)"
            placeholder="Defaults to original file name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {isUploading && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Uploading document...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              isLoading={isUploading}
              disabled={!file || !company.trim()}
            >
              Upload Document
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;

