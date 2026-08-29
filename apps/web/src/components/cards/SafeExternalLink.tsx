import { safeHttpUrl, sanitizeUntrustedDisplayText } from "@/lib/untrusted";
import { UntrustedText } from "./UntrustedText";

/**
 * Source URL as a sanitized http(s) link, or plain text when the href is unsafe.
 * Label is untrusted text — never raw HTML from the source.
 */
export function SafeExternalLink({
  href,
  className,
  children,
}: {
  href: unknown;
  className?: string;
  children?: unknown;
}) {
  const safe = safeHttpUrl(href);
  const label =
    typeof children === "string" || children == null
      ? sanitizeUntrustedDisplayText(children ?? href)
      : null;
  if (!safe) {
    return <UntrustedText value={label ?? href} className={className} />;
  }
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {label}
    </a>
  );
}
