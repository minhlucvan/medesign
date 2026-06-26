/**
 * Image processing utilities for vision providers.
 * Handles base64 encoding, size validation, and resizing per provider limits.
 */

/** Encode a Buffer to base64 data URI. */
export function encodeImageBase64(buffer: Buffer, mime: string): string {
  return buffer.toString('base64');
}

/** Build a data-URI string from a buffer. */
export function imageDataUri(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${encodeImageBase64(buffer, mime)}`;
}

/** Maximum image sizes per provider (in MB). */
export const PROVIDER_IMAGE_LIMITS: Record<string, number> = {
  claude: 5,    // Anthropic API: ~5 MB per image
  gemini: 20,   // Google AI: ~20 MB
  minimax: 10,  // Minimax: ~10 MB
};

/** Check if a buffer exceeds the provider's size limit. */
export function imageExceedsLimit(buffer: Buffer, providerId: string): boolean {
  const limitMb = PROVIDER_IMAGE_LIMITS[providerId] ?? 5;
  return buffer.length > limitMb * 1024 * 1024;
}

/**
 * Resize an image buffer if it exceeds the provider's size limit.
 * Uses sharp if available; otherwise returns the original buffer unchanged.
 * The caller's provider may return an error if the image is too large.
 */
export async function resizeImageIfNeeded(
  buffer: Buffer,
  providerId: string,
): Promise<{ buffer: Buffer; resized: boolean }> {
  if (!imageExceedsLimit(buffer, providerId)) return { buffer, resized: false };

  try {
    // Dynamic import — sharp is an optional runtime dependency. The try/catch handles absence.
    // @ts-expect-error — sharp may not be installed; handled by the catch block below.
    const sharpMod = await import('sharp');
    const sharp = sharpMod.default as any;
    const img = sharp(buffer);
    const meta = await img.metadata();
    const w = meta.width ?? 1024;
    const h = meta.height ?? 1024;
    const half = await img.resize(Math.round(w / 2), Math.round(h / 2)).png().toBuffer();
    return { buffer: half, resized: true };
  } catch {
    // sharp not available — return original and let the provider reject it.
    return { buffer, resized: false };
  }
}

/** Guess MIME type from a file path. */
export function guessMimeFromPath(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    default: return 'image/png';
  }
}

/**
 * Remove the alpha channel from a PNG buffer.
 * MiniMax-M3 (Anthropic-compatible API) rejects RGBA images — it requires RGB.
 * Uses pngjs (already a dep in the monorepo) when available; returns original otherwise.
 */
export async function removeAlphaFromPNG(buffer: Buffer): Promise<Buffer> {
  try {
    const { PNG } = await import('pngjs');
    const img = PNG.sync.read(buffer);
    if (img.alpha) {
      // RGB has 3 bytes/pixel; RGBA has 4. Use separate indices.
      const rgb = new PNG({ width: img.width, height: img.height, colorType: 2 });
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;   // RGBA stride
          const o = (y * rgb.width + x) * 3;    // RGB stride
          rgb.data[o] = img.data[i];
          rgb.data[o + 1] = img.data[i + 1];
          rgb.data[o + 2] = img.data[i + 2];
        }
      }
      return PNG.sync.write(rgb);
    }
    return buffer;
  } catch {
    return buffer;
  }
}
