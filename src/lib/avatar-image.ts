/** Client-side image resize/compress helpers (browser only). */

export const AVATAR_MAX_INPUT_BYTES = 2 * 1024 * 1024; // 2 MB raw file
export const AVATAR_MAX_EDGE = 256;
export const AVATAR_JPEG_QUALITY = 0.8;

export const ITEM_IMAGE_MAX_INPUT_BYTES = 8 * 1024 * 1024;
export const ITEM_IMAGE_MAX_EDGE = 960;
export const ITEM_IMAGE_JPEG_QUALITY = 0.82;

async function compressToJpeg(
  file: File,
  maxEdge: number,
  quality: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      maxEdge / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("Could not compress image");
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function compressAvatarFile(file: File): Promise<Blob> {
  return compressToJpeg(file, AVATAR_MAX_EDGE, AVATAR_JPEG_QUALITY);
}

export async function compressItemImageFile(file: File): Promise<Blob> {
  return compressToJpeg(file, ITEM_IMAGE_MAX_EDGE, ITEM_IMAGE_JPEG_QUALITY);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(blob);
  });
}
