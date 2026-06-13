import { HEAT_GRADIENT } from "./palette";

// Lightweight canvas heatmap (no deps). Two-pass: accumulate alpha density
// from radial blobs, then colorize by mapping density -> thermal gradient LUT.

function buildGradientLUT(): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  for (const [stop, color] of HEAT_GRADIENT) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

let lut: Uint8ClampedArray | null = null;

export interface HeatOptions {
  radius: number; // blob radius in px (canvas space)
  intensity: number; // per-point alpha (0..1), accumulates
}

export function renderHeatmap(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  width: number,
  height: number,
  opts: HeatOptions,
): void {
  if (!points.length) return;
  if (!lut) lut = buildGradientLUT();

  // Pass 1: grayscale density on an offscreen buffer.
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const octx = off.getContext("2d")!;
  octx.clearRect(0, 0, width, height);

  const r = opts.radius;
  for (const [x, y] of points) {
    if (x < -r || y < -r || x > width + r || y > height + r) continue;
    const g = octx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${opts.intensity})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    octx.fillStyle = g;
    octx.beginPath();
    octx.arc(x, y, r, 0, Math.PI * 2);
    octx.fill();
  }

  // Pass 2: colorize by alpha.
  const img = octx.getImageData(0, 0, width, height);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const li = alpha * 4;
    data[i] = lut[li];
    data[i + 1] = lut[li + 1];
    data[i + 2] = lut[li + 2];
    data[i + 3] = lut[li + 3];
  }
  octx.putImageData(img, 0, 0);
  ctx.drawImage(off, 0, 0);
}
