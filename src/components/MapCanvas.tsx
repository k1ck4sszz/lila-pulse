import { useEffect, useRef, useState, useCallback } from "react";
import type { MapConfig, Player } from "../lib/types";
import { categoryOf, CODE_TO_EVENT } from "../lib/types";
import { worldToPixel } from "../lib/coords";
import { COLORS, CATEGORY_COLOR } from "../lib/palette";
import { renderHeatmap } from "../lib/heatmap";

export interface MarkerInput {
  x: number;
  z: number;
  cat: "kill" | "death" | "loot" | "storm";
  isBot: boolean;
  label: string;
}

export interface CanvasLayers {
  cfg: MapConfig;
  imageUrl: string;
  // replay paths (world-coord polylines)
  paths: Player[];
  showHumans: boolean;
  showBots: boolean;
  showPaths: boolean;
  markers: MarkerInput[];
  // heatmap
  heatPoints: Array<[number, number]>; // world coords
  heatVisible: boolean;
  heatRadius: number;
  heatIntensity: number;
  // playback (ms); null = show whole match statically
  playhead: number | null;
}

interface View {
  scale: number;
  tx: number;
  ty: number;
}

export default function MapCanvas({ layers }: { layers: CanvasLayers }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgReady, setImgReady] = useState(false);
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 });
  const [, forceTick] = useState(0);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // (re)load minimap image when url changes
  useEffect(() => {
    setImgReady(false);
    const img = new Image();
    img.src = layers.imageUrl;
    img.onload = () => {
      imgRef.current = img;
      setImgReady(true);
      resetView();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.imageUrl]);

  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const resetView = useCallback(() => {
    const wrap = wrapRef.current;
    const cfg = layers.cfg;
    if (!wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    // "contain" the square minimap inside the viewport
    const fit = Math.min(w, h) / cfg.imageSize;
    viewRef.current = {
      scale: fit,
      tx: (w - cfg.imageSize * fit) / 2,
      ty: (h - cfg.imageSize * fit) / 2,
    };
    forceTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.cfg]);

  // world -> screen
  const toScreen = useCallback(
    (x: number, z: number): [number, number] => {
      const [px, py] = worldToPixel(x, z, layers.cfg);
      const v = viewRef.current;
      return [px * v.scale + v.tx, py * v.scale + v.ty];
    },
    [layers.cfg],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext("2d")!;
    const wrap = wrapRef.current!;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const v = viewRef.current;
    ctx.clearRect(0, 0, w, h);

    // minimap
    ctx.save();
    ctx.globalAlpha = layers.heatVisible ? 0.5 : 0.92;
    ctx.drawImage(
      imgRef.current,
      v.tx,
      v.ty,
      layers.cfg.imageSize * v.scale,
      layers.cfg.imageSize * v.scale,
    );
    ctx.restore();

    // heatmap overlay
    if (layers.heatVisible && layers.heatPoints.length) {
      const pts: Array<[number, number]> = layers.heatPoints.map(([x, z]) =>
        toScreen(x, z),
      );
      renderHeatmap(ctx, pts, w, h, {
        radius: layers.heatRadius * Math.max(0.6, Math.min(v.scale * 1.6, 2.4)),
        intensity: layers.heatIntensity,
      });
    }

    // paths (replay)
    if (layers.showPaths) {
      for (const p of layers.paths) {
        if (p.isBot && !layers.showBots) continue;
        if (!p.isBot && !layers.showHumans) continue;
        const pts =
          layers.playhead == null
            ? p.path
            : p.path.filter((pt) => pt[2] <= layers.playhead!);
        if (pts.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const [sx, sy] = toScreen(pts[i][0], pts[i][1]);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = p.isBot ? COLORS.botDim : COLORS.humanDim;
        ctx.lineWidth = p.isBot ? 1.5 : 2.2;
        ctx.stroke();

        // head dot at current position
        const last = pts[pts.length - 1];
        const [hx, hy] = toScreen(last[0], last[1]);
        ctx.beginPath();
        ctx.arc(hx, hy, p.isBot ? 3 : 4, 0, Math.PI * 2);
        ctx.fillStyle = p.isBot ? COLORS.bot : COLORS.human;
        ctx.fill();

        // start marker
        const [stx, sty] = toScreen(p.path[0][0], p.path[0][1]);
        ctx.beginPath();
        ctx.arc(stx, sty, 3, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.start;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // event markers
    for (const m of layers.markers) {
      if (m.isBot && !layers.showBots) continue;
      if (!m.isBot && !layers.showHumans) continue;
      const [sx, sy] = toScreen(m.x, m.z);
      drawMarker(ctx, sx, sy, m.cat);
    }
  }, [layers, toScreen]);

  // redraw whenever inputs change
  useEffect(() => {
    sizeCanvas();
    draw();
  }, [draw, sizeCanvas, imgReady]);

  // resize handling
  useEffect(() => {
    const onResize = () => {
      sizeCanvas();
      draw();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sizeCanvas, draw]);

  // interactions: wheel zoom, drag pan
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const v = viewRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.max(0.2, Math.min(v.scale * factor, 20));
    // zoom around cursor
    v.tx = mx - (mx - v.tx) * (newScale / v.scale);
    v.ty = my - (my - v.ty) * (newScale / v.scale);
    v.scale = newScale;
    draw();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const v = viewRef.current;
      v.tx += e.clientX - dragRef.current.x;
      v.ty += e.clientY - dragRef.current.y;
      dragRef.current = { x: e.clientX, y: e.clientY };
      draw();
      return;
    }
    // hover tooltip for markers
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: { d: number; text: string } | null = null;
    for (const m of layers.markers) {
      if (m.isBot && !layers.showBots) continue;
      if (!m.isBot && !layers.showHumans) continue;
      const [sx, sy] = toScreen(m.x, m.z);
      const d = Math.hypot(sx - mx, sy - my);
      if (d < 10 && (!best || d < best.d)) best = { d, text: m.label };
    }
    setTooltip(best ? { x: mx, y: my, text: best.text } : null);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="block h-full w-full cursor-grab active:cursor-grabbing touch-none"
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-base-900/95 px-2 py-1 text-xs text-white shadow-lg ring-1 ring-white/10"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          {tooltip.text}
        </div>
      )}
      <button
        onClick={resetView}
        className="absolute bottom-3 right-3 z-10 rounded-md bg-base-800/90 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-white/10 hover:bg-base-700"
      >
        Reset view
      </button>
    </div>
  );
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cat: "kill" | "death" | "loot" | "storm",
) {
  const color = CATEGORY_COLOR[cat];
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.fillStyle = color;
  if (cat === "kill") {
    // diamond
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (cat === "death") {
    // X cross
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(4, 4);
    ctx.moveTo(4, -4);
    ctx.lineTo(-4, 4);
    ctx.stroke();
  } else if (cat === "loot") {
    // small square
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.strokeRect(-3.5, -3.5, 7, 7);
  } else {
    // storm: triangle
    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.lineTo(5, 4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export { categoryOf, CODE_TO_EVENT };
