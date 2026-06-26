# SATAN — Version v1.1.0 Release Notes

**Release Date:** June 27, 2026  
**Author:** mxsourav  
**Target Platform:** Universal ESP32 Microcontrollers  

---

## What's New in v1.1.0

### 1. Multi-Profile Layout Switcher (Tabs)
- Interactive profile manager allowing users to add, switch, rename, and delete layout profiles directly from the tab manager bar.
- Automatically saves and persists profile configurations across sessions.

### 2. Mouse Multi-Selection Mode
- Added support for selecting multiple cards/panels using standard mouse clicks without requiring Ctrl/Shift/Meta modifier keys.
- Toggleable via the `MULTI-SELECT` button in the builder toolbar.

### 3. Keyboard Arrow Key Navigation
- Move selected panels using the Arrow keys by `1px` (or `10px` when holding `Shift`).
- Toggleable via the `KEYS MOVE` control button in the builder toolbar.

### 4. Figma-Style Smart Snapping
- Automatically aligns and snaps margins to 16px and 24px when cards are dragged near adjacent panels.
- Renders spacing guide lines, alignment axes, and distance indicators.

### 5. Layout Safety & Health Score
- Calculates layout balance in real-time from 0-100% based on overlaps, out-of-bounds positioning, and uneven margins.
- Displays quality borders: Green (Valid), Yellow (Warning), and Red (Error).

### 6. Interactive System Architecture Map
- Embedded a high-fidelity logical structure visualizer into the System About panel.
- Details Client (React/TS), WebSerial API bridge layer, ESP32 Microcontroller Core, and remote API hosting architecture.

---

## Versioning Checklist & Status
- [x] Package Configuration: Bumbed version to `1.1.0` in `package.json`
- [x] Workspace Engine: Updated `SATAN_VERSION` to `1.1.0` in `WorkspaceLayoutManager.ts`
- [x] User Interface: Set version code to `v1.1.0` in the `satanHeader` panel
- [x] Documentation: Updated timeline references in `upcoming_updates.txt`
