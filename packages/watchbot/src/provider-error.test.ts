import { describe, expect, it } from "vitest";
import { OpenAIWebSourceProviderError } from "./adapters/openai-web";
import { XSourceProviderError } from "./adapters/x";
import { YouTubeSourceProviderError } from "./adapters/youtube";
import {
  isRetryableProviderError,
  sanitizeProviderErrorMessage,
} from "./provider-error";

describe("isRetryableProviderError", () => {
  it("uses the structured retryable flag and does not parse the message", () => {
    expect(
      isRetryableProviderError(
        new YouTubeSourceProviderError("timeout", "YouTube provider request timed out.", {
          retryable: true,
        }),
      ),
    ).toBe(true);
    expect(
      isRetryableProviderError(
        new YouTubeSourceProviderError(
          "unauthorized",
          "YouTube provider rejected credentials.",
        ),
      ),
    ).toBe(false);
    expect(
      isRetryableProviderError(
        new XSourceProviderError("rate_limited", "X provider rate limit reached.", {
          retryable: true,
        }),
      ),
    ).toBe(true);
    expect(
      isRetryableProviderError(
        new XSourceProviderError("unauthorized", "X provider rejected credentials."),
      ),
    ).toBe(false);
    expect(
      isRetryableProviderError(
        new OpenAIWebSourceProviderError("timeout", "openai_web_timeout", {
          retryable: true,
        }),
      ),
    ).toBe(true);
    expect(
      isRetryableProviderError(
        new OpenAIWebSourceProviderError("malformed_response", "openai_web_malformed"),
      ),
    ).toBe(false);
    expect(
      isRetryableProviderError(
        new YouTubeSourceProviderError("timeout", "openai_web_timeout"),
      ),
    ).toBe(false);
  });

  it("classifies known OpenAI web / Grok code strings as a fallback", () => {
    expect(isRetryableProviderError(new Error("openai_web_timeout"))).toBe(true);
    expect(isRetryableProviderError(new Error("openai_web_network"))).toBe(true);
    expect(isRetryableProviderError(new Error("openai_web_http_429"))).toBe(true);
    expect(isRetryableProviderError(new Error("openai_web_http_503"))).toBe(true);
    expect(isRetryableProviderError(new Error("grok_http_500"))).toBe(true);
    expect(isRetryableProviderError(new Error("openai_web_malformed"))).toBe(false);
    expect(isRetryableProviderError(new Error("openai_web_http_401"))).toBe(false);
    expect(isRetryableProviderError(new Error("provider_unavailable"))).toBe(false);
  });

  it("sanitizes messages without inventing provider bodies", () => {
    expect(sanitizeProviderErrorMessage(new Error("openai_web_timeout"))).toBe(
      "openai_web_timeout",
    );
    expect(sanitizeProviderErrorMessage("nope")).toBe("WatchBot error");
  });
});
