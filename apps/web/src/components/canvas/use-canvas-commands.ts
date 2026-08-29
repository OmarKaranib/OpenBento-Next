"use client";

import { useCallback } from "react";
import type { Card, CreateCardInput, Frame, Point, Size } from "@openbento/domain";
import type { CatalogCall } from "@/lib/domain/inputs";
import {
  cardWorldBounds,
  membershipCallsForCards,
  planCardGeometry,
  planFrameGeometry,
  translateFrameMembers,
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
      const plan = planCardGeometry(card, next, snapshot.frames);
      const calls: CatalogCall[] = [];
      if (plan.move) {
        calls.push({ name: "moveCard", input: plan.move });
      }
      if (plan.resize) {
        calls.push({ name: "resizeCard", input: plan.resize });
      }
      if (plan.membership) {
        calls.push({ name: "setCardFrame", input: plan.membership });
      }
      if (calls.length > 0) {
        void commit(calls);
      }
    },
    [commit, snapshot.frames],
  );

  const persistCreatedNote = useCallback(
    async (input: CreateCardInput) => {
      const created = await commit([{ name: "createCard", input }]);
      const card = created[0] as Card;
      const membership = membershipCallsForCards([card], snapshot.frames);
      if (membership.length > 0) {
        await commit(
          membership.map((change) => ({
            name: "setCardFrame" as const,
            input: change,
          })),
        );
      }
      return card;
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
      const nextFrames = withFrameBounds(snapshot.frames, frame.id, {
        ...frame.bounds,
        x: position.x,
        y: position.y,
      });
      const nextCards = translateFrameMembers(snapshot.cards, frame.id, {
        x: dx,
        y: dy,
      });
      const calls: CatalogCall[] = [
        { name: "moveFrame", input: { frameId: frame.id, position } },
      ];
      for (const card of nextCards) {
        const previous = snapshot.cards.find((entry) => entry.id === card.id);
        if (
          !previous ||
          (card.position.x === previous.position.x &&
            card.position.y === previous.position.y)
        ) {
          continue;
        }
        calls.push({
          name: "moveCard",
          input: { cardId: card.id, position: card.position },
        });
      }
      for (const change of membershipCallsForCards(nextCards, nextFrames)) {
        calls.push({ name: "setCardFrame", input: change });
      }
      void commit(calls);
    },
    [commit, snapshot.cards, snapshot.frames],
  );

  const persistFrameResize = useCallback(
    (frame: Frame, next: { position?: Point; size?: Size }) => {
      const plan = planFrameGeometry(
        frame,
        next,
        snapshot.cards,
        snapshot.frames,
      );
      const calls: CatalogCall[] = [];
      if (plan.move) {
        calls.push({ name: "moveFrame", input: plan.move });
      }
      if (plan.resize) {
        calls.push({ name: "resizeFrame", input: plan.resize });
      }
      for (const change of plan.membership) {
        calls.push({ name: "setCardFrame", input: change });
      }
      if (calls.length > 0) {
        void commit(calls);
      }
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
    persistCreatedNote,
    persistFrameMove,
    persistFrameResize,
    persistCreatedFrame,
    cardWorldBounds,
  };
}
