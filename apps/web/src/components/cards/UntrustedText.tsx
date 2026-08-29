import { sanitizeUntrustedDisplayText } from "@/lib/untrusted";

/**
 * Render untrusted titles/snippets as text nodes only.
 * Never uses innerHTML, srcDoc, or eval.
 */
export function UntrustedText({
  value,
  className,
  as: Tag = "span",
}: {
  value: unknown;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  return <Tag className={className}>{sanitizeUntrustedDisplayText(value)}</Tag>;
}
