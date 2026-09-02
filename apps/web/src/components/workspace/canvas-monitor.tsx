"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Card, CardType, SourceType } from "@openbento/domain";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  cardMatchesMonitorFilter,
  emptyMonitorFilter,
  monitorFilterIsActive,
  type CanvasMonitorFilter,
} from "@/lib/canvas/card-search";
import {
  applyCanvasVisitChange,
  browserStorage,
  isCardNewSinceVisit,
  markCanvasSeen,
} from "@/lib/canvas/last-visit";

export type CanvasMonitorValue = {
  filter: CanvasMonitorFilter;
  setQuery: (query: string) => void;
  toggleType: (type: CardType) => void;
  toggleSourceType: (sourceType: SourceType) => void;
  setNewOnly: (newOnly: boolean) => void;
  clearFilter: () => void;
  isFiltered: boolean;
  newCardIds: ReadonlySet<string>;
  newCount: number;
  isCardNew: (cardId: string) => boolean;
  cardVisible: (card: Card) => boolean;
  markSeen: () => void;
};

const CanvasMonitorContext = createContext<CanvasMonitorValue | null>(null);

export function CanvasMonitorProvider({ children }: { children: ReactNode }) {
  const { snapshot } = useWorkspace();
  const canvasId = snapshot.currentCanvasId;
  const [filter, setFilter] = useState<CanvasMonitorFilter>(emptyMonitorFilter);
  const [baselineAt, setBaselineAt] = useState<string | null>(null);
  const previousCanvasId = useRef<string | null>(null);

  useEffect(() => {
    const next = applyCanvasVisitChange({
      storage: browserStorage(),
      previousCanvasId: previousCanvasId.current,
      nextCanvasId: canvasId,
      nowIso: new Date().toISOString(),
    });
    previousCanvasId.current = next.previousCanvasId;
    setBaselineAt(next.baselineAt);
    setFilter(emptyMonitorFilter());
  }, [canvasId]);

  const newCardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const card of snapshot.cards) {
      if (isCardNewSinceVisit(card, baselineAt)) {
        ids.add(card.id);
      }
    }
    return ids;
  }, [snapshot.cards, baselineAt]);

  const setQuery = useCallback((query: string) => {
    setFilter((current) => ({ ...current, query }));
  }, []);

  const toggleType = useCallback((type: CardType) => {
    setFilter((current) => {
      const has = current.types.includes(type);
      return {
        ...current,
        types: has
          ? current.types.filter((entry) => entry !== type)
          : [...current.types, type],
      };
    });
  }, []);

  const toggleSourceType = useCallback((sourceType: SourceType) => {
    setFilter((current) => {
      const has = current.sourceTypes.includes(sourceType);
      return {
        ...current,
        sourceTypes: has
          ? current.sourceTypes.filter((entry) => entry !== sourceType)
          : [...current.sourceTypes, sourceType],
      };
    });
  }, []);

  const setNewOnly = useCallback((newOnly: boolean) => {
    setFilter((current) => ({ ...current, newOnly }));
  }, []);

  const clearFilter = useCallback(() => {
    setFilter(emptyMonitorFilter());
  }, []);

  const markSeen = useCallback(() => {
    if (!canvasId) {
      return;
    }
    const next = markCanvasSeen(
      browserStorage(),
      canvasId,
      new Date().toISOString(),
    );
    setBaselineAt(next);
  }, [canvasId]);

  const cardVisible = useCallback(
    (card: Card) => cardMatchesMonitorFilter(card, filter, newCardIds),
    [filter, newCardIds],
  );

  const value = useMemo<CanvasMonitorValue>(
    () => ({
      filter,
      setQuery,
      toggleType,
      toggleSourceType,
      setNewOnly,
      clearFilter,
      isFiltered: monitorFilterIsActive(filter),
      newCardIds,
      newCount: newCardIds.size,
      isCardNew: (cardId: string) => newCardIds.has(cardId),
      cardVisible,
      markSeen,
    }),
    [
      filter,
      setQuery,
      toggleType,
      toggleSourceType,
      setNewOnly,
      clearFilter,
      newCardIds,
      cardVisible,
      markSeen,
    ],
  );

  return (
    <CanvasMonitorContext.Provider value={value}>
      {children}
    </CanvasMonitorContext.Provider>
  );
}

export function useCanvasMonitor(): CanvasMonitorValue {
  const value = useContext(CanvasMonitorContext);
  if (!value) {
    throw new Error("useCanvasMonitor must be used within CanvasMonitorProvider");
  }
  return value;
}

export function useCanvasMonitorOptional(): CanvasMonitorValue | null {
  return useContext(CanvasMonitorContext);
}
