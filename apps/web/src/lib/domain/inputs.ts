import type {
  ActionInputMap,
  ActionName,
  ActionResultMap,
} from "@openbento/domain";

/**
 * Catalog call batch. Inputs are `ActionInputMap` from `@openbento/domain`
 * (`packages/domain/src/actions.ts`, PR #4). Do not invent UI request types.
 */
export type ActionInputByName = ActionInputMap;

export type CatalogCall<N extends ActionName = ActionName> = {
  [K in N]: { name: K; input: ActionInputMap[K] };
}[N];

export type CatalogResult<N extends ActionName> = ActionResultMap[N];
