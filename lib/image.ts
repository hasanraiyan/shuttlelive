/**
 * Prepares an organizer's image in the browser before upload (SRS FR-MED-03):
 * centre-crops to the target shape, scales down, and re-encodes to WebP.
 * Re-encoding also drops EXIF metadata such as GPS location.
 */

const TARGET = {
  logo: { width: 512, height: 512 },
  banner: { width: 1800, height: 600 },
} as const;

export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export type Prepared = { blob: Blob; ext: "webp" | "jpg"; width: number; height: number };

export async function prepareImage(file: File, kind: keyof typeof TARGET): Promise<Prepared> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Use a JPEG, PNG or WebP image.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("That image is over 20 MB. Choose a smaller one.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That file couldn't be read as an image.");
  }

  const target = TARGET[kind];
  const targetRatio = target.width / target.height;
  const srcRatio = bitmap.width / bitmap.height;

  // Centre crop to the target aspect ratio.
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (srcRatio > targetRatio) sw = Math.round(bitmap.height * targetRatio);
  else sh = Math.round(bitmap.width / targetRatio);
  const sx = Math.round((bitmap.width - sw) / 2);
  const sy = Math.round((bitmap.height - sh) / 2);

  // Never upscale.
  const scale = Math.min(1, target.width / sw);
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process the image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  const webp = await encode("image/webp", 0.85);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", width, height };
  const jpeg = await encode("image/jpeg", 0.88);
  if (!jpeg) throw new Error("Your browser couldn't process the image.");
  return { blob: jpeg, ext: "jpg", width, height };
}
