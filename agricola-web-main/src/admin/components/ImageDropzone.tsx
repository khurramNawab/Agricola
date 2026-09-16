import { useRef, useState, type DragEvent } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { uploadImages, type UploadedImage } from "../api/adminApi";

interface ImageDropzoneProps {
  /** Current image or video URL, or null when empty. */
  value: string | null;
  onUploaded: (img: UploadedImage) => void;
  onRemove: () => void;
  /** S3 folder/prefix to store under (e.g. "products", "categories"). */
  folder?: string;
  /** Small caption under the prompt, e.g. "(Cover Photo)". */
  caption?: string;
  /** "primary" = large yellow dropzone, "secondary" = compact gray. */
  variant?: "primary" | "secondary";
  /** Optional file accept pattern. Defaults to images. */
  accept?: string;
  /** Whether the dropzone is designated for video. */
  isVideo?: boolean;
}

export default function ImageDropzone({
  value,
  onUploaded,
  onRemove,
  folder = "uploads",
  caption,
  variant = "secondary",
  accept,
  isVideo = false,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const [img] = await uploadImages([file], folder);
      if (img) onUploaded(img);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (!uploading) handleFiles(e.dataTransfer.files);
  };

  // Preview state
  if (value) {
    const isVid = isVideo || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(value);
    return (
      <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-black flex items-center justify-center">
        {isVid ? (
          <video src={value} controls className="h-32 w-full object-contain" />
        ) : (
          <img src={value} alt="" className="h-32 w-full object-cover" />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 cursor-pointer z-10"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  const base =
    variant === "primary"
      ? "border-2 border-dashed border-yellow-400 bg-yellow-50 p-8"
      : "border-2 border-dashed border-gray-200 p-6";

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg transition-colors ${base} ${
        dragOver ? "border-green-500 bg-green-50" : ""
      } ${uploading ? "cursor-wait opacity-70" : "hover:border-green-400"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept || "image/jpeg,image/png,image/webp,image/gif"}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {uploading ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 size={18} className="animate-spin text-green-600" />
          Uploading…
        </div>
      ) : (
        <>
          {variant === "primary" && (
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-white text-gray-300">
              <Upload size={28} />
            </div>
          )}
          <p className="text-sm text-gray-600">
            <Upload className="mr-1 inline h-4 w-4 text-green-600" />
            Drop your file here or{" "}
            <span className="font-medium text-green-600">Browse</span>
          </p>
          {caption && <p className="mt-1 text-xs text-gray-500">{caption}</p>}
        </>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
