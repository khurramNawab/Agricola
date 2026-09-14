import React, { useRef, useState } from "react";
import {
  Upload,
  Link as LinkIcon,
  Trash2,
  ExternalLink,
  Loader2,
  Film,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Clipboard,
} from "lucide-react";
import { uploadMedia, deleteMedia } from "../api/adminApi";

interface MediaUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  mediaType?: "image" | "video" | "both";
  folder?: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}

export const MediaUploadField: React.FC<MediaUploadFieldProps> = ({
  label,
  value,
  onChange,
  mediaType = "image",
  folder = "campaigns",
  placeholder = "https://example.com/asset.jpg",
  required = false,
  helpText,
}) => {
  const [activeTab, setActiveTab] = useState<"upload" | "url">(
    value && (value.startsWith("http://") || value.startsWith("https://")) ? "url" : "upload"
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedMimeTypes =
    mediaType === "video"
      ? "video/mp4,video/webm,video/ogg,video/quicktime,video/*"
      : mediaType === "image"
      ? "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/*"
      : "image/*,video/*";

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.endsWith(".mp4") ||
      lower.endsWith(".webm") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".ogg") ||
      lower.includes("/campaign_videos/") ||
      lower.includes("video")
    );
  };

  const isYouTubeUrl = (url: string) => {
    if (!url) return false;
    return (
      url.includes("youtube.com") ||
      url.includes("youtu.be") ||
      url.includes("youtube-nocookie.com")
    );
  };

  const isWebPageUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase().split("?")[0];
    return lower.endsWith(".htm") || lower.endsWith(".html") || lower.endsWith(".php");
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    setUploadProgress(`Uploading ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)...`);

    try {
      const res = await uploadMedia(file, folder);
      if (res && res.url) {
        onChange(res.url);
      } else {
        throw new Error("Upload response did not contain a valid URL");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload file. Check file size (max 50MB).");
    } finally {
      setUploading(false);
      setUploadProgress("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDelete = async () => {
    if (!value) return;
    const oldUrl = value;
    onChange("");
    try {
      await deleteMedia(oldUrl);
    } catch (err) {
      console.warn("Delete media note:", err);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange(text.trim());
      }
    } catch {
      // Clipboard read permission might not be granted
    }
  };

  return (
    <div className="space-y-2">
      {/* Label and Mode Switcher */}
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === "upload"
                ? "bg-white text-gray-900 shadow-xs font-semibold"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Upload className="w-3 h-3 text-[#84b817]" />
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === "url"
                ? "bg-white text-gray-900 shadow-xs font-semibold"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <LinkIcon className="w-3 h-3 text-blue-500" />
            URL / Link
          </button>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedMimeTypes}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
          }
        }}
      />

      {/* URL Tab Content */}
      {activeTab === "url" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value.trim())}
                placeholder={placeholder}
                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
              />
              {value && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  title="Clear input"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Paste from clipboard"
            >
              <Clipboard className="w-3.5 h-3.5 text-gray-500" />
              <span>Paste</span>
            </button>
          </div>

          {/* Webpage .htm warning */}
          {isWebPageUrl(value) && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notice: This URL ends in a webpage format (.htm / .html)</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Web browsers cannot display HTML pages as images. Please right-click the image on the website and select <strong>&quot;Copy Image Address&quot;</strong> (ending in .jpg, .png, or .webp) or upload the image file directly.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Tab Content */}
      {activeTab === "upload" && !value && (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            dragOver
              ? "border-[#84b817] bg-[#84b817]/10 scale-[0.99]"
              : "border-gray-200 bg-gray-50/70 hover:border-[#84b817]/50 hover:bg-gray-50"
          } ${uploading ? "opacity-75 cursor-wait" : ""}`}
        >
          {uploading ? (
            <div className="py-2 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-[#84b817] animate-spin" />
              <p className="text-xs font-medium text-gray-700">{uploadProgress || "Uploading media..."}</p>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-lime-100 flex items-center justify-center text-[#84b817]">
                {mediaType === "video" ? <Film className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">
                  Click to choose or drag &amp; drop {mediaType === "video" ? "video" : "media"} here
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Supports {mediaType === "video" ? "MP4, WebM, MOV, YouTube (Max 50MB)" : "PNG, JPG, WebP, SVG (Max 50MB)"}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Preview Card (Shows whenever value is populated) */}
      {value && (
        <div className="relative border border-gray-200 bg-gray-50 rounded-2xl p-3 overflow-hidden group">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Visual Preview Box */}
            <div className="relative w-full sm:w-40 h-28 shrink-0 bg-black/5 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
              {isVideoUrl(value) ? (
                <video
                  src={value}
                  className="w-full h-full object-cover"
                  controls={false}
                  muted
                  playsInline
                  autoPlay={false}
                  onMouseOver={(e) => (e.currentTarget as HTMLVideoElement).play()}
                  onMouseOut={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                />
              ) : isYouTubeUrl(value) ? (
                <div className="flex flex-col items-center justify-center p-2 text-center text-red-600">
                  <Film className="w-8 h-8 mb-1" />
                  <span className="text-[10px] font-bold">YouTube Video</span>
                </div>
              ) : (
                <img
                  src={value}
                  alt="Uploaded media preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1547825407-2d060104b7f8?auto=format&fit=crop&w=400&q=80";
                  }}
                />
              )}
            </div>

            {/* Media Information & Controls */}
            <div className="flex-1 min-w-0 w-full flex flex-col justify-between self-stretch py-1">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Media Ready &amp; Connected</span>
                </div>
                <p className="text-[11px] text-gray-600 truncate font-mono bg-white px-2 py-1 rounded-md border border-gray-200">
                  {value}
                </p>
              </div>

              {/* Action Buttons: Replace, View, Delete */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-[#84b817]" />
                  Replace File
                </button>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Original
                </a>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors ml-auto cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
          {error}
        </p>
      )}

      {/* Help text */}
      {helpText && !error && (
        <p className="text-[10px] text-gray-400">{helpText}</p>
      )}
    </div>
  );
};

export default MediaUploadField;
