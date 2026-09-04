"use client";

import { useCallback } from "react";
import type { Card, Column, CreateCardInput, Frame, Point, Size } from "@openbento/domain";
import type { CatalogCall } from "@/lib/domain/inputs";
import {
  cardWorldBounds,
  membershipCallsForCards,
  planCardGeometry,
  planFrameGeometry,
  translateFrameMembers,
} from "@/lib/domain/membership";
import { persistCreatedCard } from "@/lib/domain/persist-created-card";
import { persistCreatedNoteCard } from "@/lib/domain/persist-created-note";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

function withFrameBounds(frames: Frame[], frameId: string, bounds: Frame["bounds"]): Frame[] {
  return frames.map((frame) =>
    frame.id === frameId ? { ...frame, bounds } : frame,
  );
}

export function useCanvasCommands() {
  const { snapshot, commit } = useWorkspace();

  const persistCardGeometry = useCallback(
    async (card: Card, next: { position?: Point; size?: Size }) => {
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
        await commit(calls);
      }
    },
    [commit, snapshot.frames],
  );

  const persistCreatedNote = useCallback(
    (input: CreateCardInput) =>
      persistCreatedNoteCard(commit, input, snapshot.frames),
    [commit, snapshot.frames],
  );

  const persistCreatedSource = useCallback(
    (input: CreateCardInput) => persistCreatedCard(commit, input, snapshot.frames),
    [commit, snapshot.frames],
  );

  const persistFrameMove = useCallback(
    async (frame: Frame, position: Point) => {
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
      for (const column of snapshot.columns) {
        if (column.frameId === frame.id) {
          calls.push({
            name: "moveColumn",
            input: {
              columnId: column.id,
              position: {
                x: column.bounds.x + dx,
                y: column.bounds.y + dy,
              },
            },
          });
        }
      }
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
      await commit(calls);
    },
    [commit, snapshot.cards, snapshot.columns, snapshot.frames],
  );

  const persistFrameResize = useCallback(
    async (frame: Frame, next: { position?: Point; size?: Size }) => {
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
        await commit(calls);
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

  const persistCreatedColumn = useCallback(
    (canvasId: string, position?: Point) =>
      commit([
        {
          name: "createColumn",
          input: { canvasId, ...(position ? { position } : {}) },
        },
      ]).then((results) => results[0] as Column),
    [commit],
  );

  const persistColumnMove = useCallback(
    async (column: Column, position: Point) => {
      if (
        position.x === column.bounds.x &&
        position.y === column.bounds.y
      ) {
        return;
      }
      await commit([
        { name: "moveColumn", input: { columnId: column.id, position } },
      ]);
    },
    [commit],
  );

  const persistColumnResize = useCallback(
    async (column: Column, next: { position?: Point; size: Size }) => {
      const calls: CatalogCall[] = [];
      if (
        next.position &&
        (next.position.x !== column.bounds.x ||
          next.position.y !== column.bounds.y)
      ) {
        calls.push({
          name: "moveColumn",
          input: { columnId: column.id, position: next.position },
        });
      }
      if (
        next.size.width !== column.bounds.width ||
        next.size.height !== column.bounds.height
      ) {
        calls.push({
          name: "resizeColumn",
          input: { columnId: column.id, size: next.size },
        });
      }
      if (calls.length) await commit(calls);
    },
    [commit],
  );

  const detachCardFromColumn = useCallback(
    (cardId: string, position: Point, size?: Size) =>
      commit([
        {
          name: "detachCardFromColumn",
          input: { cardId, position, ...(size ? { size } : {}) },
        },
      ]),
    [commit],
  );

  return {
    persistCardGeometry,
    persistCreatedNote,
    persistCreatedCard: persistCreatedSource,
    persistFrameMove,
    persistFrameResize,
    persistCreatedFrame,
    persistCreatedColumn,
    persistColumnMove,
    persistColumnResize,
    detachCardFromColumn,
    cardWorldBounds,
  };
}
