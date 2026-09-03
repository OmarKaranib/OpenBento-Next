import { UntrustedText } from "@/components/cards/UntrustedText";
import {
  resolveWatchBotLabel,
  type WatchBotLabelSource,
} from "@/lib/canvas/watchbot-attribution";

/**
 * Visible WatchBot attribution from snapshot data only.
 * Renders sanitized text — never HTML.
 */
export function WatchBotAttribution({
  watchBotId,
  watchBots,
}: {
  watchBotId?: string;
  watchBots: readonly WatchBotLabelSource[];
}) {
  const label = resolveWatchBotLabel(watchBotId, watchBots);
  if (!label) {
    return null;
  }
  return (
    <p className="text-[11px] text-zinc-500">
      Added by <UntrustedText value={label} />
    </p>
  );
}
