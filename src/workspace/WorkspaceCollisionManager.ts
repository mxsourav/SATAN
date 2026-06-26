// ============================================================================
// WorkspaceCollisionManager.ts — Layout safety engine.
// Prevents overlaps, enforces canvas bounds, validates imported layouts.
// Pure math, no DOM, no React.
// ============================================================================

import {
  type Rect,
  type PanelId,
  PanelRegistry,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './PanelRegistry';

/** Minimum pixels of a panel that must remain visible on-canvas. */
const MIN_VISIBLE_PX = 40;

/** Maximum iterations for overlap resolution to prevent infinite loops. */
const MAX_RESOLVE_ITERATIONS = 20;

/**
 * Clamp a panel rect so at least MIN_VISIBLE_PX remains on-canvas.
 */
export function clampToCanvas(
  rect: Rect,
  canvasW: number = CANVAS_WIDTH,
  canvasH: number = CANVAS_HEIGHT
): Rect {
  let { x, y, w, h } = rect;
  // Ensure at least MIN_VISIBLE_PX visible from the left/top
  if (x + w < MIN_VISIBLE_PX) x = MIN_VISIBLE_PX - w;
  if (y + h < MIN_VISIBLE_PX) y = MIN_VISIBLE_PX - h;
  // Ensure panel doesn't start too far right/bottom
  if (x > canvasW - MIN_VISIBLE_PX) x = canvasW - MIN_VISIBLE_PX;
  if (y > canvasH - MIN_VISIBLE_PX) y = canvasH - MIN_VISIBLE_PX;
  return { x, y, w, h };
}

/**
 * Standard AABB overlap detection between two rects.
 */
export function detectOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Calculate overlap area between two rects. Returns 0 if no overlap.
 */
function overlapArea(a: Rect, b: Rect): number {
  const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return overlapX * overlapY;
}

/**
 * Resolve overlaps by nudging the proposed panel to the nearest free position.
 * Tries right, down, left, up directions in order of minimum displacement.
 */
export function resolveOverlaps(
  panelId: PanelId,
  proposedRect: Rect,
  allRects: Record<PanelId, Rect>,
  canvasW: number = CANVAS_WIDTH,
  canvasH: number = CANVAS_HEIGHT
): Rect {
  let current = { ...proposedRect };

  for (let iteration = 0; iteration < MAX_RESOLVE_ITERATIONS; iteration++) {
    let hasOverlap = false;
    let bestNudge: Rect | null = null;
    let bestDistance = Infinity;

    for (const [otherId, otherRect] of Object.entries(allRects)) {
      if (otherId === panelId) continue;
      if (!detectOverlap(current, otherRect)) continue;

      hasOverlap = true;

      // Calculate four nudge directions to resolve this specific overlap
      const nudges: Rect[] = [
        { ...current, x: otherRect.x + otherRect.w + 2 },     // Push right
        { ...current, y: otherRect.y + otherRect.h + 2 },     // Push down
        { ...current, x: otherRect.x - current.w - 2 },       // Push left
        { ...current, y: otherRect.y - current.h - 2 },       // Push up
      ];

      for (const nudge of nudges) {
        const clamped = clampToCanvas(nudge, canvasW, canvasH);
        const dx = clamped.x - proposedRect.x;
        const dy = clamped.y - proposedRect.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestNudge = clamped;
        }
      }
    }

    if (!hasOverlap) return current;
    if (bestNudge) current = bestNudge;
    else break;
  }

  return clampToCanvas(current, canvasW, canvasH);
}

/**
 * Enforce minimum dimensions from PanelRegistry constraints.
 */
export function enforceMinSize(rect: Rect, panelId: PanelId): Rect {
  const def = PanelRegistry.get(panelId);
  return {
    x: rect.x,
    y: rect.y,
    w: Math.max(rect.w, def.minWidth),
    h: Math.max(rect.h, def.minHeight),
  };
}

/**
 * Validate a complete layout for structural integrity.
 * Checks: canvas bounds, overlaps, min sizes, missing panels.
 */
export function validateLayout(
  panels: Record<PanelId, Rect>,
  visibility: Record<PanelId, boolean>,
  canvasW: number = CANVAS_WIDTH,
  canvasH: number = CANVAS_HEIGHT
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allIds = PanelRegistry.getAllIds();

  // Check all required panel IDs exist
  for (const id of allIds) {
    if (!panels[id]) {
      errors.push(`Missing panel: ${id}`);
    }
  }

  const visibleIds = allIds.filter(id => visibility[id] && panels[id]);

  // Check canvas bounds for visible panels
  for (const id of visibleIds) {
    const rect = panels[id];
    if (rect.x + rect.w < MIN_VISIBLE_PX || rect.y + rect.h < MIN_VISIBLE_PX) {
      errors.push(`Panel ${id} is off-canvas (not enough visible area).`);
    }
    if (rect.x > canvasW - MIN_VISIBLE_PX || rect.y > canvasH - MIN_VISIBLE_PX) {
      errors.push(`Panel ${id} extends beyond canvas boundaries.`);
    }
  }

  // Check min sizes
  for (const id of visibleIds) {
    const rect = panels[id];
    const def = PanelRegistry.get(id);
    if (rect.w < def.minWidth) {
      errors.push(`Panel ${id} width (${rect.w}) below minimum (${def.minWidth}).`);
    }
    if (rect.h < def.minHeight) {
      errors.push(`Panel ${id} height (${rect.h}) below minimum (${def.minHeight}).`);
    }
  }

  // Check pairwise overlaps for visible panels
  for (let i = 0; i < visibleIds.length; i++) {
    for (let j = i + 1; j < visibleIds.length; j++) {
      const a = panels[visibleIds[i]];
      const b = panels[visibleIds[j]];
      if (detectOverlap(a, b)) {
        const area = overlapArea(a, b);
        if (area > 100) { // Ignore trivial sub-pixel overlaps
          errors.push(`Overlap between ${visibleIds[i]} and ${visibleIds[j]} (${area}px²).`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export const WorkspaceCollisionManager = {
  clampToCanvas,
  detectOverlap,
  resolveOverlaps,
  enforceMinSize,
  validateLayout,
};
