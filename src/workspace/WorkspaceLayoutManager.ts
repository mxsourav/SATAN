// ============================================================================
// WorkspaceLayoutManager.ts — Persistence, versioned layout schema, 
// import/export, and semantic metadata for AI context.
// ============================================================================

import {
  type PanelId,
  type Rect,
  PanelRegistry,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './PanelRegistry';

// ── Layout Schema (v2.0) ───────────────────────────────────────────────────

export interface PanelLayoutEntry {
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
}

export interface CustomPanelDefinition {
  id: string;
  label: string;
  type: 'note' | 'iframe' | 'macros';
  noteText?: string;
  iframeUrl?: string;
  customMacros?: Array<{ label: string; command: string }>;
}

export interface WorkspaceLayout {
  version: string;
  satanVersion: string;
  workspaceType: string;
  canvasSize: { w: number; h: number };
  panels: Record<string, PanelLayoutEntry>;
  visibility: Record<string, boolean>;
  themeVersion: string;
  compatFlags: string[];
  createdAt: string;
  checksum: string;
  customPanels?: Record<string, CustomPanelDefinition>;
}

/** Semantic workspace metadata for AI — never pixel data. */
export interface WorkflowMeta {
  focus: string;
  centerPanel: string;
  visibleTools: string[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'satan_workspace_layout';
const CURRENT_VERSION = '2.4';
const SATAN_VERSION = '1.1.0';
const THEME_VERSION = '1.0';

// ── Checksum ────────────────────────────────────────────────────────────────

/** Simple FNV-1a hash for layout integrity. Not crypto, just corruption detection. */
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function computeChecksum(layout: Omit<WorkspaceLayout, 'checksum'>): string {
  const data = JSON.stringify(layout.panels) + JSON.stringify(layout.visibility);
  return fnv1aHash(data);
}

// ── Layout Manager ──────────────────────────────────────────────────────────

class LayoutManager {
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Build a fresh default layout from the PanelRegistry. */
  buildDefault(): WorkspaceLayout {
    const allDefs = PanelRegistry.getAll();
    const panels: Partial<Record<PanelId, PanelLayoutEntry>> = {};
    const visibility: Partial<Record<PanelId, boolean>> = {};

    for (const def of allDefs) {
      panels[def.id] = {
        x: def.defaultRect.x,
        y: def.defaultRect.y,
        w: def.defaultRect.w,
        h: def.defaultRect.h,
        zIndex: PanelRegistry.getZIndex(def.id),
      };
      visibility[def.id] = true;
    }

    const layout: Omit<WorkspaceLayout, 'checksum'> = {
      version: CURRENT_VERSION,
      satanVersion: SATAN_VERSION,
      workspaceType: 'default',
      canvasSize: { w: CANVAS_WIDTH, h: CANVAS_HEIGHT },
      panels: panels as Record<PanelId, PanelLayoutEntry>,
      visibility: visibility as Record<PanelId, boolean>,
      themeVersion: THEME_VERSION,
      compatFlags: [],
      createdAt: new Date().toISOString(),
    };

    return { ...layout, checksum: computeChecksum(layout) };
  }

  /** Load layout from localStorage, returning default if invalid or missing. */
  loadLayout(): WorkspaceLayout {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.buildDefault();

      const parsed = JSON.parse(raw) as WorkspaceLayout;

      // Version check
      if (!parsed.version || parsed.version !== CURRENT_VERSION) {
        console.warn('[WorkspaceLayoutManager] Version mismatch, resetting to default.');
        return this.buildDefault();
      }

      // Force reset to defaults on canvas size mismatch (upgraded from 1400x760 to 1440x810)
      if (!parsed.canvasSize || parsed.canvasSize.w !== CANVAS_WIDTH || parsed.canvasSize.h !== CANVAS_HEIGHT) {
        console.warn('[WorkspaceLayoutManager] Canvas size mismatch, resetting layout to default.');
        const fresh = this.buildDefault();
        this.saveLayoutImmediate(fresh);
        return fresh;
      }

      // Checksum verification
      const expected = computeChecksum(parsed);
      if (parsed.checksum !== expected) {
        console.warn('[WorkspaceLayoutManager] Checksum mismatch, layout may be corrupted. Using anyway.');
      }

      // Ensure all panel IDs exist
      const allIds = PanelRegistry.getAllIds();
      for (const id of allIds) {
        if (!parsed.panels[id]) {
          const def = PanelRegistry.get(id);
          parsed.panels[id] = {
            x: def.defaultRect.x,
            y: def.defaultRect.y,
            w: def.defaultRect.w,
            h: def.defaultRect.h,
            zIndex: PanelRegistry.getZIndex(id),
          };
        }
        if (parsed.visibility[id] === undefined) {
          parsed.visibility[id] = true;
        }
      }

      return parsed;
    } catch (e) {
      console.error('[WorkspaceLayoutManager] Failed to load layout:', e);
      return this.buildDefault();
    }
  }

  /** Save layout to localStorage with 500ms debounce. */
  saveLayout(layout: WorkspaceLayout): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        const withChecksum: WorkspaceLayout = {
          ...layout,
          checksum: computeChecksum(layout),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(withChecksum));
      } catch (e) {
        console.error('[WorkspaceLayoutManager] Failed to save layout:', e);
      }
    }, 500);
  }

  /** Save layout immediately (no debounce). Used on explicit user action. */
  saveLayoutImmediate(layout: WorkspaceLayout): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    try {
      const withChecksum: WorkspaceLayout = {
        ...layout,
        checksum: computeChecksum(layout),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withChecksum));
    } catch (e) {
      console.error('[WorkspaceLayoutManager] Failed to save layout:', e);
    }
  }

  /** Export layout as a downloadable JSON string. */
  exportLayout(layout: WorkspaceLayout): string {
    const exportData: WorkspaceLayout = {
      ...layout,
      createdAt: new Date().toISOString(),
      checksum: computeChecksum(layout),
    };
    return JSON.stringify(exportData, null, 2);
  }

  /** Import layout from JSON string. Validates and returns layout or throws. */
  importLayout(json: string): WorkspaceLayout {
    let parsed: WorkspaceLayout;

    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('Invalid JSON format.');
    }

    // Version check
    if (!parsed.version) {
      throw new Error('Missing layout version.');
    }

    if (parsed.version !== CURRENT_VERSION) {
      // Future: add migration logic here
      throw new Error(`Unsupported layout version: ${parsed.version}. Expected: ${CURRENT_VERSION}`);
    }

    // Ensure required fields
    if (!parsed.panels || typeof parsed.panels !== 'object') {
      throw new Error('Missing or invalid panels data.');
    }
    if (!parsed.visibility || typeof parsed.visibility !== 'object') {
      throw new Error('Missing or invalid visibility data.');
    }

    // Fill missing panels from defaults
    const allIds = PanelRegistry.getAllIds();
    for (const id of allIds) {
      if (!parsed.panels[id]) {
        const def = PanelRegistry.get(id);
        parsed.panels[id] = {
          x: def.defaultRect.x,
          y: def.defaultRect.y,
          w: def.defaultRect.w,
          h: def.defaultRect.h,
          zIndex: PanelRegistry.getZIndex(id),
        };
      }
      if (parsed.visibility[id] === undefined) {
        parsed.visibility[id] = true;
      }
    }

    // Canvas size
    if (!parsed.canvasSize) {
      parsed.canvasSize = { w: CANVAS_WIDTH, h: CANVAS_HEIGHT };
    }

    // Update metadata
    parsed.satanVersion = SATAN_VERSION;
    parsed.themeVersion = THEME_VERSION;
    parsed.checksum = computeChecksum(parsed);

    return parsed;
  }

  /** Reset to factory default layout. */
  resetLayout(): WorkspaceLayout {
    localStorage.removeItem(STORAGE_KEY);
    return this.buildDefault();
  }

  /**
   * Get semantic workflow metadata for AI context injection.
   * Compresses layout into workflow intent — NEVER raw coordinates.
   * ~80 tokens max.
   */
  getWorkflowMetadata(layout: WorkspaceLayout): WorkflowMeta {
    // Determine which panels are visible
    const visibleIds = PanelRegistry.getAllIds().filter(id => layout.visibility[id]);
    const visibleTags = PanelRegistry.getVisibleTags(visibleIds);

    // Determine center panel (largest area in center region)
    let centerPanel = 'oledDisplay';
    let maxArea = 0;
    const canvasCenterX = (layout.canvasSize?.w || CANVAS_WIDTH) / 2;
    for (const id of visibleIds) {
      const p = layout.panels[id];
      if (!p) continue;
      const panelCenterX = p.x + p.w / 2;
      const distFromCenter = Math.abs(panelCenterX - canvasCenterX);
      const area = p.w * p.h;
      // Weight by area and proximity to center
      const score = area / (1 + distFromCenter * 0.01);
      if (score > maxArea) {
        maxArea = score;
        centerPanel = id;
      }
    }

    // Classify workflow focus
    let focus = 'general';
    if (visibleTags.includes('debugging') && visibleTags.includes('logs')) {
      focus = 'live_debugging';
    } else if (visibleTags.includes('hardware') && visibleTags.includes('display')) {
      focus = 'hardware_monitoring';
    } else if (visibleTags.includes('ai') && visibleTags.includes('diagnostics')) {
      focus = 'ai_analysis';
    }

    // Build visible tools list (panel labels, lowercased)
    const visibleTools = visibleIds.map(id => {
      try { return PanelRegistry.get(id).label.toLowerCase(); }
      catch { return id; }
    });

    return {
      focus,
      centerPanel,
      visibleTools,
    };
  }

  /** Update a single panel's rect in the layout. Returns new layout. */
  updatePanelRect(layout: WorkspaceLayout, panelId: string, rect: Rect): WorkspaceLayout {
    return {
      ...layout,
      panels: {
        ...layout.panels,
        [panelId]: {
          ...layout.panels[panelId],
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h,
          zIndex: layout.panels[panelId]?.zIndex || 20,
        },
      },
    };
  }

  /** Toggle visibility of a panel. Returns new layout. */
  toggleVisibility(layout: WorkspaceLayout, panelId: string): WorkspaceLayout {
    return {
      ...layout,
      visibility: {
        ...layout.visibility,
        [panelId]: !layout.visibility[panelId],
      },
    };
  }
}

export const WorkspaceLayoutManager = new LayoutManager();
