import type { Card } from "@openbento/domain";
import { SafeExternalLink } from "@/components/cards/SafeExternalLink";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { WatchBotAttribution } from "@/components/cards/WatchBotAttribution";
import {
  cardWatchBotId,
  type WatchBotLabelSource,
} from "@/lib/canvas/watchbot-attribution";
import { provenanceDisplay } from "@/lib/canvas/provenance-display";
import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";

/**
 * Sourced Card identity: kind is shown by chrome; this row is URL + known dates.
 * Missing publishedAt/discoveredAt stay empty. Untrusted strings are text only.
 * WatchBot attribution is snapshot-only when watchBotId is present.
 */
export function SourceProvenanceMeta({
  card,
  author,
  watchBots,
}: {
  card: Card;
  author?: string;
  watchBots?: readonly WatchBotLabelSource[];
}) {
  const identity = provenanceDisplay(card);
  const watchBotId = cardWatchBotId(card);
  const showWatchBot = Boolean(watchBots && watchBotId);
  if (!identity && !showWatchBot) {
    return null;
  }
  const cleanedAuthor = sanitizeUntrustedDisplayText(author ?? "", 120);
  const hasDates = Boolean(identity?.publishedAt || identity?.discoveredAt);
  const hasMeta = Boolean(cleanedAuthor || hasDates);

  return (
    <div className="flex flex-col gap-0.5">
      {identity?.href || identity?.displayUrl ? (
        <SafeExternalLink
          href={identity.href ?? identity.displayUrl}
          className="nodrag nopan truncate text-[11px] text-indigo-300 hover:text-indigo-200"
        />
      ) : null}
      {hasMeta ? (
        <p className="text-[11px] text-zinc-500">
          {cleanedAuthor ? <UntrustedText value={cleanedAuthor} /> : null}
          {cleanedAuthor && hasDates ? " · " : null}
          {identity?.publishedAt ? (
            <span>Published {identity.publishedAt}</span>
          ) : null}
          {identity?.publishedAt && identity?.discoveredAt ? " · " : null}
          {identity?.discoveredAt ? (
            <span>Discovered {identity.discoveredAt}</span>
          ) : null}
        </p>
      ) : null}
      {watchBots ? (
        <WatchBotAttribution watchBotId={watchBotId ?? undefined} watchBots={watchBots} />
      ) : null}
    </div>
  );
}
