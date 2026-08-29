import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeExternalLink } from "../components/cards/SafeExternalLink";
import { UntrustedText } from "../components/cards/UntrustedText";
import {
  hostnameFromHttpUrl,
  safeHttpUrl,
  sanitizeUntrustedDisplayText,
} from "./untrusted";

const XSS_TITLE = `<img src=x onerror="alert(1)"><script>alert("xss")</script>`;
const XSS_URL = `javascript:alert(1)`;

describe("untrusted source display", () => {
  it("strips HTML tags and control characters from titles", () => {
    expect(sanitizeUntrustedDisplayText(XSS_TITLE)).toBe('alert("xss")');
    expect(sanitizeUntrustedDisplayText(XSS_TITLE)).not.toContain("<script");
    expect(sanitizeUntrustedDisplayText(XSS_TITLE)).not.toContain("<img");
    expect(sanitizeUntrustedDisplayText("  Breaking   story \u0000 ")).toBe(
      "Breaking story",
    );
    expect(sanitizeUntrustedDisplayText(12)).toBe("");
  });

  it("allows only http(s) hrefs", () => {
    expect(safeHttpUrl("https://example.com/story")).toBe(
      "https://example.com/story",
    );
    expect(safeHttpUrl(XSS_URL)).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHttpUrl("https://user:pass@example.com")).toBeNull();
    expect(hostnameFromHttpUrl("https://www.reuters.com/world")).toBe(
      "reuters.com",
    );
  });

  it("does not inject untrusted title or URL as HTML", () => {
    const titleHtml = renderToStaticMarkup(
      createElement(UntrustedText, { value: XSS_TITLE }),
    );
    expect(titleHtml).not.toContain("<img");
    expect(titleHtml).not.toContain("<script");
    expect(titleHtml).not.toContain("onerror");
    expect(titleHtml).toContain("alert(&quot;xss&quot;)");

    const linkHtml = renderToStaticMarkup(
      createElement(SafeExternalLink, { href: XSS_URL }, XSS_TITLE),
    );
    expect(linkHtml).not.toContain("<a ");
    expect(linkHtml).not.toContain("javascript:");
    expect(linkHtml).not.toContain("<script");
    expect(linkHtml).not.toContain("<img");

    const safeLink = renderToStaticMarkup(
      createElement(
        SafeExternalLink,
        { href: "https://example.com/?q=<script>alert(1)</script>" },
        XSS_TITLE,
      ),
    );
    expect(safeLink).toContain("<a ");
    expect(safeLink).toContain('href="https://example.com/?q=%3Cscript%3Ealert(1)%3C/script%3E"');
    expect(safeLink).not.toContain("<script>");
    expect(safeLink).not.toContain("<img");
  });
});
