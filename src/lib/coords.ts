import type { MapConfig } from "./types";

// World (x, z) -> minimap pixel (px, py).
//
// From the dataset README:
//   u = (x - originX) / scale
//   v = (z - originZ) / scale
//   px = u * imageSize
//   py = (1 - v) * imageSize    <- Y flipped: world Z grows "up", image Y down
//
// The `y` column is elevation and is intentionally ignored for 2D plotting.
export function worldToPixel(
  x: number,
  z: number,
  cfg: MapConfig,
): [number, number] {
  const u = (x - cfg.originX) / cfg.scale;
  const v = (z - cfg.originZ) / cfg.scale;
  return [u * cfg.imageSize, (1 - v) * cfg.imageSize];
}
