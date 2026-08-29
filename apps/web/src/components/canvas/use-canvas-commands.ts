"use client";

import { useCallback } from "react";
import type { Card, Frame, Point, Size } from "@openbento/domain";
import type { CatalogCall } from "@/lib/domain/inputs";
import {
  cardWorldBounds,
  membershipCallsForCards,
  resolveCardFrameMembership,
} from "@/lib/domain/membership";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

function withFrameBounds(frames: Frame[], frameId: string, bounds: Frame["bounds"]): Frame[] {
  return frames.map((frame) =>
    frame.id === frameId ? { ...frame, bounds } : frame,
  );
}

export function useCanvasCommands() {
  const { snapshot, commit } = useWorkspace();

  const persistCardGeometry = useCallback(
    (card: Card, next: { position?: Point; size?: Size }) => {
      const position = next.position ?? card.position;
      const size = next.size ?? card.size;
      const calls: CatalogCall[] = [];
      if (
        next.position &&
        (next.position.x !== card.position.x || next.position.y !== card.position.y)
      ) {
        calls.push({
          name: "moveCard",
          input: { cardId: card.id, position },
        });
      }
      if (
        next.size &&
        (next.size.width !== card.size.width || next.size.height !== card.size.height)
      ) {
        calls.push({
          name: "resizeCard",
          input: { cardId: card.id, size },
        });
      }
      const frameId = resolveCardFrameMembership(
        { ...position, ...size },
        snapshot.frames,
      );
      if ((card.frameId ?? null) !== frameId) {
        calls.push({
          name: "setCardFrame",
          input: { cardId: card.id, frameId },
        });
      }
      if (calls.length > 0) {
        void commit(calls);
      }
    },
    [commit, snapshot.frames],
  );

  const persistFrameMove = useCallback(
    (frame: Frame, position: Point) => {
      const dx = position.x - frame.bounds.x;
      const dy = position.y - frame.bounds.y;
      if (dx === 0 && dy === 0) {
        return;
      }
      const calls: CatalogCall[] = [
        { name: "moveFrame", input: { frameId: frame.id, position } },
      ];
      const movedMembers: Card[] = [];
      for (const card of snapshot.cards) {
        if (card.frameId !== frame.id) {
          continue;
        }
        const nextPosition = {
          x: card.position.x + dx,
          y: card.position.y + dy,
        };
        movedMembers.push({ ...card, position: nextPosition });
        calls.push({
          name: "moveCard",
          input: { cardId: card.id, position: nextPosition },
        });
      }
      const nextFrames = withFrameBounds(snapshot.frames, frame.id, {
        ...frame.bounds,
        x: position.x,
        y: position.y,
      });
      const others = snapshot.cards.filter((card) => card.frameId !== frame.id);
      for (const change of membershipCallsForCards(others, nextFrames)) {
        calls.push({ name: "setCardFrame", input: change });
      }
      void commit(calls);
    },
    [commit, snapshot.cards, snapshot.frames],
  );

  const persistFrameResize = useCallback(
    (frame: Frame, size: Size) => {
      if (size.width === frame.bounds.width && size.height === frame.bounds.height) {
        return;
      }
      const nextFrames = withFrameBounds(snapshot.frames, frame.id, {
        ...frame.bounds,
        width: size.width,
        height: size.height,
      });
      const calls: CatalogCall[] = [
        { name: "resizeFrame", input: { frameId: frame.id, size } },
      ];
      for (const change of membershipCallsForCards(snapshot.cards, nextFrames)) {
        calls.push({ name: "setCardFrame", input: change });
      }
      void commit(calls);
    },
    [commit, snapshot.cards, snapshot.frames],
  );

  const persistCreatedFrame = useCallback(
    async (canvasId: string, bounds: Frame["bounds"], name?: string) => {
      const created = await commit([
        { name: "createFrame", input: { canvasId, bounds, name } },
      ]);
      const frame = created[0] as Frame;
      const nextFrames = [...snapshot.frames, frame];
      const membership = membershipCallsForCards(snapshot.cards, nextFrames);
      if (membership.length > 0) {
        await commit(
          membership.map((change) => ({
            name: "setCardFrame" as const,
            input: change,
          })),
        );
      }
      return frame;
    },
    [commit, snapshot.cards, snapshot.frames],
  );

  return {
    persistCardGeometry,
    persistFrameMove,
    persistFrameResize,
    persistCreatedFrame,
    cardWorldBounds,
  };
}
