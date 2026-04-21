/**
 * Media Upload Utility
 * Uses Replit server storage for permanent file hosting.
 */

export interface UploadResponse {
  url: string;
}

/**
 * Upload a file to Lovable Cloud Storage
 * @param file - File to upload
 * @param onProgress - Optional progress callback (0-100)
 * @returns The permanent public URL of the uploaded file
 */
export async function uploadToCloudinary(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  onProgress?.(10);

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/storage/upload", { method: "POST", body: formData });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[Storage] Upload failed:", err);
    throw new Error(`Upload failed: ${err.error || res.statusText}`);
  }

  onProgress?.(90);

  const { url } = await res.json();

  onProgress?.(100);

  console.log("[Storage] Upload success:", url);
  return url;
}
