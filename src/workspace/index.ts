// ============================================================================
// workspace/index.ts — Barrel export for the workspace engine.
// ============================================================================

export { PanelRegistry, CANVAS_WIDTH, CANVAS_HEIGHT } from './PanelRegistry';
export type { PanelId, PanelDefinition, ZPriority, Rect, PanelRenderProps } from './PanelRegistry';

export { WorkspaceLayoutManager } from './WorkspaceLayoutManager';
export type { WorkspaceLayout, PanelLayoutEntry, WorkflowMeta } from './WorkspaceLayoutManager';

export { WorkspaceCollisionManager } from './WorkspaceCollisionManager';
export { snapPosition, snapResize } from './WorkspaceSnapEngine';
export type { SnapResult, SnapGuide, SpacingIndicator, AlignGroup } from './WorkspaceSnapEngine';

export { computePanelStyles, computeCanvasScale, computeOLEDCanvasSize } from './WorkspaceRuntimeEngine';
export { WorkspaceBuilderEngine } from './WorkspaceBuilderEngine';

export { default as WorkspaceCanvas } from './WorkspaceCanvas';
export { default as WorkspaceToolbar } from './WorkspaceToolbar';
export type { EditMode } from './WorkspaceToolbar';
export { default as PanelBuilderChrome } from './PanelBuilderChrome';
