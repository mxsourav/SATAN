// ============================================================================
// WorkspaceSpacingValidator.ts — Layout validation & health scoring.
// Pure logic — handles viewport margins, panel gaps, and alignment checks.
// ============================================================================

import { type Rect } from './PanelRegistry';

export const SAFE_PADDING = 24;
export const MIN_PANEL_GAP = 16;
export const SPACING_TOLERANCE = 10; // Avoid warnings on micro-offsets

export interface SpacingValidationResult {
  status: 'valid' | 'warning' | 'error';
  offendingPanels: string[];
  brokenPanels: string[];
  layoutScore: number;
  reason: string;
}

/**
 * Validate a layout for spacing consistency, screen edge bounds, overlaps, and density balance.
 * Returns a validation status and computed layout health score (0-100%).
 */
export function validateSpacing(
  panels: Record<string, Rect>,
  visibility: Record<string, boolean>,
  viewportW: number,
  viewportH: number
): SpacingValidationResult {
  const visibleIds = Object.keys(panels).filter(id => visibility[id]);
  const brokenPanels = new Set<string>();
  const offendingPanels = new Set<string>();
  let reason = '';
  let score = 100;

  // 1. HARD ERRORS (RED): Overlaps and Out-of-Bounds (crossing the browser edge)
  for (let i = 0; i < visibleIds.length; i++) {
    const idA = visibleIds[i];
    const rectA = panels[idA];
    if (!rectA) continue;

    // Check actual out-of-bounds (beyond browser edge)
    if (rectA.x < 0 || rectA.y < 0 || rectA.x + rectA.w > viewportW || rectA.y + rectA.h > viewportH) {
      brokenPanels.add(idA);
      score -= 30;
      reason = 'Panel exceeds workspace boundaries';
    }

    // Check overlap with any other visible panel
    for (let j = i + 1; j < visibleIds.length; j++) {
      const idB = visibleIds[j];
      const rectB = panels[idB];
      if (!rectB) continue;

      const overlap = (
        rectA.x < rectB.x + rectB.w &&
        rectA.x + rectA.w > rectB.x &&
        rectA.y < rectB.y + rectB.h &&
        rectA.y + rectA.h > rectB.y
      );

      if (overlap) {
        brokenPanels.add(idA);
        brokenPanels.add(idB);
        score -= 40;
        reason = 'Overlapping panels detected';
      }
    }
  }

  // If there are hard errors, return immediately
  if (brokenPanels.size > 0) {
    return {
      status: 'error',
      offendingPanels: [],
      brokenPanels: Array.from(brokenPanels),
      layoutScore: Math.max(0, score),
      reason,
    };
  }

  // 2. WARNINGS (YELLOW): Spacing / Alignment warnings
  
  // A. Viewport Edge Safe Padding Check:
  // Panels must not touch browser edges or be closer than SAFE_PADDING (with tolerance)
  for (const id of visibleIds) {
    const r = panels[id];
    if (!r) continue;

    const leftDist = r.x;
    const rightDist = viewportW - (r.x + r.w);
    const topDist = r.y;
    const bottomDist = viewportH - (r.y + r.h);

    const warnLimit = SAFE_PADDING - SPACING_TOLERANCE;

    if (
      (leftDist > 0 && leftDist < warnLimit) ||
      (rightDist > 0 && rightDist < warnLimit) ||
      (topDist > 0 && topDist < warnLimit) ||
      (bottomDist > 0 && bottomDist < warnLimit)
    ) {
      offendingPanels.add(id);
      score -= 8;
      reason = 'Breaching safe edge padding';
    }
  }

  // B. Panel-to-Panel spacing check (must be >= MIN_PANEL_GAP)
  for (let i = 0; i < visibleIds.length; i++) {
    const idA = visibleIds[i];
    const rectA = panels[idA];
    if (!rectA) continue;

    for (let j = i + 1; j < visibleIds.length; j++) {
      const idB = visibleIds[j];
      const rectB = panels[idB];
      if (!rectB) continue;

      // Check if they are horizontal neighbors
      const yOverlap = (rectA.y < rectB.y + rectB.h && rectA.y + rectA.h > rectB.y);
      if (yOverlap) {
        const gapX = rectA.x + rectA.w <= rectB.x 
          ? rectB.x - (rectA.x + rectA.w) 
          : rectA.x - (rectB.x + rectB.w);
        
        if (gapX > 0 && gapX < (MIN_PANEL_GAP - SPACING_TOLERANCE)) {
          offendingPanels.add(idA);
          offendingPanels.add(idB);
          score -= 10;
          reason = 'Cramped horizontal panel gap';
        }
      }

      // Check if they are vertical neighbors
      const xOverlap = (rectA.x < rectB.x + rectB.w && rectA.x + rectA.w > rectB.x);
      if (xOverlap) {
        const gapY = rectA.y + rectA.h <= rectB.y 
          ? rectB.y - (rectA.y + rectA.h) 
          : rectA.y - (rectB.y + rectB.h);
        
        if (gapY > 0 && gapY < (MIN_PANEL_GAP - SPACING_TOLERANCE)) {
          offendingPanels.add(idA);
          offendingPanels.add(idB);
          score -= 10;
          reason = 'Cramped vertical panel gap';
        }
      }
    }
  }

  // C. Uneven Spacing/Alignment Margins:
  if (visibleIds.length > 0) {
    // Find leftmost and rightmost panels
    let minX = Infinity;
    let maxX = -Infinity;
    let leftmost: string[] = [];
    let rightmost: string[] = [];

    for (const id of visibleIds) {
      const r = panels[id];
      if (!r) continue;
      if (r.x < minX) {
        minX = r.x;
        leftmost = [id];
      } else if (r.x === minX) {
        leftmost.push(id);
      }

      const rightEdge = r.x + r.w;
      if (rightEdge > maxX) {
        maxX = rightEdge;
        rightmost = [id];
      } else if (rightEdge === maxX) {
        rightmost.push(id);
      }
    }

    const d_left = minX;
    const d_right = viewportW - maxX;

    // Tolerance limit for margin check
    if (d_left > 0 && d_right > 0 && Math.abs(d_left - d_right) > (24 + SPACING_TOLERANCE)) {
      leftmost.forEach(id => offendingPanels.add(id));
      rightmost.forEach(id => offendingPanels.add(id));
      score -= 10;
      reason = 'Uneven horizontal edge margins';
    }
    
    // Find topmost and bottommost panels
    let minY = Infinity;
    let maxY = -Infinity;
    let topmost: string[] = [];
    let bottommost: string[] = [];

    for (const id of visibleIds) {
      const r = panels[id];
      if (!r) continue;
      if (r.y < minY) {
        minY = r.y;
        topmost = [id];
      } else if (r.y === minY) {
        topmost.push(id);
      }

      const bottomEdge = r.y + r.h;
      if (bottomEdge > maxY) {
        maxY = bottomEdge;
        bottommost = [id];
      } else if (bottomEdge === maxY) {
        bottommost.push(id);
      }
    }

    const d_top = minY;
    const d_bottom = viewportH - maxY;

    // Tolerance limit for margin check
    if (d_top > 0 && d_bottom > 0 && Math.abs(d_top - d_bottom) > (24 + SPACING_TOLERANCE)) {
      topmost.forEach(id => offendingPanels.add(id));
      bottommost.forEach(id => offendingPanels.add(id));
      score -= 10;
      reason = 'Uneven vertical edge margins';
    }
  }

  if (offendingPanels.size > 0) {
    return {
      status: 'warning',
      offendingPanels: Array.from(offendingPanels),
      brokenPanels: [],
      layoutScore: Math.max(0, score),
      reason,
    };
  }

  return {
    status: 'valid',
    offendingPanels: [],
    brokenPanels: [],
    layoutScore: 100,
    reason: 'Layout clean',
  };
}
