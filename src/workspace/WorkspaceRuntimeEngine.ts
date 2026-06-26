// ============================================================================
// WorkspaceRuntimeEngine.ts — Converts committed layout data into CSS styles.
// Used in Runtime Mode only. Zero knowledge of drag/resize/builder.
// ============================================================================

import {
  type PanelId,
  type Rect,
  PanelRegistry,
  Z_PRIORITY_MAP,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './PanelRegistry';
import type { WorkspaceLayout } from './WorkspaceLayoutManager';

// ── Panel Style Output ──────────────────────────────────────────────────────

export interface PanelStyle {
  position: 'absolute';
  left: number;
  top: number;
  width: number;
  height: number;
  zIndex: number;
  willChange: string;
}

// ── Runtime Engine ──────────────────────────────────────────────────────────

/**
 * Compute absolute CSS positioning for all visible panels from committed layout.
 */
export function computePanelStyles(
  layout: WorkspaceLayout
): Record<string, PanelStyle> {
  const styles: Record<string, PanelStyle> = {};
  const allIds = PanelRegistry.getAllIds();

  // Standard registry panels
  for (const id of allIds) {
    const entry = layout.panels[id];
    if (!entry) continue;

    const def = PanelRegistry.get(id);
    styles[id] = {
      position: 'absolute',
      left: entry.x,
      top: entry.y,
      width: entry.w,
      height: entry.h,
      zIndex: entry.zIndex || Z_PRIORITY_MAP[def.zPriority],
      willChange: 'transform',
    };
  }

  // Dynamic custom panels
  if (layout.customPanels) {
    for (const [id, customDef] of Object.entries(layout.customPanels)) {
      const entry = layout.panels[id];
      if (!entry) continue;
      styles[id] = {
        position: 'absolute',
        left: entry.x,
        top: entry.y,
        width: entry.w,
        height: entry.h,
        zIndex: entry.zIndex || 20, // default normal priority zIndex
        willChange: 'transform',
      };
    }
  }

  return styles;
}

/**
 * Compute the scale factor to fit the logical canvas inside a container.
 * Uses `contain` mode — the canvas fits entirely within the container.
 * Quantized to predefined steps to prevent text/canvas blurring at fractional scales.
 */
export function computeCanvasScale(
  containerWidth: number,
  containerHeight: number,
  canvasW: number = CANVAS_WIDTH,
  canvasH: number = CANVAS_HEIGHT
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return 1;
  const scaleX = containerWidth / canvasW;
  const scaleY = containerHeight / canvasH;
  const rawScale = Math.min(scaleX, scaleY);

  // Predefined scale steps to guarantee sharp fonts and canvas pixels
  const STEPS = [0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0, 1.25, 1.5, 2.0];

  // Find the largest step that is <= rawScale to ensure it fits completely
  let quantizedScale = STEPS[0];
  for (const step of STEPS) {
    if (step <= rawScale) {
      quantizedScale = step;
    }
  }
  return quantizedScale;
}

/**
 * Compute OLED canvas buffer dimensions for sharp rendering.
 * Uses devicePixelRatio to prevent blur at CSS scale.
 */
export function computeOLEDCanvasSize(
  logicalWidth: number,
  logicalHeight: number
): { cssWidth: number; cssHeight: number; bufferWidth: number; bufferHeight: number } {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return {
    cssWidth: logicalWidth,
    cssHeight: logicalHeight,
    bufferWidth: Math.round(logicalWidth * dpr),
    bufferHeight: Math.round(logicalHeight * dpr),
  };
}

/**
 * Compute the CSS transform string for the logical canvas wrapper.
 */
export function computeCanvasTransform(scale: number): React.CSSProperties {
  return {
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    position: 'relative' as const,
  };
}
