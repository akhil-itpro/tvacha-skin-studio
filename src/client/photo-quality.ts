export type FaceBox = { originX: number; originY: number; width: number; height: number };
export type Crop = { x: number; y: number; width: number; height: number };

/** Frame the face with context, without stretching, filtering or manufacturing detail. */
export function faceCrop(width: number, height: number, normalizedBox?: FaceBox): Crop {
  const full = { x: 0, y: 0, width, height };
  if (!normalizedBox) return full;
  const box = normalizedBox;
  if (![width, height, ...Object.values(box)].every(Number.isFinite) || width <= 0 || height <= 0 || box.width <= 0 || box.height <= 0 || box.originX < 0 || box.originY < 0 || box.originX + box.width > 1.01 || box.originY + box.height > 1.01) return full;
  const bw = box.width * width, bh = box.height * height;
  // Very small detections are too uncertain to justify cutting away the image.
  if (bw < 24 || bh < 24) return full;
  const wantedWidth = Math.max(bw * 2, bh * 1.8 * .8);
  const wantedHeight = Math.max(bh * 1.9, wantedWidth / .8);
  const scale = Math.min(1, width / wantedWidth, height / wantedHeight);
  const cw = Math.round(wantedWidth * scale), ch = Math.round(wantedHeight * scale);
  if (cw < bw || ch < bh) return full;
  const x = Math.round(Math.max(0, Math.min(width - cw, (box.originX + box.width / 2) * width - cw / 2)));
  const y = Math.round(Math.max(0, Math.min(height - ch, (box.originY + box.height / 2) * height - ch * .47)));
  return { x, y, width: cw, height: ch };
}

/** Exposure and edge energy are hints only; neither can establish readability or skin colour. */
export function pixelHints(pixels: Uint8ClampedArray, width: number, height: number) {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4) return { light: false, sharp: false };
  const gray = new Float32Array(width * height);
  let sum = 0, clipped = 0;
  for (let i = 0; i < gray.length; i++) {
    const value = .2126 * pixels[i * 4] + .7152 * pixels[i * 4 + 1] + .0722 * pixels[i * 4 + 2];
    gray[i] = value; sum += value; if (value > 250) clipped++;
  }
  let edges = 0, squared = 0, count = 0;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x, lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
    edges += lap; squared += lap * lap; count++;
  }
  return { light: sum / gray.length >= 28 && sum / gray.length <= 242 && clipped / gray.length < .6, sharp: count > 0 && squared / count - (edges / count) ** 2 >= 12 };
}
