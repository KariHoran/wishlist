/** Client-side avatar resize/compress helpers (browser only). */

export const AVATAR_MAX_INPUT_BYTES = 2 * 1024 * 1024; // 2 MB raw file
export const AVATAR_MAX_EDGE = 256;
export const AVATAR_JPEG_QUALITY = 0.8;

export async function compressAvatarFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      AVATAR_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
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
      canvas.toBlob(resolve, "image/jpeg", AVATAR_JPEG_QUALITY),
    );
    if (!blob) throw new Error("Не удалось сжать изображение");
    return blob;
  } finally {
    bitmap.close();
  }
}
