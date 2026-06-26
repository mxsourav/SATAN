// ============================================================================
// PanelBuilderChrome.tsx — Drag headers, resize handles, z-priority badges.
// Rendered only in builder mode. Purely visual chrome.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { type PanelId, PanelRegistry, type ZPriority } from './PanelRegistry';

// ── Z-Priority Badge Colors ─────────────────────────────────────────────────

const Z_BADGE_COLORS: Record<ZPriority, string> = {
  CORE: '#ef4444',       // Red
  HIGH: '#f59e0b',       // Amber
  NORMAL: '#71717a',     // Gray
  BACKGROUND: '#3f3f46', // Dim
};

// ── Resize Handle Cursors ───────────────────────────────────────────────────

const EDGE_CURSORS: Record<string, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
};

interface PanelBuilderChromeProps {
  panelId: string;
  label: string;
  zPriority: ZPriority;
  resizable: boolean;
  width: number;
  height: number;
  onDragStart: (panelId: string, e: React.PointerEvent) => void;
  onResizeStart: (panelId: string, edge: string, e: React.PointerEvent) => void;
  onManualResize: (panelId: string, size: { w?: number; h?: number }) => void;
  isSelected: boolean;
  isAtTopEdge: boolean;
  isCustom?: boolean;
  onDeleteCustom?: (panelId: string) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PanelBuilderChrome({
  panelId,
  label,
  zPriority,
  resizable,
  width,
  height,
  onDragStart,
  onResizeStart,
  onManualResize,
  isSelected,
  isAtTopEdge,
  isCustom = false,
  onDeleteCustom,
}: PanelBuilderChromeProps) {
  const badgeColor = Z_BADGE_COLORS[zPriority];
  const handleSize = 12; // px (larger invisible hitbox for easy grabbing)

  // Local inputs to allow typing freely without immediate constraint clamping
  const [localW, setLocalW] = useState<string>(Math.round(width).toString());
  const [localH, setLocalH] = useState<string>(Math.round(height).toString());

  useEffect(() => {
    setLocalW(Math.round(width).toString());
  }, [width]);

  useEffect(() => {
    setLocalH(Math.round(height).toString());
  }, [height]);

  // Subscribe to real-time drag/resize progress events to update inputs dynamically at 60fps
  useEffect(() => {
    const handleProgress = (e: Event) => {
      const customEvent = e as CustomEvent<{ panelId: PanelId; w: number; h: number }>;
      if (customEvent.detail && customEvent.detail.panelId === panelId) {
        setLocalW(customEvent.detail.w.toString());
        setLocalH(customEvent.detail.h.toString());
      }
    };
    window.addEventListener('workspace-panel-resize-progress', handleProgress);
    return () => {
      window.removeEventListener('workspace-panel-resize-progress', handleProgress);
    };
  }, [panelId]);

  if (!isSelected) return null;

  return (
    <>
      {/* Drag Header — 28px bar at top or bottom (as footer) */}
      <div
        className="workspace-drag-header"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDragStart(panelId, e);
        }}
        style={{
          touchAction: 'none',
          ...(isAtTopEdge ? {
            top: '100%',
            bottom: 'auto',
            marginTop: '4px',
            marginBottom: '0px',
          } : {
            bottom: '100%',
            top: 'auto',
            marginBottom: '4px',
            marginTop: '0px',
          })
        }}
      >
        {/* Z-Priority Badge */}
        <div
          className="workspace-z-badge"
          style={{ backgroundColor: badgeColor }}
          title={`Priority: ${zPriority}`}
        />
        <span className="workspace-drag-label">{label}</span>
        
        {/* Manual Dimension Input Fields */}
        <div 
          className="workspace-dimension-inputs" 
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={localW}
            onChange={(e) => setLocalW(e.target.value)}
            onBlur={() => {
              const val = parseInt(localW);
              if (!isNaN(val)) {
                onManualResize(panelId, { w: val });
              }
              // Always force local state to sync with prop width to revert any invalid/clamped inputs immediately
              setLocalW(Math.round(width).toString());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = parseInt(localW);
                if (!isNaN(val)) {
                  onManualResize(panelId, { w: val });
                }
                e.currentTarget.blur();
              }
            }}
            className="workspace-size-input manual-width-input"
            title="Manual Width"
          />
          <span className="text-zinc-600 font-mono select-none text-[9px]">×</span>
          <input
            type="text"
            value={localH}
            onChange={(e) => setLocalH(e.target.value)}
            onBlur={() => {
              const val = parseInt(localH);
              if (!isNaN(val)) {
                onManualResize(panelId, { h: val });
              }
              // Always force local state to sync with prop height to revert any invalid/clamped inputs immediately
              setLocalH(Math.round(height).toString());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = parseInt(localH);
                if (!isNaN(val)) {
                  onManualResize(panelId, { h: val });
                }
                e.currentTarget.blur();
              }
            }}
            className="workspace-size-input manual-height-input"
            title="Manual Height"
          />
        </div>
        
        {isCustom && onDeleteCustom && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCustom(panelId);
            }}
            className="text-[9px] font-mono font-bold text-red-400 hover:text-red-300 transition-colors bg-red-950/20 hover:bg-red-950/40 px-2 py-0.5 rounded border border-red-900/30 ml-2 cursor-pointer h-5 flex items-center select-none"
            title="Delete Custom Section"
            onPointerDown={(e) => e.stopPropagation()}
          >
            DELETE
          </button>
        )}
      </div>

      {/* Active panel outline */}
      <div className="workspace-panel-outline" />

      {/* Resize Handles — 8 hotspots */}
      {resizable && (
        <>
          {/* Edge handles */}
          {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const).map((edge) => {
            const style: React.CSSProperties = {
              position: 'absolute',
              cursor: EDGE_CURSORS[edge],
              zIndex: 2,
              touchAction: 'none',
            };

            // Position each handle
            switch (edge) {
              case 'n':
                style.top = -handleSize / 2;
                style.left = handleSize;
                style.right = handleSize;
                style.height = handleSize;
                break;
              case 's':
                style.bottom = -handleSize / 2;
                style.left = handleSize;
                style.right = handleSize;
                style.height = handleSize;
                break;
              case 'e':
                style.right = -handleSize / 2;
                style.top = handleSize;
                style.bottom = handleSize;
                style.width = handleSize;
                break;
              case 'w':
                style.left = -handleSize / 2;
                style.top = handleSize;
                style.bottom = handleSize;
                style.width = handleSize;
                break;
              case 'ne':
                style.top = -handleSize / 2;
                style.right = -handleSize / 2;
                style.width = handleSize * 2;
                style.height = handleSize * 2;
                break;
              case 'nw':
                style.top = -handleSize / 2;
                style.left = -handleSize / 2;
                style.width = handleSize * 2;
                style.height = handleSize * 2;
                break;
              case 'se':
                style.bottom = -handleSize / 2;
                style.right = -handleSize / 2;
                style.width = handleSize * 2;
                style.height = handleSize * 2;
                break;
              case 'sw':
                style.bottom = -handleSize / 2;
                style.left = -handleSize / 2;
                style.width = handleSize * 2;
                style.height = handleSize * 2;
                break;
            }

            return (
              <div
                key={edge}
                className="workspace-resize-handle"
                style={style}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onResizeStart(panelId, edge, e);
                }}
              />
            );
          })}
        </>
      )}
    </>
  );
}
