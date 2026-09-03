"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  clampMenuPosition,
  type ContextMenuItem,
  type ContextMenuItemId,
} from "@/lib/canvas/context-menu";

export type CanvasContextMenuState = {
  clientX: number;
  clientY: number;
  items: ContextMenuItem[];
};

export function CanvasContextMenu({
  state,
  onClose,
  onAction,
}: {
  state: CanvasContextMenuState | null;
  onClose: () => void;
  onAction: (id: ContextMenuItemId) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  useLayoutEffect(() => {
    if (!state) {
      return;
    }
    const menu = menuRef.current;
    const width = menu?.offsetWidth ?? 220;
    const height = menu?.offsetHeight ?? Math.max(40, state.items.length * 36);
    setPosition(
      clampMenuPosition(
        { x: state.clientX, y: state.clientY },
        { width, height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
    setActiveIndex(0);
    menu?.focus();
  }, [state]);

  useEffect(() => {
    if (!state) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!state) {
        return;
      }
      const enabled = state.items
        .map((item, index) => ({ item, index }))
        .filter((entry) => !entry.item.disabled);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (enabled.length === 0) {
          return;
        }
        setActiveIndex((current) => {
          const position = enabled.findIndex((entry) => entry.index === current);
          const next =
            event.key === "ArrowDown"
              ? enabled[(position + 1 + enabled.length) % enabled.length]
              : enabled[
                  (position - 1 + enabled.length) % enabled.length
                ];
          return next?.index ?? current;
        });
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(enabled[0]?.index ?? 0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(enabled[enabled.length - 1]?.index ?? 0);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const item = state.items[activeIndex];
        if (item && !item.disabled) {
          onAction(item.id);
        }
      }
    }
    function onPointerDown(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu && event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [state, activeIndex, onAction, onClose]);

  if (!state || state.items.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label="Canvas actions"
      className="fixed z-50 min-w-48 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-1 text-zinc-100 shadow-xl outline-none"
      style={{ left: position.x, top: position.y }}
    >
      {state.items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          id={`canvas-menu-${item.id}`}
          aria-disabled={item.disabled || undefined}
          disabled={item.disabled}
          tabIndex={index === activeIndex ? 0 : -1}
          className={cn(
            "flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-left text-sm outline-none",
            item.disabled
              ? "cursor-not-allowed text-zinc-600"
              : "text-zinc-100 hover:bg-zinc-800",
            index === activeIndex && !item.disabled ? "bg-zinc-800" : null,
          )}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => {
            if (!item.disabled) {
              onAction(item.id);
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
