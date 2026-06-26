// ============================================================================
// WorkspaceToolbar.tsx — Builder mode control bar.
// Mode toggles, panel visibility, import/export, reset.
// ============================================================================

import React, { useRef } from 'react';
import {
  Pencil,
  Eye,
  Check,
  RotateCcw,
  Download,
  Upload,
  X,
  LayoutGrid,
} from 'lucide-react';
import { type PanelId, PanelRegistry } from './PanelRegistry';
import type { WorkspaceLayout } from './WorkspaceLayoutManager';

// ── Types ───────────────────────────────────────────────────────────────────

export type EditMode = 'runtime' | 'builder' | 'preview';

interface WorkspaceToolbarProps {
  editMode: EditMode;
  layout: WorkspaceLayout;
  onModeChange: (mode: EditMode) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
  onToggleVisibility: (panelId: string) => void;
  gridOpacity?: 'off' | 'low' | 'medium';
  onGridOpacityChange?: (opacity: 'off' | 'low' | 'medium') => void;
  layoutScore?: number;
  onAddCustomSection?: (type: 'note' | 'iframe' | 'macros') => void;
  nudgeEnabled?: boolean;
  onNudgeEnabledChange?: (enabled: boolean) => void;
  multiSelectMouse?: boolean;
  onMultiSelectMouseChange?: (enabled: boolean) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function WorkspaceToolbar({
  editMode,
  layout,
  onModeChange,
  onApply,
  onCancel,
  onReset,
  onExport,
  onImport,
  onToggleVisibility,
  gridOpacity = 'low',
  onGridOpacityChange,
  layoutScore,
  onAddCustomSection,
  nudgeEnabled = true,
  onNudgeEnabledChange,
  multiSelectMouse = false,
  onMultiSelectMouseChange,
}: WorkspaceToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      if (json) onImport(json);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  };

  const allPanels = PanelRegistry.getAll();

  if (editMode === 'runtime') {
    // Compact toggle button in runtime mode
    return (
      <button
        onClick={() => onModeChange('builder')}
        className="workspace-toolbar-toggle"
        title="Enter Layout Builder Mode"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>LAYOUT</span>
      </button>
    );
  }

  return (
    <div className="workspace-toolbar">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Mode Indicator */}
      <div className="workspace-toolbar-section">
        <div className={`workspace-mode-badge ${editMode === 'builder' ? 'workspace-mode-builder' : 'workspace-mode-preview'}`}>
          {editMode === 'builder' ? (
            <>
              <Pencil className="w-3 h-3" />
              <span>BUILDER</span>
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              <span>PREVIEW</span>
            </>
          )}
        </div>
      </div>

      {/* Mode Actions */}
      <div className="workspace-toolbar-section">
        {editMode === 'builder' && (
          <button
            onClick={() => onModeChange('preview')}
            className="workspace-toolbar-btn"
            title="Preview Final Layout"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>PREVIEW</span>
          </button>
        )}

        {editMode === 'preview' && (
          <button
            onClick={() => onModeChange('builder')}
            className="workspace-toolbar-btn"
            title="Back to Builder"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>EDIT</span>
          </button>
        )}

        <button
          onClick={onApply}
          className="workspace-toolbar-btn workspace-toolbar-btn-primary"
          title="Apply Workspace"
        >
          <Check className="w-3.5 h-3.5" />
          <span>APPLY</span>
        </button>

        <button
          onClick={onCancel}
          className="workspace-toolbar-btn workspace-toolbar-btn-danger"
          title="Cancel Changes"
        >
          <X className="w-3.5 h-3.5" />
          <span>CANCEL</span>
        </button>
      </div>

      {/* Divider */}
      {editMode === 'builder' && <div className="workspace-toolbar-divider" />}

      {/* Grid Opacity & Health Score */}
      {editMode === 'builder' && (
        <div className="workspace-toolbar-section">
          {/* Grid Opacity Button */}
          <button
            onClick={() => {
              if (!onGridOpacityChange) return;
              const next: Record<'off' | 'low' | 'medium', 'off' | 'low' | 'medium'> = {
                off: 'low',
                low: 'medium',
                medium: 'off',
              };
              onGridOpacityChange(next[gridOpacity]);
            }}
            className="workspace-toolbar-btn"
            title="Cycle Grid Opacity (OFF / LOW / MEDIUM)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>GRID: {gridOpacity.toUpperCase()}</span>
          </button>

          {/* Keyboard Nudge Toggle */}
          <button
            onClick={() => onNudgeEnabledChange?.(!nudgeEnabled)}
            className={`workspace-panel-toggle ${nudgeEnabled ? 'workspace-panel-visible' : 'workspace-panel-hidden'}`}
            title="Toggle Keyboard Arrow Key Nudging (Press Arrow Keys to move card by 1px, Shift+Arrow for 10px)"
            style={{ padding: '4px 8px', height: '22px' }}
          >
            <div className={`workspace-panel-toggle-dot ${nudgeEnabled ? 'active' : ''}`} />
            <span>KEYS MOVE</span>
          </button>

          {/* Mouse Multi Select Toggle */}
          <button
            onClick={() => onMultiSelectMouseChange?.(!multiSelectMouse)}
            className={`workspace-panel-toggle ${multiSelectMouse ? 'workspace-panel-visible' : 'workspace-panel-hidden'}`}
            title="Toggle Multi-Select Mode (Click cards to toggle selection without holding Ctrl/Shift)"
            style={{ padding: '4px 8px', height: '22px' }}
          >
            <div className={`workspace-panel-toggle-dot ${multiSelectMouse ? 'active' : ''}`} />
            <span>MULTI-SELECT</span>
          </button>

          {/* Layout Health Score */}
          {layoutScore !== undefined && (
            <div
              className="workspace-mode-badge"
              style={{
                background: layoutScore >= 80 
                  ? 'rgba(16, 185, 129, 0.12)' 
                  : layoutScore >= 50 
                    ? 'rgba(234, 179, 8, 0.12)' 
                    : 'rgba(239, 68, 68, 0.12)',
                border: layoutScore >= 80 
                  ? '1px solid rgba(16, 185, 129, 0.25)' 
                  : layoutScore >= 50 
                    ? '1px solid rgba(234, 179, 8, 0.25)' 
                    : '1px solid rgba(239, 68, 68, 0.25)',
                color: layoutScore >= 80 
                  ? '#34d399' 
                  : layoutScore >= 50 
                    ? '#facc15' 
                    : '#f87171',
                padding: '3px 8px',
                fontSize: '9px',
                marginLeft: '4px',
              }}
              title="Layout Health Score (based on spacing/overlaps)"
            >
              <span>HEALTH: <span id="workspace-health-score-value">{layoutScore}%</span></span>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="workspace-toolbar-divider" />

      {/* Import / Export / Reset / Add Section */}
      <div className="workspace-toolbar-section">
        <button onClick={onExport} className="workspace-toolbar-btn" title="Export Layout">
          <Download className="w-3.5 h-3.5" />
          <span>EXPORT</span>
        </button>
        <button onClick={handleImportClick} className="workspace-toolbar-btn" title="Import Layout">
          <Upload className="w-3.5 h-3.5" />
          <span>IMPORT</span>
        </button>
        <button onClick={onReset} className="workspace-toolbar-btn" title="Reset to Default">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RESET</span>
        </button>

        {editMode === 'builder' && (
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                onAddCustomSection?.(val as 'note' | 'iframe' | 'macros');
                e.target.value = ''; // Reset select
              }
            }}
            className="bg-[#18181b] border border-zinc-800 text-[9px] font-mono font-bold text-zinc-400 rounded px-2 py-1 focus:ring-1 focus:ring-zinc-700 focus:outline-none transition-all cursor-pointer h-6 hover:text-white hover:border-zinc-700 ml-1"
            defaultValue=""
          >
            <option value="" disabled>+ ADD SECTION</option>
            <option value="note">NOTES CARD</option>
            <option value="iframe">EMBEDDED WEB PAGE</option>
            <option value="macros">BUTTON MACROS</option>
          </select>
        )}
      </div>

      {/* Divider */}
      <div className="workspace-toolbar-divider" />

      {/* Panel Visibility Toggles */}
      <div className="workspace-toolbar-section workspace-toolbar-panels">
        {allPanels.map((def) => (
          <button
            key={def.id}
            onClick={() => onToggleVisibility(def.id)}
            className={`workspace-panel-toggle ${layout.visibility[def.id] ? 'workspace-panel-visible' : 'workspace-panel-hidden'}`}
            title={`Toggle ${def.label}`}
          >
            <div className={`workspace-panel-toggle-dot ${layout.visibility[def.id] ? 'active' : ''}`} />
            <span>{def.label.split(' ')[0]}</span>
          </button>
        ))}

        {/* Custom Panels Toggles */}
        {layout.customPanels && Object.values(layout.customPanels).map((def) => (
          <button
            key={def.id}
            onClick={() => onToggleVisibility(def.id)}
            className={`workspace-panel-toggle ${layout.visibility[def.id] !== false ? 'workspace-panel-visible' : 'workspace-panel-hidden'}`}
            title={`Toggle ${def.label}`}
          >
            <div className={`workspace-panel-toggle-dot ${layout.visibility[def.id] !== false ? 'active' : ''}`} />
            <span>{def.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
