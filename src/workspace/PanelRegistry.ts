// ============================================================================
// PanelRegistry.ts — Single source of truth for all workspace panels.
// Panels self-declare constraints, metadata, and z-priority.
// The workspace engine renders panels dynamically from this registry.
// ============================================================================

import React from 'react';

// ── Panel Identifiers ───────────────────────────────────────────────────────
export type PanelId =
  | 'aiDiagnostics'
  | 'serialMonitor'
  | 'oledDisplay'
  | 'oledSettings'
  | 'dpad'
  | 'controls'
  | 'telemetry'
  | 'macros'
  | 'satanHeader'
  | 'irDiodes'
  | 'credits';

// ── Z-Priority Layer System ─────────────────────────────────────────────────
// CORE(40) > HIGH(30) > NORMAL(20) > BACKGROUND(10)
// Builder overlay sits at z-index: 55
export type ZPriority = 'CORE' | 'HIGH' | 'NORMAL' | 'BACKGROUND';

export const Z_PRIORITY_MAP: Record<ZPriority, number> = {
  CORE: 40,
  HIGH: 30,
  NORMAL: 20,
  BACKGROUND: 10,
};

// ── Rect Utility ────────────────────────────────────────────────────────────
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Dock Zones ──────────────────────────────────────────────────────────────
export type DockZone = 'left' | 'right' | 'center' | 'bottom' | 'float';

// ── Performance Tiers ───────────────────────────────────────────────────────
export type PerformanceTier = 'critical' | 'standard' | 'low';

// ── Panel Render Props ──────────────────────────────────────────────────────
// Standardized props passed to every panel's render factory.
export interface PanelRenderProps {
  width: number;
  height: number;
  isActive: boolean;
  isBuilderMode: boolean;
}

// ── Panel Definition ────────────────────────────────────────────────────────
export interface PanelDefinition {
  id: PanelId;
  label: string;
  icon: string;                                     // Lucide icon name
  zPriority: ZPriority;
  minWidth: number;
  minHeight: number;
  defaultRect: Rect;
  resizable: boolean;
  allowedDockZones: DockZone[];
  tags: string[];                                    // Semantic tags for AI metadata
  performanceTier: PerformanceTier;
}

// ── Logical Canvas Size ─────────────────────────────────────────────────────
export const CANVAS_WIDTH = 1440;
export const CANVAS_HEIGHT = 810;

// ── Panel Definitions ───────────────────────────────────────────────────────
// Each panel self-declares its constraints.
// Render factories are NOT stored here — they are assembled in App.tsx
// because they need access to App-level state (logs, serial, display, etc.)

const PANEL_DEFINITIONS: PanelDefinition[] = [
  {
    id: 'aiDiagnostics',
    label: 'AI DIAGNOSTICS',
    icon: 'Cpu',
    zPriority: 'HIGH',
    minWidth: 280,
    minHeight: 200,
    defaultRect: { x: 24, y: 246, w: 340, h: 318 },
    resizable: true,
    allowedDockZones: ['left', 'float'],
    tags: ['ai', 'diagnostics'],
    performanceTier: 'standard',
  },
  {
    id: 'serialMonitor',
    label: 'SERIAL LOG',
    icon: 'Terminal',
    zPriority: 'CORE',
    minWidth: 220,
    minHeight: 200,
    defaultRect: { x: 24, y: 580, w: 340, h: 206 },
    resizable: true,
    allowedDockZones: ['left', 'center', 'float'],
    tags: ['debugging', 'logs'],
    performanceTier: 'critical',
  },
  {
    id: 'oledDisplay',
    label: 'OLED DISPLAY',
    icon: 'Monitor',
    zPriority: 'CORE',
    minWidth: 280,
    minHeight: 240,
    defaultRect: { x: 380, y: 24, w: 680, h: 440 },
    resizable: true,
    allowedDockZones: ['center', 'float'],
    tags: ['hardware', 'display'],
    performanceTier: 'critical',
  },
  {
    id: 'oledSettings',
    label: 'DISPLAY SETTINGS',
    icon: 'Palette',
    zPriority: 'NORMAL',
    minWidth: 160,
    minHeight: 300,
    defaultRect: { x: 1076, y: 24, w: 340, h: 540 },
    resizable: true,
    allowedDockZones: ['right', 'float'],
    tags: ['settings', 'display'],
    performanceTier: 'low',
  },
  {
    id: 'controls',
    label: 'SYSTEM CONTROLS',
    icon: 'Link',
    zPriority: 'NORMAL',
    minWidth: 140,
    minHeight: 160,
    defaultRect: { x: 1076, y: 580, w: 162, h: 206 },
    resizable: true,
    allowedDockZones: ['bottom', 'float'],
    tags: ['hardware', 'connection'],
    performanceTier: 'standard',
  },
  {
    id: 'dpad',
    label: 'D-PAD NAVIGATION',
    icon: 'Gamepad2',
    zPriority: 'HIGH',
    minWidth: 300,
    minHeight: 160,
    defaultRect: { x: 380, y: 480, w: 680, h: 306 },
    resizable: true,
    allowedDockZones: ['bottom', 'center', 'float'],
    tags: ['hardware', 'input'],
    performanceTier: 'standard',
  },
  {
    id: 'macros',
    label: 'MODE SELECTORS',
    icon: 'Zap',
    zPriority: 'BACKGROUND',
    minWidth: 140,
    minHeight: 48,
    defaultRect: { x: 1254, y: 580, w: 162, h: 95 },
    resizable: true,
    allowedDockZones: ['bottom', 'right', 'float'],
    tags: ['tools', 'shortcuts'],
    performanceTier: 'low',
  },
  {
    id: 'telemetry',
    label: 'TELEMETRY',
    icon: 'Activity',
    zPriority: 'NORMAL',
    minWidth: 140,
    minHeight: 48,
    defaultRect: { x: 1254, y: 691, w: 162, h: 95 },
    resizable: true,
    allowedDockZones: ['right', 'bottom', 'float'],
    tags: ['monitoring', 'telemetry'],
    performanceTier: 'standard',
  },
  {
    id: 'satanHeader',
    label: 'SATAN TITLE',
    icon: 'Radio',
    zPriority: 'BACKGROUND',
    minWidth: 200,
    minHeight: 52,
    defaultRect: { x: 24, y: 24, w: 340, h: 100 },
    resizable: true,
    allowedDockZones: ['float'],
    tags: ['header', 'info'],
    performanceTier: 'low',
  },
  {
    id: 'irDiodes',
    label: 'IR STATUS DIODES',
    icon: 'Zap',
    zPriority: 'BACKGROUND',
    minWidth: 280,
    minHeight: 48,
    defaultRect: { x: 24, y: 140, w: 340, h: 90 },
    resizable: true,
    allowedDockZones: ['float'],
    tags: ['hardware', 'status'],
    performanceTier: 'standard',
  },
  {
    id: 'credits',
    label: 'CREDITS',
    icon: 'Info',
    zPriority: 'BACKGROUND',
    minWidth: 160,
    minHeight: 80,
    defaultRect: { x: 1076, y: 700, w: 162, h: 86 },
    resizable: true,
    allowedDockZones: ['bottom', 'right', 'float'],
    tags: ['credits', 'info'],
    performanceTier: 'low',
  },
];

// ── Registry API ────────────────────────────────────────────────────────────

class PanelRegistryService {
  private panels: Map<PanelId, PanelDefinition> = new Map();

  constructor() {
    for (const def of PANEL_DEFINITIONS) {
      this.panels.set(def.id, def);
    }
  }

  /** Get a single panel definition by ID. */
  get(id: PanelId): PanelDefinition {
    const def = this.panels.get(id);
    if (!def) throw new Error(`[PanelRegistry] Unknown panel: ${id}`);
    return def;
  }

  /** Get all panel definitions. */
  getAll(): PanelDefinition[] {
    return Array.from(this.panels.values());
  }

  /** Get all panel IDs. */
  getAllIds(): PanelId[] {
    return Array.from(this.panels.keys());
  }

  /** Get z-index for a panel, with optional stacking offset. */
  getZIndex(id: PanelId, stackOffset: number = 0): number {
    const def = this.get(id);
    return Z_PRIORITY_MAP[def.zPriority] + stackOffset;
  }

  /** Build default rects from registry definitions. */
  getDefaultRects(): Record<PanelId, Rect> {
    const rects: Partial<Record<PanelId, Rect>> = {};
    for (const [id, def] of this.panels) {
      rects[id] = { ...def.defaultRect };
    }
    return rects as Record<PanelId, Rect>;
  }

  /** Build default visibility map (all visible by default). */
  getDefaultVisibility(): Record<PanelId, boolean> {
    const vis: Partial<Record<PanelId, boolean>> = {};
    for (const id of this.panels.keys()) {
      vis[id] = true;
    }
    return vis as Record<PanelId, boolean>;
  }

  /** Get semantic tags for a set of visible panels (for AI metadata). */
  getVisibleTags(visibleIds: PanelId[]): string[] {
    const tagSet = new Set<string>();
    for (const id of visibleIds) {
      const def = this.panels.get(id);
      if (def) {
        for (const tag of def.tags) tagSet.add(tag);
      }
    }
    return Array.from(tagSet);
  }
}

export const PanelRegistry = new PanelRegistryService();
