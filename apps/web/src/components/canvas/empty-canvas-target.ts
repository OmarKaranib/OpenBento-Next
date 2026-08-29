/**
 * Empty-canvas hit test for Note creation.
 *
 * Playwright and real clicks often land on the pane *or* a child (Background
 * SVG/pattern), not an HTMLElement whose classList is exactly `react-flow__pane`.
 * Do not require HTMLElement. Do not stopPropagation / preventDefault — the
 * pane must keep pan/zoom. Callers should set `zoomOnDoubleClick={false}` so
 * XYFlow does not consume the double-click for camera zoom.
 */

const IGNORE_SELECTOR =
  ".react-flow__node, .react-flow__handle, .react-flow__edge, .react-flow__edgeupdater";

type ClosestHost = {
  closest: (selector: string) => unknown;
};

function hasClosest(target: unknown): target is ClosestHost {
  return (
    typeof target === "object" &&
    target !== null &&
    "closest" in target &&
    typeof (target as ClosestHost).closest === "function"
  );
}

function asClosestHost(target: EventTarget | null): ClosestHost | null {
  if (hasClosest(target)) {
    return target;
  }
  if (
    typeof target === "object" &&
    target !== null &&
    "parentElement" in target &&
    hasClosest((target as { parentElement: unknown }).parentElement)
  ) {
    return (target as { parentElement: ClosestHost }).parentElement;
  }
  return null;
}

export function isEmptyCanvasPointerTarget(target: EventTarget | null): boolean {
  const host = asClosestHost(target);
  if (!host) {
    return false;
  }
  if (host.closest(IGNORE_SELECTOR)) {
    return false;
  }
  return host.closest(".react-flow__pane") != null;
}

export function canvasDoubleClickShouldCreateNote(args: {
  target: EventTarget | null;
  readOnly: boolean;
  frameToolActive: boolean;
}): boolean {
  if (args.readOnly || args.frameToolActive) {
    return false;
  }
  return isEmptyCanvasPointerTarget(args.target);
}
