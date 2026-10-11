"use client";

import { useEffect, useRef } from "react";

const CHARSET = " .·:-=+*o#%@";
const CHAR_ASPECT = 0.55;

type Props = {
  src: string;
  alt: string;
  cols?: number;
  gamma?: number;
  className?: string;
};

export function DotImage({ src, alt, cols = 110, gamma = 1.7, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let grid: number[] = [];
    let rows = 0;
    let frame = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const img = new Image();
    img.src = src;

    const sample = () => {
      rows = Math.round(cols * (img.height / img.width) * CHAR_ASPECT);
      const off = document.createElement("canvas");
      off.width = cols;
      off.height = rows;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      octx.drawImage(img, 0, 0, cols, rows);
      const { data } = octx.getImageData(0, 0, cols, rows);
      const raw = new Array<number>(cols * rows);
      let sum = 0;
      let min = 1;
      let max = 0;
      for (let i = 0; i < cols * rows; i++) {
        const lum = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
        raw[i] = lum;
        sum += lum;
        if (lum < min) min = lum;
        if (lum > max) max = lum;
      }
      const darkScene = sum / raw.length < 0.45;
      const span = Math.max(0.08, max - min);
      grid = raw.map((lum) => {
        const stretched = (lum - min) / span;
        const ink = darkScene ? stretched : 1 - stretched;
        return Math.pow(ink, gamma);
      });
    };

    const draw = (progress: number) => {
      const width = canvas.clientWidth;
      const cell = width / cols;
      const dpr = window.devicePixelRatio || 1;
      const height = Math.round(cell * rows / CHAR_ASPECT);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${cell / CHAR_ASPECT * 0.9}px ${getComputedStyle(canvas).fontFamily}`;
      ctx.textBaseline = "top";
      const rowHeight = cell / CHAR_ASPECT;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = grid[y * cols + x];
          const reveal = ((x * 7919 + y * 104729) % 1000) / 1000;
          if (reveal > progress || v < 0.08) continue;
          const ch = CHARSET[Math.min(CHARSET.length - 1, Math.floor(v * CHARSET.length))];
          if (ch === " ") continue;
          const warm = v > 0.78;
          ctx.fillStyle = warm ? "#ffa500" : `rgba(20,20,20,${0.28 + v * 0.72})`;
          ctx.fillText(ch, x * cell, y * rowHeight);
        }
      }
    };

    const animate = (start: number) => (now: number) => {
      const progress = Math.min(1, (now - start) / 1400);
      draw(progress);
      if (progress < 1) frame = requestAnimationFrame(animate(start));
    };

    img.onload = () => {
      sample();
      if (reduceMotion) draw(1);
      else frame = requestAnimationFrame(animate(performance.now()));
    };
    img.onerror = () => {
      rows = Math.round(cols * 0.62 * CHAR_ASPECT);
      grid = Array.from({ length: cols * rows }, (_, i) => {
        const x = (i % cols) / cols;
        const y = Math.floor(i / cols) / rows;
        const cx = x - 0.5;
        const cy = y - 0.42;
        return Math.max(0, 1 - Math.hypot(cx * 1.6, cy * 2.1));
      });
      draw(1);
    };

    const observer = new ResizeObserver(() => {
      if (grid.length) draw(1);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [src, cols, gamma]);

  return <canvas ref={canvasRef} role="img" aria-label={alt} className={`block w-full ${className ?? ""}`} />;
}
