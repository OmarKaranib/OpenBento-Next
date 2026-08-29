/**
 * Future @xyflow/react mount. Not imported by the placeholder page.
 *
 * When wired (later phase):
 * - Dark infinite dotted canvas
 * - Zoom is navigation only — never semantic zoom / IA changes
 * - Cards and Frames are world objects, not zoom levels
 * - Mutations go through @openbento/domain actions
 */

export function CanvasRoot(): null {
  return null;
}

// Dependency is declared on `web` (`@xyflow/react`). Import it here only when
// this file is mounted. Do not add a live graph in the scaffold.
