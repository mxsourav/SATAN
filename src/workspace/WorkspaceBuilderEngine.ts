// ============================================================================
// WorkspaceBuilderEngine.ts — All builder-mode interactivity.
// Operates on raw DOM during drag — NEVER updates React state until pointerup.
// Renders snap guides on an overlay canvas.
// ============================================================================

import {
  type PanelId,
  type Rect,
  PanelRegistry,
} from './PanelRegistry';
import { snapPosition, snapResize, type SnapResult } from './WorkspaceSnapEngine';
import { clampToCanvas } from './WorkspaceCollisionManager';
import { validateSpacing } from './WorkspaceSpacingValidator';

// ── Types ───────────────────────────────────────────────────────────────────

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface DragState {
  panelId: string; // The primary panel being dragged (used for snapping)
  activeIds: string[]; // All panels being dragged
  mode: 'drag' | 'resize';
  edge?: ResizeEdge;
  startMouseX: number;
  startMouseY: number;
  startRects: Record<string, Rect>; // Starting rects of all activeIds
  currentRects: Record<string, Rect>; // Current rects of all activeIds
  elements: Record<string, HTMLElement>; // DOM elements of all activeIds
}

export interface BuilderCallbacks {
  onCommit: (panelId: string, rect: Rect) => void;
  onCommitMulti?: (commits: Record<string, Rect>) => void;
  getPanelRects: () => Record<string, Rect>;
  getVisibility: () => Record<string, boolean>;
  getScale: () => number;
  getCanvasSize: () => { w: number; h: number };
  getSelectedPanelIds?: () => string[];
}

// ── Builder Engine ──────────────────────────────────────────────────────────

export class WorkspaceBuilderEngine {
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private dragState: DragState | null = null;
  private callbacks: BuilderCallbacks;
  private animFrameId: number = 0;
  private lastSnapResult: SnapResult | null = null;

  constructor(callbacks: BuilderCallbacks) {
    this.callbacks = callbacks;
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  // ── Overlay Canvas ──────────────────────────────────────────────────────

  /** Attach the overlay canvas for guide rendering. */
  attachOverlay(canvas: HTMLCanvasElement): void {
    this.overlayCanvas = canvas;
    this.overlayCtx = canvas.getContext('2d');
    this.resizeOverlay();
  }

  /** Resize overlay canvas to match logical canvas dimensions. */
  resizeOverlay(): void {
    if (!this.overlayCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const canvasSize = this.callbacks.getCanvasSize();
    this.overlayCanvas.width = canvasSize.w * dpr;
    this.overlayCanvas.height = canvasSize.h * dpr;
    this.overlayCanvas.style.width = canvasSize.w + 'px';
    this.overlayCanvas.style.height = canvasSize.h + 'px';
    if (this.overlayCtx) {
      this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /** Clear the overlay canvas. */
  private clearOverlay(): void {
    if (!this.overlayCtx || !this.overlayCanvas) return;
    const canvasSize = this.callbacks.getCanvasSize();
    this.overlayCtx.clearRect(0, 0, canvasSize.w, canvasSize.h);
  }

  // ── Drag Initiation ─────────────────────────────────────────────────────

  /**
   * Start a drag operation. Called from pointerdown on a drag header.
   * Attaches global pointermove/pointerup listeners.
   */
  startDrag(panelId: string, element: HTMLElement, clientX: number, clientY: number): void {
    const rects = this.callbacks.getPanelRects();
    const rect = rects[panelId];
    if (!rect) return;

    // Determine which panels are being dragged together
    const selected = this.callbacks.getSelectedPanelIds?.() || [];
    const activeIds = selected.includes(panelId) ? selected : [panelId];

    const startRects: Record<string, Rect> = {};
    const currentRects: Record<string, Rect> = {};
    const elements: Record<string, HTMLElement> = {};

    for (const id of activeIds) {
      const r = rects[id];
      if (r) {
        startRects[id] = { ...r };
        currentRects[id] = { ...r };
        const el = id === panelId ? element : document.querySelector(`[data-panel-id="${id}"]`) as HTMLElement;
        if (el) {
          elements[id] = el;
          el.style.transition = 'none';
          el.style.zIndex = '50';
        }
      }
    }

    this.dragState = {
      panelId,
      activeIds,
      mode: 'drag',
      startMouseX: clientX,
      startMouseY: clientY,
      startRects,
      currentRects,
      elements,
    };

    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  /**
   * Start a resize operation. Called from pointerdown on a resize handle.
   */
  startResize(panelId: string, edge: ResizeEdge, element: HTMLElement, clientX: number, clientY: number): void {
    const rects = this.callbacks.getPanelRects();
    const rect = rects[panelId];
    if (!rect) return;

    const startRects: Record<string, Rect> = { [panelId]: { ...rect } };
    const currentRects: Record<string, Rect> = { [panelId]: { ...rect } };
    const elements: Record<string, HTMLElement> = { [panelId]: element };

    this.dragState = {
      panelId,
      activeIds: [panelId],
      mode: 'resize',
      edge,
      startMouseX: clientX,
      startMouseY: clientY,
      startRects,
      currentRects,
      elements,
    };

    element.style.transition = 'none';
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  // ── Pointer Handlers (DOM-direct, no React) ─────────────────────────────

  private handlePointerMove(e: PointerEvent): void {
    if (!this.dragState) return;
    e.preventDefault();

    const scale = this.callbacks.getScale();
    const dx = (e.clientX - this.dragState.startMouseX) / scale;
    const dy = (e.clientY - this.dragState.startMouseY) / scale;

    const allRects = this.callbacks.getPanelRects();
    const visibility = this.callbacks.getVisibility();

    if (this.dragState.mode === 'drag') {
      const primaryStartRect = this.dragState.startRects[this.dragState.panelId];
      if (!primaryStartRect) return;

      const proposedRect: Rect = {
        x: primaryStartRect.x + dx,
        y: primaryStartRect.y + dy,
        w: primaryStartRect.w,
        h: primaryStartRect.h,
      };

      // Snap primary
      const canvasSize = this.callbacks.getCanvasSize();
      const snapResult = snapPosition(
        this.dragState.panelId as PanelId,
        proposedRect,
        allRects as Record<PanelId, Rect>,
        visibility as Record<PanelId, boolean>,
        canvasSize.w,
        canvasSize.h
      );

      // Clamped primary rect
      const clampedPrimary = clampToCanvas({
        ...proposedRect,
        x: snapResult.snappedX,
        y: snapResult.snappedY,
      }, canvasSize.w, canvasSize.h);

      const finalDeltaX = clampedPrimary.x - primaryStartRect.x;
      const finalDeltaY = clampedPrimary.y - primaryStartRect.y;

      // Apply delta offset to all active dragged panels
      for (const id of this.dragState.activeIds) {
        const startRect = this.dragState.startRects[id];
        const el = this.dragState.elements[id];
        if (!startRect || !el) continue;

        const offsetRect = {
          x: startRect.x + finalDeltaX,
          y: startRect.y + finalDeltaY,
          w: startRect.w,
          h: startRect.h,
        };

        const clamped = clampToCanvas(offsetRect, canvasSize.w, canvasSize.h);

        el.style.left = clamped.x + 'px';
        el.style.top = clamped.y + 'px';

        this.dragState.currentRects[id] = clamped;
      }

      this.lastSnapResult = snapResult;
    } else if (this.dragState.mode === 'resize' && this.dragState.edge) {
      const { panelId, edge } = this.dragState;
      const startRect = this.dragState.startRects[panelId];
      if (!startRect) return;

      let minWidth = 200;
      let minHeight = 120;
      try {
        const def = PanelRegistry.get(panelId as PanelId);
        minWidth = def.minWidth;
        minHeight = def.minHeight;
      } catch (e) {
        // Fallback for dynamic custom panels
      }

      let x = startRect.x;
      let y = startRect.y;
      let w = startRect.w;
      let h = startRect.h;

      // Width & X calculation
      if (edge.includes('e')) {
        w = Math.max(startRect.w + dx, minWidth);
      } else if (edge.includes('w')) {
        const proposedW = startRect.w - dx;
        if (proposedW < minWidth) {
          w = minWidth;
          x = startRect.x + startRect.w - minWidth;
        } else {
          x = startRect.x + dx;
          w = proposedW;
        }
      }

      // Height & Y calculation
      if (edge.includes('s')) {
        h = Math.max(startRect.h + dy, minHeight);
      } else if (edge.includes('n')) {
        const proposedH = startRect.h - dy;
        if (proposedH < minHeight) {
          h = minHeight;
          y = startRect.y + startRect.h - minHeight;
        } else {
          y = startRect.y + dy;
          h = proposedH;
        }
      }

      const enforced = { x, y, w, h };

      // Snap resize
      const snapResult = snapResize(
        panelId as PanelId,
        enforced,
        edge,
        allRects as Record<PanelId, Rect>,
        visibility as Record<PanelId, boolean>
      );

      const canvasSize = this.callbacks.getCanvasSize();
      const clamped = clampToCanvas({
        x: snapResult.snappedX,
        y: snapResult.snappedY,
        w: snapResult.snappedW !== undefined ? snapResult.snappedW : enforced.w,
        h: snapResult.snappedH !== undefined ? snapResult.snappedH : enforced.h,
      }, canvasSize.w, canvasSize.h);

      const el = this.dragState.elements[panelId];
      if (el) {
        el.style.left = clamped.x + 'px';
        el.style.top = clamped.y + 'px';
        el.style.width = clamped.w + 'px';
        el.style.height = clamped.h + 'px';
      }

      this.dragState.currentRects[panelId] = clamped;
      this.lastSnapResult = snapResult;
    }

    // Live update size input boxes in the DOM for active panel
    if (this.dragState) {
      const activeEl = this.dragState.elements[this.dragState.panelId];
      if (activeEl) {
        const wInput = activeEl.querySelector('.manual-width-input') as HTMLInputElement;
        const hInput = activeEl.querySelector('.manual-height-input') as HTMLInputElement;
        const currentRect = this.dragState.currentRects[this.dragState.panelId];
        if (currentRect) {
          const currentW = Math.round(currentRect.w);
          const currentH = Math.round(currentRect.h);
          if (wInput) wInput.value = currentW.toString();
          if (hInput) hInput.value = currentH.toString();

          // Dispatch progress event
          const event = new CustomEvent('workspace-panel-resize-progress', {
            detail: {
              panelId: this.dragState.panelId,
              w: currentW,
              h: currentH,
            },
          });
          window.dispatchEvent(event);
        }
      }
    }

    // Real-time full layout validation
    const activeId = this.dragState?.panelId;
    const currentRects = { ...allRects };
    if (this.dragState) {
      for (const [id, rect] of Object.entries(this.dragState.currentRects)) {
        currentRects[id] = rect;
      }
    }

    const canvasSize = this.callbacks.getCanvasSize();
    const dynamicValidation = validateSpacing(currentRects, visibility, canvasSize.w, canvasSize.h);

    const canvasEl = document.getElementById('workspace-logical-canvas');
    if (canvasEl) {
      canvasEl.classList.remove('canvas-valid', 'canvas-warning', 'canvas-error', 'canvas-out-of-bounds');
      canvasEl.classList.add(`canvas-${dynamicValidation.status}`);
    }

    const visibleIds = Object.keys(allRects).filter(id => visibility[id]);
    for (const id of visibleIds) {
      const panelEl = document.querySelector(`[data-panel-id="${id}"]`);
      if (panelEl) {
        if (dynamicValidation.status === 'error' && dynamicValidation.brokenPanels.includes(id)) {
          panelEl.classList.add('panel-error-state');
          panelEl.classList.remove('panel-warning-state');
        } else if (dynamicValidation.status === 'warning' && dynamicValidation.offendingPanels.includes(id)) {
          panelEl.classList.add('panel-warning-state');
          panelEl.classList.remove('panel-error-state');
        } else {
          panelEl.classList.remove('panel-error-state', 'panel-warning-state');
        }
      }
    }

    const healthValEl = document.getElementById('workspace-health-score-value');
    if (healthValEl) {
      healthValEl.textContent = `${dynamicValidation.layoutScore}%`;
      const badgeEl = healthValEl.closest('.workspace-mode-badge') as HTMLElement;
      if (badgeEl) {
        if (dynamicValidation.layoutScore >= 80) {
          badgeEl.style.background = 'rgba(16, 185, 129, 0.12)';
          badgeEl.style.borderColor = 'rgba(16, 185, 129, 0.25)';
          badgeEl.style.color = '#34d399';
        } else if (dynamicValidation.layoutScore >= 50) {
          badgeEl.style.background = 'rgba(234, 179, 8, 0.12)';
          badgeEl.style.borderColor = 'rgba(234, 179, 8, 0.25)';
          badgeEl.style.color = '#facc15';
        } else {
          badgeEl.style.background = 'rgba(239, 68, 68, 0.12)';
          badgeEl.style.borderColor = 'rgba(239, 68, 68, 0.25)';
          badgeEl.style.color = '#f87171';
        }
      }
    }

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(() => this.renderOverlay());
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.dragState) return;

    const commits: Record<string, Rect> = {};
    for (const id of this.dragState.activeIds) {
      const el = this.dragState.elements[id];
      if (el) {
        el.style.transition = '';
        el.style.zIndex = '';
        commits[id] = {
          x: parseFloat(el.style.left) || 0,
          y: parseFloat(el.style.top) || 0,
          w: parseFloat(el.style.width) || this.dragState.startRects[id].w,
          h: parseFloat(el.style.height) || this.dragState.startRects[id].h,
        };
      }
    }

    if (this.callbacks.onCommitMulti) {
      this.callbacks.onCommitMulti(commits);
    } else {
      for (const [id, rect] of Object.entries(commits)) {
        this.callbacks.onCommit(id, rect);
      }
    }

    this.dragState = null;
    this.lastSnapResult = null;
    this.clearOverlay();

    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
  }

  // ── Overlay Rendering ───────────────────────────────────────────────────

  private renderOverlay(): void {
    this.clearOverlay();
    const ctx = this.overlayCtx;
    if (!ctx || !this.lastSnapResult) return;

    const { guides, spacingIndicators, alignmentGroups } = this.lastSnapResult;
    const canvasSize = this.callbacks.getCanvasSize();

    for (const guide of guides) {
      ctx.save();
      ctx.strokeStyle = guide.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.8;

      ctx.beginPath();
      if (guide.axis === 'x') {
        ctx.moveTo(guide.position, 0);
        ctx.lineTo(guide.position, canvasSize.h);
      } else {
        ctx.moveTo(0, guide.position);
        ctx.lineTo(canvasSize.w, guide.position);
      }
      ctx.stroke();
      ctx.restore();
    }

    for (const indicator of spacingIndicators) {
      ctx.save();
      ctx.strokeStyle = indicator.isEqual ? '#22c55e' : '#71717a';
      ctx.fillStyle = indicator.isEqual ? '#22c55e' : '#71717a';
      ctx.lineWidth = 1;
      ctx.globalAlpha = indicator.isEqual ? 0.9 : 0.5;

      ctx.beginPath();
      ctx.moveTo(indicator.from.x, indicator.from.y);
      ctx.lineTo(indicator.to.x, indicator.to.y);
      ctx.stroke();

      const midX = (indicator.from.x + indicator.to.x) / 2;
      const midY = (indicator.from.y + indicator.to.y) / 2;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      const text = `${indicator.distance}px`;
      const textWidth = ctx.measureText(text).width;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#09090b';
      ctx.fillRect(midX - textWidth / 2 - 3, midY - 14, textWidth + 6, 14);

      ctx.globalAlpha = 1;
      ctx.fillStyle = indicator.isEqual ? '#22c55e' : '#71717a';
      ctx.fillText(text, midX, midY - 2);

      ctx.restore();
    }

    for (const group of alignmentGroups) {
      ctx.save();
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 6]);
      ctx.globalAlpha = 0.5;

      ctx.beginPath();
      if (group.axis === 'x') {
        ctx.moveTo(group.position, 0);
        ctx.lineTo(group.position, canvasSize.h);
      } else {
        ctx.moveTo(0, group.position);
        ctx.lineTo(canvasSize.w, group.position);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  getDraggedPanelId(): string | null {
    return this.dragState ? this.dragState.panelId : null;
  }

  getCurrentDragRect(): Rect | null {
    return this.dragState ? this.dragState.currentRects[this.dragState.panelId] : null;
  }

  destroy(): void {
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.clearOverlay();
    this.dragState = null;
    this.overlayCanvas = null;
    this.overlayCtx = null;
  }
}
