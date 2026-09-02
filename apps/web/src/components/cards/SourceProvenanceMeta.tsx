import type { Card } from "@openbento/domain";
import { SafeExternalLink } from "@/components/cards/SafeExternalLink";
import { UntrustedText } from "@/components/cards/UntrustedText";
import { provenanceDisplay } from "@/lib/canvas/provenance-display";
import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";

/**
 * Sourced Card identity: kind is shown by chrome; this row is URL + known dates.
 * Missing publishedAt/discoveredAt stay empty. Untrusted strings are text only.
 */
export function SourceProvenanceMeta({
  card,
  author,
}: {
  card: Card;
  author?: string;
}) {
  const identity = provenanceDisplay(card);
  if (!identity) {
    return null;
  }
  const cleanedAuthor = sanitizeUntrustedDisplayText(author ?? "", 120);
  const hasDates = Boolean(identity.publishedAt || identity.discoveredAt);
  const hasMeta = Boolean(cleanedAuthor || hasDates);

  return (
    <div className="flex flex-col gap-0.5">
      {identity.href || identity.displayUrl ? (
        <SafeExternalLink
          href={identity.href ?? identity.displayUrl}
          className="nodrag nopan truncate text-[11px] text-indigo-300 hover:text-indigo-200"
        />
      ) : null}
      {hasMeta ? (
        <p className="text-[11px] text-zinc-500">
          {cleanedAuthor ? <UntrustedText value={cleanedAuthor} /> : null}
          {cleanedAuthor && hasDates ? " · " : null}
          {identity.publishedAt ? (
            <span>Published {identity.publishedAt}</span>
          ) : null}
          {identity.publishedAt && identity.discoveredAt ? " · " : null}
          {identity.discoveredAt ? (
            <span>Discovered {identity.discoveredAt}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
