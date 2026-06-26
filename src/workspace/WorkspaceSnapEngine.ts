// ============================================================================
// WorkspaceSnapEngine.ts — Figma-like 6-mode snapping system.
// Pure math — returns snapped coordinates and guide metadata for rendering.
// No DOM, no React.
// ============================================================================

import {
  type Rect,
  type PanelId,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './PanelRegistry';

// ── Output Types ────────────────────────────────────────────────────────────

export interface SnapGuide {
  axis: 'x' | 'y';
  position: number;
  type: 'edge' | 'center' | 'distribution' | 'canvas-center';
  color: string;
}

export interface SpacingIndicator {
  from: { x: number; y: number };
  to: { x: number; y: number };
  distance: number;
  isEqual: boolean;
}

export interface AlignGroup {
  panelIds: PanelId[];
  axis: 'x' | 'y';
  position: number;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  snappedW?: number;
  snappedH?: number;
  guides: SnapGuide[];
  alignmentGroups: AlignGroup[];
  spacingIndicators: SpacingIndicator[];
}

// ── Thresholds ──────────────────────────────────────────────────────────────

const GRID_SIZE = 10;
const EDGE_THRESHOLD = 8;
const CENTER_THRESHOLD = 8;
const CANVAS_CENTER_THRESHOLD = 12;
const EQUAL_SPACING_THRESHOLD = 6;

// ── Color Scheme ────────────────────────────────────────────────────────────

const COLOR_EDGE = '#06b6d4';           // Cyan
const COLOR_CENTER = '#d946ef';         // Magenta
const COLOR_CANVAS_CENTER = '#ffffff';  // White
const COLOR_SPACING = '#22c55e';        // Green

// ── Helpers ─────────────────────────────────────────────────────────────────

function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function centerOf(r: Rect): { cx: number; cy: number } {
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

function edges(r: Rect) {
  return {
    left: r.x,
    right: r.x + r.w,
    top: r.y,
    bottom: r.y + r.h,
  };
}

/** Get all visible other panel rects. */
function getOtherRects(
  panelId: PanelId,
  allRects: Record<PanelId, Rect>,
  visibility: Record<PanelId, boolean>
): Array<{ id: PanelId; rect: Rect }> {
  const others: Array<{ id: PanelId; rect: Rect }> = [];
  for (const [id, rect] of Object.entries(allRects)) {
    if (id === panelId) continue;
    if (visibility[id as PanelId] === false) continue;
    others.push({ id: id as PanelId, rect });
  }
  return others;
}

// ── Main Snap Function ──────────────────────────────────────────────────────

/**
 * Compute snapped position for a panel being dragged.
 * Runs all 6 snap modes simultaneously. Magnetic snaps override grid snaps.
 */
export function snapPosition(
  panelId: PanelId,
  proposedRect: Rect,
  allRects: Record<PanelId, Rect>,
  visibility: Record<PanelId, boolean>,
  canvasW: number = CANVAS_WIDTH,
  canvasH: number = CANVAS_HEIGHT
): SnapResult {
  const guides: SnapGuide[] = [];
  const alignmentGroups: AlignGroup[] = [];
  const spacingIndicators: SpacingIndicator[] = [];

  let sx = proposedRect.x;
  let sy = proposedRect.y;
  let magneticX = false;
  let magneticY = false;

  const proposed = { ...proposedRect, x: sx, y: sy };
  const pEdges = edges(proposed);
  const pCenter = centerOf(proposed);
  const others = getOtherRects(panelId, allRects, visibility);

  // ── Mode 4: Canvas center snap (12px) ─────────────────────────────────
  const canvasCX = canvasW / 2;
  const canvasCY = canvasH / 2;

  if (Math.abs(pCenter.cx - canvasCX) < CANVAS_CENTER_THRESHOLD) {
    sx = canvasCX - proposed.w / 2;
    magneticX = true;
    guides.push({ axis: 'x', position: canvasCX, type: 'canvas-center', color: COLOR_CANVAS_CENTER });
  }
  if (Math.abs(pCenter.cy - canvasCY) < CANVAS_CENTER_THRESHOLD) {
    sy = canvasCY - proposed.h / 2;
    magneticY = true;
    guides.push({ axis: 'y', position: canvasCY, type: 'canvas-center', color: COLOR_CANVAS_CENTER });
  }

  // ── Mode 2: Edge magnetic snap (8px) ──────────────────────────────────
  for (const { id, rect } of others) {
    const oEdges = edges(rect);

    // X-axis edge snapping
    if (!magneticX) {
      // Left-to-left
      if (Math.abs(pEdges.left - oEdges.left) < EDGE_THRESHOLD) {
        sx = oEdges.left; magneticX = true;
        guides.push({ axis: 'x', position: oEdges.left, type: 'edge', color: COLOR_EDGE });
      }
      // Right-to-right
      else if (Math.abs(pEdges.right - oEdges.right) < EDGE_THRESHOLD) {
        sx = oEdges.right - proposed.w; magneticX = true;
        guides.push({ axis: 'x', position: oEdges.right, type: 'edge', color: COLOR_EDGE });
      }
      // Left-to-right (butt)
      else if (Math.abs(pEdges.left - oEdges.right) < EDGE_THRESHOLD) {
        sx = oEdges.right; magneticX = true;
        guides.push({ axis: 'x', position: oEdges.right, type: 'edge', color: COLOR_EDGE });
      }
      // Right-to-left (butt)
      else if (Math.abs(pEdges.right - oEdges.left) < EDGE_THRESHOLD) {
        sx = oEdges.left - proposed.w; magneticX = true;
        guides.push({ axis: 'x', position: oEdges.left, type: 'edge', color: COLOR_EDGE });
      }
    }

    // Y-axis edge snapping
    if (!magneticY) {
      if (Math.abs(pEdges.top - oEdges.top) < EDGE_THRESHOLD) {
        sy = oEdges.top; magneticY = true;
        guides.push({ axis: 'y', position: oEdges.top, type: 'edge', color: COLOR_EDGE });
      }
      else if (Math.abs(pEdges.bottom - oEdges.bottom) < EDGE_THRESHOLD) {
        sy = oEdges.bottom - proposed.h; magneticY = true;
        guides.push({ axis: 'y', position: oEdges.bottom, type: 'edge', color: COLOR_EDGE });
      }
      else if (Math.abs(pEdges.top - oEdges.bottom) < EDGE_THRESHOLD) {
        sy = oEdges.bottom; magneticY = true;
        guides.push({ axis: 'y', position: oEdges.bottom, type: 'edge', color: COLOR_EDGE });
      }
      else if (Math.abs(pEdges.bottom - oEdges.top) < EDGE_THRESHOLD) {
        sy = oEdges.top - proposed.h; magneticY = true;
        guides.push({ axis: 'y', position: oEdges.top, type: 'edge', color: COLOR_EDGE });
      }
    }
  }

  // ── Mode 3: Center-to-center snap (8px) ───────────────────────────────
  for (const { id, rect } of others) {
    const oCenter = centerOf(rect);
    if (!magneticX && Math.abs(pCenter.cx - oCenter.cx) < CENTER_THRESHOLD) {
      sx = oCenter.cx - proposed.w / 2;
      magneticX = true;
      guides.push({ axis: 'x', position: oCenter.cx, type: 'center', color: COLOR_CENTER });
    }
    if (!magneticY && Math.abs(pCenter.cy - oCenter.cy) < CENTER_THRESHOLD) {
      sy = oCenter.cy - proposed.h / 2;
      magneticY = true;
      guides.push({ axis: 'y', position: oCenter.cy, type: 'center', color: COLOR_CENTER });
    }
  }

  // ── Smart Spacing Snap (16px and 24px target gaps) ───────────────────
  const GAP_THRESHOLD = 8; // Snap if within 8px of target
  for (const { rect } of others) {
    // Check horizontal adjacency (y-ranges overlap)
    const yOverlap = (proposed.y < rect.y + rect.h && proposed.y + proposed.h > rect.y);
    if (yOverlap && !magneticX) {
      // Proposed is to the left of other rect
      if (proposed.x + proposed.w <= rect.x) {
        const gap = rect.x - (sx + proposed.w);
        if (Math.abs(gap - 24) < GAP_THRESHOLD) {
          sx = rect.x - proposed.w - 24;
          magneticX = true;
          guides.push({ axis: 'x', position: rect.x - 24, type: 'distribution', color: COLOR_SPACING });
        } else if (Math.abs(gap - 16) < GAP_THRESHOLD) {
          sx = rect.x - proposed.w - 16;
          magneticX = true;
          guides.push({ axis: 'x', position: rect.x - 16, type: 'distribution', color: COLOR_SPACING });
        }
      }
      // Proposed is to the right of other rect
      else if (proposed.x >= rect.x + rect.w) {
        const gap = sx - (rect.x + rect.w);
        if (Math.abs(gap - 24) < GAP_THRESHOLD) {
          sx = rect.x + rect.w + 24;
          magneticX = true;
          guides.push({ axis: 'x', position: rect.x + rect.w + 24, type: 'distribution', color: COLOR_SPACING });
        } else if (Math.abs(gap - 16) < GAP_THRESHOLD) {
          sx = rect.x + rect.w + 16;
          magneticX = true;
          guides.push({ axis: 'x', position: rect.x + rect.w + 16, type: 'distribution', color: COLOR_SPACING });
        }
      }
    }

    // Check vertical adjacency (x-ranges overlap)
    const xOverlap = (proposed.x < rect.x + rect.w && proposed.x + proposed.w > rect.x);
    if (xOverlap && !magneticY) {
      // Proposed is above other rect
      if (proposed.y + proposed.h <= rect.y) {
        const gap = rect.y - (sy + proposed.h);
        if (Math.abs(gap - 24) < GAP_THRESHOLD) {
          sy = rect.y - proposed.h - 24;
          magneticY = true;
          guides.push({ axis: 'y', position: rect.y - 24, type: 'distribution', color: COLOR_SPACING });
        } else if (Math.abs(gap - 16) < GAP_THRESHOLD) {
          sy = rect.y - proposed.h - 16;
          magneticY = true;
          guides.push({ axis: 'y', position: rect.y - 16, type: 'distribution', color: COLOR_SPACING });
        }
      }
      // Proposed is below other rect
      else if (proposed.y >= rect.y + rect.h) {
        const gap = sy - (rect.y + rect.h);
        if (Math.abs(gap - 24) < GAP_THRESHOLD) {
          sy = rect.y + rect.h + 24;
          magneticY = true;
          guides.push({ axis: 'y', position: rect.y + rect.h + 24, type: 'distribution', color: COLOR_SPACING });
        } else if (Math.abs(gap - 16) < GAP_THRESHOLD) {
          sy = rect.y + rect.h + 16;
          magneticY = true;
          guides.push({ axis: 'y', position: rect.y + rect.h + 16, type: 'distribution', color: COLOR_SPACING });
        }
      }
    }
  }

  // ── Mode 1: Grid snap (10px, fallback) ────────────────────────────────
  if (!magneticX) sx = snapToGrid(sx);
  if (!magneticY) sy = snapToGrid(sy);

  // ── Mode 5: Equal spacing detection (6px) ─────────────────────────────
  // Check horizontal gaps between panels sorted by X
  const allVisible = others.map(o => ({ id: o.id, rect: o.rect }));
  allVisible.push({ id: panelId, rect: { ...proposed, x: sx, y: sy } });
  allVisible.sort((a, b) => a.rect.x - b.rect.x);

  if (allVisible.length >= 3) {
    const hGaps: { from: Rect; to: Rect; gap: number }[] = [];
    for (let i = 0; i < allVisible.length - 1; i++) {
      const a = allVisible[i].rect;
      const b = allVisible[i + 1].rect;
      const gap = b.x - (a.x + a.w);
      if (gap > 0 && gap < 200) {
        hGaps.push({ from: a, to: b, gap });
      }
    }
    // Check if any gaps are equal
    for (let i = 0; i < hGaps.length; i++) {
      for (let j = i + 1; j < hGaps.length; j++) {
        if (Math.abs(hGaps[i].gap - hGaps[j].gap) < EQUAL_SPACING_THRESHOLD) {
          spacingIndicators.push({
            from: { x: hGaps[i].from.x + hGaps[i].from.w, y: hGaps[i].from.y + hGaps[i].from.h / 2 },
            to: { x: hGaps[i].to.x, y: hGaps[i].to.y + hGaps[i].to.h / 2 },
            distance: Math.round(hGaps[i].gap),
            isEqual: true,
          });
          spacingIndicators.push({
            from: { x: hGaps[j].from.x + hGaps[j].from.w, y: hGaps[j].from.y + hGaps[j].from.h / 2 },
            to: { x: hGaps[j].to.x, y: hGaps[j].to.y + hGaps[j].to.h / 2 },
            distance: Math.round(hGaps[j].gap),
            isEqual: true,
          });
        }
      }
    }
  }

  // ── Alignment group detection ─────────────────────────────────────────
  // Check if 3+ panels share the same top/bottom/left/right edge
  const edgeMap: Record<string, PanelId[]> = {};
  for (const item of allVisible) {
    const e = edges(item.rect);
    const key_t = `y:${Math.round(e.top)}`;
    const key_b = `y:${Math.round(e.bottom)}`;
    const key_l = `x:${Math.round(e.left)}`;
    const key_r = `x:${Math.round(e.right)}`;
    for (const k of [key_t, key_b, key_l, key_r]) {
      if (!edgeMap[k]) edgeMap[k] = [];
      edgeMap[k].push(item.id);
    }
  }
  for (const [key, ids] of Object.entries(edgeMap)) {
    if (ids.length >= 3) {
      const [axis, posStr] = key.split(':');
      alignmentGroups.push({
        panelIds: ids,
        axis: axis as 'x' | 'y',
        position: parseInt(posStr),
      });
    }
  }

  return {
    snappedX: Math.round(sx),
    snappedY: Math.round(sy),
    guides,
    alignmentGroups,
    spacingIndicators,
  };
}

/**
 * Compute snapped dimensions during resize.
 * Only snaps the edge being resized, preserving the opposite edge.
 */
export function snapResize(
  panelId: PanelId,
  proposedRect: Rect,
  edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
  allRects: Record<PanelId, Rect>,
  visibility: Record<PanelId, boolean>,
  canvasW: number = CANVAS_WIDTH,
  canvasH: number = CANVAS_HEIGHT
): SnapResult {
  const guides: SnapGuide[] = [];
  let { x, y, w, h } = proposedRect;
  const others = getOtherRects(panelId, allRects, visibility);

  const resizingRight = edge.includes('e');
  const resizingLeft = edge.includes('w');
  const resizingBottom = edge.includes('s');
  const resizingTop = edge.includes('n');

  // Snap the moving edge(s) to other panels' edges
  for (const { rect } of others) {
    const oE = edges(rect);

    if (resizingRight) {
      const right = x + w;
      if (Math.abs(right - oE.left) < EDGE_THRESHOLD) {
        w = oE.left - x;
        guides.push({ axis: 'x', position: oE.left, type: 'edge', color: COLOR_EDGE });
      } else if (Math.abs(right - oE.right) < EDGE_THRESHOLD) {
        w = oE.right - x;
        guides.push({ axis: 'x', position: oE.right, type: 'edge', color: COLOR_EDGE });
      }
    }

    if (resizingLeft) {
      if (Math.abs(x - oE.right) < EDGE_THRESHOLD) {
        const right = x + w;
        x = oE.right; w = right - x;
        guides.push({ axis: 'x', position: oE.right, type: 'edge', color: COLOR_EDGE });
      } else if (Math.abs(x - oE.left) < EDGE_THRESHOLD) {
        const right = x + w;
        x = oE.left; w = right - x;
        guides.push({ axis: 'x', position: oE.left, type: 'edge', color: COLOR_EDGE });
      }
    }

    if (resizingBottom) {
      const bottom = y + h;
      if (Math.abs(bottom - oE.top) < EDGE_THRESHOLD) {
        h = oE.top - y;
        guides.push({ axis: 'y', position: oE.top, type: 'edge', color: COLOR_EDGE });
      } else if (Math.abs(bottom - oE.bottom) < EDGE_THRESHOLD) {
        h = oE.bottom - y;
        guides.push({ axis: 'y', position: oE.bottom, type: 'edge', color: COLOR_EDGE });
      }
    }

    if (resizingTop) {
      if (Math.abs(y - oE.bottom) < EDGE_THRESHOLD) {
        const bottom = y + h;
        y = oE.bottom; h = bottom - y;
        guides.push({ axis: 'y', position: oE.bottom, type: 'edge', color: COLOR_EDGE });
      } else if (Math.abs(y - oE.top) < EDGE_THRESHOLD) {
        const bottom = y + h;
        y = oE.top; h = bottom - y;
        guides.push({ axis: 'y', position: oE.top, type: 'edge', color: COLOR_EDGE });
      }
    }
  }

  // Grid snap fallback for the moving edge(s)
  if (guides.length === 0) {
    if (resizingRight) w = snapToGrid(x + w) - x;
    if (resizingLeft) { const r = x + w; x = snapToGrid(x); w = r - x; }
    if (resizingBottom) h = snapToGrid(y + h) - y;
    if (resizingTop) { const b = y + h; y = snapToGrid(y); h = b - y; }
  }

  return {
    snappedX: Math.round(x),
    snappedY: Math.round(y),
    snappedW: Math.round(w),
    snappedH: Math.round(h),
    guides,
    alignmentGroups: [],
    spacingIndicators: [],
  };
}
