"use client";

import { useCallback } from "react";
import type { Card, Column, CreateCardInput, Point, Size } from "@openbento/domain";
import type { CatalogCall } from "@/lib/domain/inputs";
import { cardWorldBounds, planCardGeometry } from "@/lib/domain/membership";
import { persistCreatedCard } from "@/lib/domain/persist-created-card";
import { persistCreatedNoteCard } from "@/lib/domain/persist-created-note";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

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
    persistCreatedColumn,
    persistColumnMove,
    persistColumnResize,
    detachCardFromColumn,
    cardWorldBounds,
  };
}
