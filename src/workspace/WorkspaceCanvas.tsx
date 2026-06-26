// ============================================================================
// WorkspaceCanvas.tsx — React component shell for the workspace.
// Assembles the logical canvas, panel wrappers, builder overlay, and toolbar.
// This is the ONLY React component in the workspace engine.
// ============================================================================

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  type PanelId,
  type Rect,
  type ZPriority,
  PanelRegistry,
} from './PanelRegistry';
import { WorkspaceLayoutManager, type WorkspaceLayout, type CustomPanelDefinition } from './WorkspaceLayoutManager';
import { computePanelStyles } from './WorkspaceRuntimeEngine';
import { WorkspaceBuilderEngine, type ResizeEdge } from './WorkspaceBuilderEngine';
import { clampToCanvas } from './WorkspaceCollisionManager';
import { validateSpacing } from './WorkspaceSpacingValidator';
import PanelBuilderChrome from './PanelBuilderChrome';
import WorkspaceToolbar, { type EditMode } from './WorkspaceToolbar';

// ── Custom Panel Components ──────────────────────────────────────────────────

function NotePanel({
  id,
  initialText,
  onSave,
}: {
  id: string;
  initialText: string;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onSave(text)}
      placeholder="Type notes here..."
      className="w-full h-full bg-transparent text-zinc-300 font-mono text-[11px] p-3 focus:outline-none resize-none placeholder-zinc-700 leading-relaxed"
    />
  );
}

function IframePanel({
  id,
  initialUrl,
  isBuilderMode,
  onSave,
}: {
  id: string;
  initialUrl: string;
  isBuilderMode: boolean;
  onSave: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [tempUrl, setTempUrl] = useState(initialUrl);

  useEffect(() => {
    setUrl(initialUrl);
    setTempUrl(initialUrl);
  }, [initialUrl]);

  return (
    <div className="flex flex-col w-full h-full">
      {isBuilderMode && (
        <div className="flex items-center gap-1.5 p-1.5 bg-[#090b0f] border-b border-zinc-800/80">
          <span className="text-[9px] text-zinc-500 font-mono select-none">URL:</span>
          <input
            type="text"
            value={tempUrl}
            onChange={(e) => setTempUrl(e.target.value)}
            onBlur={() => {
              setUrl(tempUrl);
              onSave(tempUrl);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setUrl(tempUrl);
                onSave(tempUrl);
                e.currentTarget.blur();
              }
            }}
            className="flex-1 bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 px-1.5 py-0.5 rounded focus:outline-none focus:border-zinc-700 font-mono"
          />
        </div>
      )}
      <iframe
        src={url}
        className="flex-1 w-full border-none bg-zinc-950/20"
        style={{ pointerEvents: isBuilderMode ? 'none' : 'auto' }}
        title="Embedded Web Page"
      />
    </div>
  );
}

function MacrosPanel({
  id,
  macros = [],
  isBuilderMode,
  onSave,
  onSendSerialCommand,
}: {
  id: string;
  macros: Array<{ label: string; command: string }>;
  isBuilderMode: boolean;
  onSave: (macros: Array<{ label: string; command: string }>) => void;
  onSendSerialCommand?: (cmd: string) => void;
}) {
  const handleAddMacro = () => {
    const updated = [...macros, { label: 'PING', command: 'ping' }];
    onSave(updated);
  };

  const handleRemoveMacro = (index: number) => {
    const updated = macros.filter((_, i) => i !== index);
    onSave(updated);
  };

  const handleUpdateMacro = (index: number, field: 'label' | 'command', val: string) => {
    const updated = macros.map((item, i) =>
      i === index ? { ...item, [field]: val } : item
    );
    onSave(updated);
  };

  return (
    <div className="flex flex-col w-full h-full p-3 overflow-y-auto custom-scrollbar font-sans">
      {isBuilderMode ? (
        <div className="flex flex-col gap-2 h-full">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5 shrink-0">
            <span className="text-[9px] text-zinc-500 font-mono">MACRO CONFIGURATION</span>
            <button
              onClick={handleAddMacro}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[9px] font-mono font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>ADD MACRO</span>
            </button>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {macros.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5 bg-zinc-900/30 p-1.5 rounded border border-zinc-900 shrink-0">
                <input
                  type="text"
                  placeholder="Label"
                  value={item.label}
                  onChange={(e) => handleUpdateMacro(index, 'label', e.target.value)}
                  className="w-1/3 bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 px-1.5 py-0.5 rounded font-mono focus:outline-none focus:border-zinc-700"
                />
                <input
                  type="text"
                  placeholder="Command"
                  value={item.command}
                  onChange={(e) => handleUpdateMacro(index, 'command', e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 px-1.5 py-0.5 rounded font-mono focus:outline-none focus:border-zinc-700"
                />
                <button
                  onClick={() => handleRemoveMacro(index)}
                  className="text-zinc-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                  title="Remove Macro"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {macros.length === 0 && (
              <div className="text-center text-zinc-700 font-mono text-[9px] py-4">
                NO MACROS DEFINED. CLICK ADD MACRO.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 h-full content-start">
          {macros.map((item, index) => (
            <button
              key={index}
              onClick={() => onSendSerialCommand?.(item.command)}
              className="bg-[#18181b]/60 hover:bg-[#27272a]/80 active:scale-[0.98] border border-zinc-800/60 text-zinc-200 text-[10px] font-mono font-bold py-2 px-2 rounded-lg transition-all text-center truncate cursor-pointer shadow-sm hover:border-zinc-700"
            >
              {item.label || 'UNTITLED'}
            </button>
          ))}
          {macros.length === 0 && (
            <div className="col-span-2 text-center text-zinc-600 font-mono text-[9px] py-4">
              NO MACROS DEFINED
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Props ───────────────────────────────────────────────────────────────────

export interface WorkspaceTab {
  id: string;
  name: string;
  layout: WorkspaceLayout;
}

const TABS_STORAGE_KEY = 'satan_workspace_tabs';
const ACTIVE_TAB_STORAGE_KEY = 'satan_workspace_active_tab_id';

interface WorkspaceCanvasProps {
  /** Content nodes for each panel, built in App.tsx from state/handlers. */
  panelContents: Partial<Record<PanelId, React.ReactNode>>;
  onSendSerialCommand?: (cmd: string) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function WorkspaceCanvas({ panelContents, onSendSerialCommand }: WorkspaceCanvasProps) {
  // ── State ─────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState<EditMode>('runtime');

  // Tabs list state
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => {
    try {
      const rawTabs = localStorage.getItem(TABS_STORAGE_KEY);
      if (rawTabs) {
        const parsed = JSON.parse(rawTabs) as WorkspaceTab[];
        if (parsed.length > 0) return parsed;
      }
      const legacyLayout = localStorage.getItem('satan_workspace_layout');
      if (legacyLayout) {
        try {
          const layoutObj = JSON.parse(legacyLayout) as WorkspaceLayout;
          return [{ id: 'tab-default', name: 'Layout 1', layout: layoutObj }];
        } catch (e) {}
      }
    } catch (e) {
      console.error('[WorkspaceCanvas] Failed to initialize tabs:', e);
    }
    return [{ id: 'tab-default', name: 'Layout 1', layout: WorkspaceLayoutManager.buildDefault() }];
  });

  // Active tab ID state
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const rawActiveId = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return rawActiveId || 'tab-default';
  });

  // The active layout being displayed/edited
  const [layout, setLayout] = useState<WorkspaceLayout>(() => {
    try {
      const rawActiveId = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || 'tab-default';
      const rawTabs = localStorage.getItem(TABS_STORAGE_KEY);
      if (rawTabs) {
        const parsed = JSON.parse(rawTabs) as WorkspaceTab[];
        const active = parsed.find(t => t.id === rawActiveId) || parsed[0];
        if (active) return active.layout;
      }
      const legacyLayout = localStorage.getItem('satan_workspace_layout');
      if (legacyLayout) {
        return JSON.parse(legacyLayout) as WorkspaceLayout;
      }
    } catch (e) {}
    return WorkspaceLayoutManager.buildDefault();
  });

  // Snapshot of layout before entering builder mode (for cancel)
  const [savedLayout, setSavedLayout] = useState<WorkspaceLayout | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [gridOpacity, setGridOpacity] = useState<'off' | 'low' | 'medium'>('low');
  const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>([]);

  // Configurable builder options (Keyboard Nudging and Mouse Multi-Select)
  const [nudgeEnabled, setNudgeEnabled] = useState<boolean>(() => {
    return localStorage.getItem('satan_workspace_nudge_enabled') !== 'false';
  });
  const [multiSelectMouse, setMultiSelectMouse] = useState<boolean>(() => {
    return localStorage.getItem('satan_workspace_multi_select_mouse') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('satan_workspace_nudge_enabled', nudgeEnabled.toString());
  }, [nudgeEnabled]);

  useEffect(() => {
    localStorage.setItem('satan_workspace_multi_select_mouse', multiSelectMouse.toString());
  }, [multiSelectMouse]);

  // Tab renaming states
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState<string>('');

  // ── Refs ──────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement>>({});
  const builderEngineRef = useRef<WorkspaceBuilderEngine | null>(null);

  // ── Scale Computation ─────────────────────────────────────────────────
  const scale = 1;

  // Spacing & collision validation
  const validation = useMemo(() => {
    return validateSpacing(layout.panels, layout.visibility, containerSize.w, containerSize.h);
  }, [layout, containerSize]);

  // ── Container ResizeObserver ──────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Builder Engine Lifecycle ──────────────────────────────────────────
  useEffect(() => {
    if (editMode === 'builder') {
      const engine = new WorkspaceBuilderEngine({
        onCommit: (panelId, rect) => {
          setLayout((prev) => WorkspaceLayoutManager.updatePanelRect(prev, panelId, rect));
        },
        onCommitMulti: (commits) => {
          setLayout((prev) => {
            let next = prev;
            for (const [id, rect] of Object.entries(commits)) {
              next = WorkspaceLayoutManager.updatePanelRect(next, id, rect);
            }
            return next;
          });
        },
        getPanelRects: () => {
          const rects: Record<string, Rect> = {};
          for (const id of Object.keys(layout.panels)) {
            const entry = layout.panels[id];
            if (entry) {
              rects[id] = {
                x: entry.x,
                y: entry.y,
                w: entry.w,
                h: entry.h,
              };
            }
          }
          return rects as Record<PanelId, Rect>;
        },
        getVisibility: () => layout.visibility as Record<PanelId, boolean>,
        getScale: () => 1,
        getCanvasSize: () => ({ w: containerSize.w, h: containerSize.h }),
        getSelectedPanelIds: () => selectedPanelIds,
      });

      if (overlayCanvasRef.current) {
        engine.attachOverlay(overlayCanvasRef.current);
      }

      builderEngineRef.current = engine;
      return () => {
        engine.destroy();
        builderEngineRef.current = null;
      };
    }
  }, [editMode, layout, containerSize.w, containerSize.h, selectedPanelIds]);

  // ── Computed Styles ───────────────────────────────────────────────────
  const panelStyles = useMemo(() => computePanelStyles(layout), [layout]);

  // ── Drag / Resize Handlers ────────────────────────────────────────────
  const handleDragStart = useCallback(
    (panelId: string, e: React.PointerEvent) => {
      const engine = builderEngineRef.current;
      const el = panelRefs.current[panelId];
      if (!engine || !el) return;
      engine.startDrag(panelId as PanelId, el, e.clientX, e.clientY);
    },
    []
  );

  const handleResizeStart = useCallback(
    (panelId: string, edge: string, e: React.PointerEvent) => {
      const engine = builderEngineRef.current;
      const el = panelRefs.current[panelId];
      if (!engine || !el) return;
      engine.startResize(panelId as PanelId, edge as ResizeEdge, el, e.clientX, e.clientY);
    },
    []
  );

  // ── Mode Transitions ─────────────────────────────────────────────────
  const handleModeChange = useCallback((mode: EditMode) => {
    if (mode === 'builder' && editMode === 'runtime') {
      // Entering builder: save snapshot for cancel
      setSavedLayout({ ...layout });
    }
    setEditMode(mode);
  }, [editMode, layout]);

  // ── Tab Management Callbacks ─────────────────────────────────────────

  const handleSwitchTab = useCallback((tabId: string) => {
    if (activeTabId === tabId) return;

    // Save current layout changes to the tabs list first (so builder mode edits aren't lost when switching tabs)
    setTabs(prev => {
      const updated = prev.map(t => t.id === activeTabId ? { ...t, layout: layout } : t);
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    setActiveTabId(tabId);
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tabId);
    
    // Read directly from state tab layout
    const target = tabs.find(t => t.id === tabId);
    if (target) {
      setLayout(target.layout);
    }
  }, [activeTabId, layout, tabs]);

  const handleAddTab = useCallback(() => {
    const newId = `tab-${Date.now()}`;
    let index = 1;
    while (tabs.some(t => t.name === `Layout ${index}`)) {
      index++;
    }
    const newName = `Layout ${index}`;
    const newTab: WorkspaceTab = {
      id: newId,
      name: newName,
      layout: WorkspaceLayoutManager.buildDefault()
    };
    const updated = [...tabs, newTab];
    setTabs(updated);
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(updated));
    
    // Switch to new tab immediately
    setActiveTabId(newId);
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, newId);
    setLayout(newTab.layout);
  }, [tabs]);

  const handleDeleteTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      alert("Cannot delete the last remaining workspace layout tab.");
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete the layout tab "${tabs.find(t => t.id === tabId)?.name}"?`);
    if (!confirmed) return;

    const updated = tabs.filter(t => t.id !== tabId);
    setTabs(updated);
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(updated));

    if (activeTabId === tabId) {
      const nextActive = updated[0];
      setActiveTabId(nextActive.id);
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, nextActive.id);
      setLayout(nextActive.layout);
    }
  }, [tabs, activeTabId]);

  const handleRenameTabSubmit = useCallback((tabId: string) => {
    if (!renameText.trim()) {
      setRenamingTabId(null);
      return;
    }
    const updated = tabs.map(t => t.id === tabId ? { ...t, name: renameText.trim() } : t);
    setTabs(updated);
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(updated));
    setRenamingTabId(null);
  }, [tabs, renameText]);

  // ── Save/Cancel Actions ──────────────────────────────────────────────

  const handleApply = useCallback(() => {
    // 1. Update active tab's layout in tabs list
    const updatedTabs = tabs.map(t => t.id === activeTabId ? { ...t, layout: layout } : t);
    setTabs(updatedTabs);
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(updatedTabs));
    // Backwards compatibility legacy save
    WorkspaceLayoutManager.saveLayoutImmediate(layout);

    setSavedLayout(null);
    setEditMode('runtime');
  }, [layout, tabs, activeTabId]);

  const handleCancel = useCallback(() => {
    if (savedLayout) {
      setLayout(savedLayout);
    }
    setSavedLayout(null);
    setEditMode('runtime');
  }, [savedLayout]);

  const handleReset = useCallback(() => {
    const defaultLayout = WorkspaceLayoutManager.resetLayout();
    setLayout(defaultLayout);
  }, []);

  const handleExport = useCallback(() => {
    const json = WorkspaceLayoutManager.exportLayout(layout);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satan-layout-v${layout.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [layout]);

  const handleImport = useCallback((json: string) => {
    try {
      const imported = WorkspaceLayoutManager.importLayout(json);
      setLayout(imported);
    } catch (e: any) {
      console.error('[WorkspaceCanvas] Import failed:', e.message);
      alert(`Layout import failed: ${e.message}`);
    }
  }, []);

  const isBuilder = editMode === 'builder';
  const isPreview = editMode === 'preview';

  const handleToggleVisibility = useCallback((panelId: string) => {
    setLayout((prev) => WorkspaceLayoutManager.toggleVisibility(prev, panelId));
  }, []);

  const handleAddCustomSection = useCallback((type: 'note' | 'iframe' | 'macros') => {
    const id = `custom_${Date.now()}`;
    const defaultLabels = {
      note: 'NOTES CARD',
      iframe: 'EMBEDDED WEB PAGE',
      macros: 'BUTTON MACROS',
    };

    const name = window.prompt(
      `Enter a name for your new ${type === 'note' ? 'Notes' : type === 'iframe' ? 'Web Page' : 'Macros'} section:`,
      defaultLabels[type]
    );
    if (name === null) return; // cancelled

    const label = name.trim().toUpperCase() || defaultLabels[type];

    const newCustomPanel: CustomPanelDefinition = {
      id,
      label,
      type,
      ...(type === 'note' ? { noteText: '' } : {}),
      ...(type === 'iframe' ? { iframeUrl: 'https://example.com' } : {}),
      ...(type === 'macros' ? { customMacros: [] } : {}),
    };

    setLayout((prev) => {
      const customPanels = prev.customPanels || {};
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [id]: {
            x: 380,
            y: 200,
            w: 400,
            h: 240,
            zIndex: 20,
          },
        },
        visibility: {
          ...prev.visibility,
          [id]: true,
        },
        customPanels: {
          ...customPanels,
          [id]: newCustomPanel,
        },
      };
    });
  }, []);

  const handleDeleteCustomPanel = useCallback((panelId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this custom panel?");
    if (!confirmed) return;
    setLayout((prev) => {
      const newPanels = { ...prev.panels };
      delete newPanels[panelId];

      const newVisibility = { ...prev.visibility };
      delete newVisibility[panelId];

      const newCustomPanels = { ...prev.customPanels };
      delete newCustomPanels[panelId];

      return {
        ...prev,
        panels: newPanels,
        visibility: newVisibility,
        customPanels: newCustomPanels,
      };
    });
    setSelectedPanelIds((prev) => prev.filter((id) => id !== panelId));
  }, []);

  const handleUpdateCustomPanel = useCallback((panelId: string, updatedDef: CustomPanelDefinition) => {
    setLayout((prev) => {
      if (!prev.customPanels || !prev.customPanels[panelId]) return prev;
      return {
        ...prev,
        customPanels: {
          ...prev.customPanels,
          [panelId]: updatedDef,
        },
      };
    });
  }, []);

  const handleManualResize = useCallback(
    (panelId: string, size: { w?: number; h?: number }) => {
      setLayout((prev) => {
        const current = prev.panels[panelId];
        if (!current) return prev;

        let minWidth = 200;
        let minHeight = 120;
        try {
          const def = PanelRegistry.get(panelId as PanelId);
          minWidth = def.minWidth;
          minHeight = def.minHeight;
        } catch (e) {
          // Dynamic panels use default min dimensions
        }

        const w = size.w !== undefined ? Math.max(size.w, minWidth) : current.w;
        const h = size.h !== undefined ? Math.max(size.h, minHeight) : current.h;

        const proposedRect = { ...current, w, h };
        const clamped = clampToCanvas(proposedRect, containerSize.w, containerSize.h);

        return WorkspaceLayoutManager.updatePanelRect(prev, panelId, clamped);
      });
    },
    [containerSize.w, containerSize.h]
  );

  // ── Keyboard Nudging (Arrow Keys) ────────────────────────────────────
  useEffect(() => {
    if (editMode !== 'builder' || selectedPanelIds.length === 0 || !nudgeEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
      if (!isArrow) return;

      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      e.preventDefault();

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;

      setLayout((prev) => {
        let next = prev;
        selectedPanelIds.forEach((id) => {
          const current = prev.panels[id];
          if (current) {
            const proposed = {
              x: current.x + dx,
              y: current.y + dy,
              w: current.w,
              h: current.h,
            };
            const clamped = clampToCanvas(proposed, containerSize.w, containerSize.h);
            next = WorkspaceLayoutManager.updatePanelRect(next, id, clamped);
          }
        });
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, selectedPanelIds, containerSize, nudgeEnabled]);

  // ── Visible Panels ────────────────────────────────────────────────────
  const visiblePanelIds = useMemo(() => {
    const registryIds = PanelRegistry.getAllIds().filter((id) => layout.visibility[id]);
    const customIds = layout.customPanels
      ? Object.keys(layout.customPanels).filter((id) => layout.visibility[id] !== false)
      : [];
    return [...registryIds, ...customIds] as string[];
  }, [layout.visibility, layout.customPanels]);

  const renderCustomPanelContent = (panelId: string) => {
    const customDef = layout.customPanels?.[panelId];
    if (!customDef) return null;

    return (
      <div className="h-full w-full bg-[#050608]/90 backdrop-blur-md border border-zinc-800/80 rounded-xl flex flex-col relative overflow-hidden">
        {/* Custom Panel Header (Inner header for runtime/preview/builder uniformity) */}
        <div className="h-9 flex items-center justify-between px-3 border-b border-zinc-800/60 shrink-0 bg-[#080a0e]/95 select-none">
          {isBuilder ? (
            <input
              type="text"
              value={customDef.label}
              onChange={(e) => {
                handleUpdateCustomPanel(panelId, {
                  ...customDef,
                  label: e.target.value.toUpperCase()
                });
              }}
              className="bg-transparent border-none text-[10px] font-bold text-zinc-400 font-mono focus:outline-none focus:text-white uppercase w-full p-0"
              title="Click to rename section"
            />
          ) : (
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase font-mono">{customDef.label}</span>
          )}
        </div>
        
        {/* Body content */}
        <div className="flex-1 overflow-hidden relative">
          {customDef.type === 'note' && (
            <NotePanel
              id={panelId}
              initialText={customDef.noteText || ''}
              onSave={(text) => {
                handleUpdateCustomPanel(panelId, {
                  ...customDef,
                  noteText: text,
                });
              }}
            />
          )}

          {customDef.type === 'iframe' && (
            <IframePanel
              id={panelId}
              initialUrl={customDef.iframeUrl || 'https://example.com'}
              isBuilderMode={isBuilder}
              onSave={(url) => {
                handleUpdateCustomPanel(panelId, {
                  ...customDef,
                  iframeUrl: url,
                });
              }}
            />
          )}

          {customDef.type === 'macros' && (
            <MacrosPanel
              id={panelId}
              macros={customDef.customMacros || []}
              isBuilderMode={isBuilder}
              onSave={(macros) => {
                handleUpdateCustomPanel(panelId, {
                  ...customDef,
                  customMacros: macros,
                });
              }}
              onSendSerialCommand={onSendSerialCommand}
            />
          )}
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={`workspace-root ${editMode === 'builder' ? 'workspace-builder-active' : editMode === 'preview' ? 'workspace-preview-active' : ''}`}>
      {/* Toolbar Container */}
      <div 
        className="workspace-toolbar-container"
        style={{
          display: 'flex',
          flexDirection: editMode === 'runtime' ? 'row' : 'column',
          alignItems: 'flex-start',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {/* Workspace Layout Profile Tabs */}
        <div className="workspace-tabs-list" style={{ marginBottom: 0 }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isRenaming = renamingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => !isRenaming && handleSwitchTab(tab.id)}
                className={`workspace-tab ${isActive ? 'workspace-tab-active' : ''}`}
                onDoubleClick={() => {
                  if (editMode === 'builder') {
                    setRenamingTabId(tab.id);
                    setRenameText(tab.name);
                  }
                }}
                title={editMode === 'builder' ? "Double click to rename tab" : `Switch to layout: ${tab.name}`}
              >
                {isRenaming ? (
                  <input
                    type="text"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onBlur={() => handleRenameTabSubmit(tab.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameTabSubmit(tab.id);
                      if (e.key === 'Escape') setRenamingTabId(null);
                    }}
                    autoFocus
                    className="workspace-tab-rename-input"
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span>{tab.name}</span>
                    {editMode === 'builder' && tabs.length > 1 && (
                      <span
                        className="workspace-tab-delete-btn"
                        onClick={(e) => handleDeleteTab(tab.id, e)}
                        title="Delete Layout Profile"
                      >
                        ✕
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {editMode === 'builder' && (
            <button
              onClick={handleAddTab}
              className="workspace-add-tab-btn"
              title="Add New Layout Profile"
            >
              +
            </button>
          )}
        </div>

        <WorkspaceToolbar
          editMode={editMode}
          layout={layout}
          onModeChange={handleModeChange}
          onApply={handleApply}
          onCancel={handleCancel}
          onReset={handleReset}
          onExport={handleExport}
          onImport={handleImport}
          onToggleVisibility={handleToggleVisibility}
          gridOpacity={gridOpacity}
          onGridOpacityChange={setGridOpacity}
          layoutScore={editMode !== 'runtime' ? validation.layoutScore : undefined}
          onAddCustomSection={handleAddCustomSection}
          nudgeEnabled={nudgeEnabled}
          onNudgeEnabledChange={setNudgeEnabled}
          multiSelectMouse={multiSelectMouse}
          onMultiSelectMouseChange={setMultiSelectMouse}
        />
      </div>

      {/* Canvas Container — fills available space */}
      <div
        ref={containerRef}
        className="workspace-canvas-container"
      >
        {/* Full-viewport blueprint grid background (builder mode only) */}
        {isBuilder && (
          <div
            className={`workspace-blueprint-grid grid-opacity-${gridOpacity}`}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              pointerEvents: 'none',
              transition: 'opacity 0.25s ease',
            }}
          />
        )}

        {/* Logical Canvas — fluid, edge-to-edge viewport boundaries */}
        <div
          id="workspace-logical-canvas"
          className={`workspace-logical-canvas canvas-${validation.status}`}
          onPointerDown={(e) => {
            if (isBuilder && e.target === e.currentTarget) {
              setSelectedPanelIds([]);
            }
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
          }}
        >

          {/* Builder overlay canvas for snap guides (z:55) */}
          {isBuilder && (
            <canvas
              ref={overlayCanvasRef}
              className="workspace-overlay-canvas"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 55,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Panel Wrappers */}
          {visiblePanelIds.map((panelId) => {
            const style = panelStyles[panelId];
            if (!style) return null;

            const engine = builderEngineRef.current;
            const isBeingDragged = engine && engine.getDraggedPanelId() === panelId;
            const dragRect = isBeingDragged ? engine.getCurrentDragRect() : null;

            const left = dragRect ? dragRect.x : style.left;
            const top = dragRect ? dragRect.y : style.top;
            const width = dragRect ? dragRect.w : style.width;
            const height = dragRect ? dragRect.h : style.height;

            const isBroken = validation.status === 'error' && validation.brokenPanels.includes(panelId);
            const isOffending = validation.status === 'warning' && validation.offendingPanels.includes(panelId);

            const isSelected = selectedPanelIds.includes(panelId);
            const isAtTopEdge = top < 32;

            let panelLabel = '';
            let panelZPriority: ZPriority = 'NORMAL';
            let panelResizable = true;
            const isCustom = layout.customPanels && layout.customPanels[panelId] !== undefined;

            if (isCustom) {
              const customDef = layout.customPanels![panelId];
              panelLabel = customDef.label;
              panelZPriority = 'NORMAL';
              panelResizable = true;
            } else {
              try {
                const def = PanelRegistry.get(panelId as PanelId);
                panelLabel = def.label;
                panelZPriority = def.zPriority;
                panelResizable = def.resizable;
              } catch (e) {
                panelLabel = panelId.toUpperCase();
                panelZPriority = 'NORMAL';
                panelResizable = true;
              }
            }

            return (
              <div
                key={panelId}
                ref={(el) => {
                  if (el) panelRefs.current[panelId] = el;
                }}
                className={`workspace-panel-wrapper ${isBuilder ? 'workspace-panel-editable' : ''} ${
                  isBroken ? 'panel-error-state' : isOffending ? 'panel-warning-state' : ''
                } ${isSelected ? 'panel-selected-state' : ''}`}
                style={{
                  position: 'absolute',
                  left: left,
                  top: top,
                  width: width,
                  height: height,
                  zIndex: isSelected ? 50 : style.zIndex,
                  willChange: isBuilder ? 'transform, left, top, width, height' : 'auto',
                  transition: isBuilder ? 'none' : 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease',
                }}
                onPointerDown={(e) => {
                  if (isBuilder) {
                    e.stopPropagation();
                    const isMulti = e.ctrlKey || e.shiftKey || e.metaKey || multiSelectMouse;
                    if (isMulti) {
                      setSelectedPanelIds((prev) =>
                        prev.includes(panelId) ? prev.filter((id) => id !== panelId) : [...prev, panelId]
                      );
                    } else {
                      if (!selectedPanelIds.includes(panelId)) {
                        setSelectedPanelIds([panelId]);
                      }
                    }
                  }
                }}
                data-panel-id={panelId}
                data-z-priority={panelZPriority}
              >
                {/* Builder chrome (drag header + resize handles) */}
                {isBuilder && (
                  <PanelBuilderChrome
                    panelId={panelId}
                    label={panelLabel}
                    zPriority={panelZPriority}
                    resizable={panelResizable}
                    width={width}
                    height={height}
                    onDragStart={handleDragStart}
                    onResizeStart={handleResizeStart}
                    onManualResize={handleManualResize}
                    isSelected={isSelected}
                    isAtTopEdge={isAtTopEdge}
                    isCustom={isCustom}
                    onDeleteCustom={handleDeleteCustomPanel}
                  />
                )}

                {/* Actual panel content */}
                <div
                  className="workspace-panel-content"
                  style={{
                    paddingTop: 0, // Header floats above, no layout offset shift
                  }}
                >
                  {panelContents[panelId as PanelId] || renderCustomPanelContent(panelId)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
