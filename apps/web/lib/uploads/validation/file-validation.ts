import type {
  SupportedUploadExtension,
  SupportedUploadMimeType,
  UploadValidationResult,
} from "@/lib/uploads/types/upload";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const allowedExtensions = new Set(["pdf", "docx", "txt", "md"]);

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/octet-stream",
]);

function extensionFor(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension && allowedExtensions.has(extension) ? extension : null;
}

export function validateUploadFile(file: File): UploadValidationResult {
  const extension = extensionFor(file.name);

  if (!extension) {
    return { ok: false, reason: "Unsupported file type. Upload PDF, DOCX, TXT, or Markdown." };
  }

  if (!allowedMimeTypes.has(file.type || "application/octet-stream")) {
    return { ok: false, reason: `Unsupported MIME type: ${file.type}` };
  }

  if (file.size <= 0) {
    return { ok: false, reason: "File is empty." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "File exceeds the 25MB upload limit." };
  }

  return {
    ok: true,
    extension: extension as SupportedUploadExtension,
    mimeType: (file.type || "application/octet-stream") as
      | SupportedUploadMimeType
      | "application/octet-stream",
  };
}
