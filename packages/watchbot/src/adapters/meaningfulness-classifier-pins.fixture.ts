/**
 * Deterministic meaning-classifier labels for CI.
 *
 * Human blind-eval ground truth for five pinned X candidates, plus synthetic
 * reply / quote / secondary-commentary cases. Not a production scorer and not
 * a lexical gate — adapters still judge via the shared prompt. Tests look up
 * these labels with {@link createFixtureMeaningfulnessClassifier}.
 */

export const PINNED_X_CLASSIFIER_INSTRUCTION =
  "(OpenAI OR WebMCP) -is:retweet";

export interface MeaningClassifierLabelFixture {
  id: string;
  expectedMeaningful: boolean;
  title: string;
  snippet: string;
  sourceType: "x";
  canonicalUrl: string;
  instruction: string;
  kind: "pinned" | "synthetic";
  reason: string;
}

const PINNED_INSTRUCTION = PINNED_X_CLASSIFIER_INSTRUCTION;

function xPin(
  partial: Omit<
    MeaningClassifierLabelFixture,
    "sourceType" | "instruction" | "snippet" | "kind"
  > & { snippet?: string },
): MeaningClassifierLabelFixture {
  return {
    ...partial,
    snippet: partial.snippet ?? partial.title,
    sourceType: "x",
    instruction: PINNED_INSTRUCTION,
    kind: "pinned",
  };
}

/** Five pinned X posts from the blind human eval (snippet ≡ title). */
export const PINNED_X_MEANING_FIXTURES: MeaningClassifierLabelFixture[] = [
  xPin({
    id: "pin-1",
    expectedMeaningful: true,
    title:
      "New lawsuits target OpenAI over the Tumbler Ridge tragedy — 30 more plaintiffs, including teachers and students, now allege aiding and abetting rather than mere negligence in its handling of early warning signs tied to ChatGPT. This marks a major escalation as OpenAI faces https://t.co/kINyQqBT4D",
    canonicalUrl: "https://x.com/dailytechonx/status/2095134626800894439",
    reason:
      "Concrete legal development: additional plaintiffs and a shifted allegation.",
  }),
  xPin({
    id: "pin-2",
    expectedMeaningful: false,
    title:
      "@Keilthar Tu vis au paradis, dans la vraie vie, même dans la plus riche et organisée des entreprises avec le plus d’employés, c’est le bordel. Alors une boite qui a scale aussi vite que OpenAI je te laisse imaginer.",
    canonicalUrl: "https://x.com/louis4174/status/2095134636074586324",
    reason: "Reply / conversational commentary, not a new development.",
  }),
  xPin({
    id: "pin-3",
    expectedMeaningful: false,
    title:
      "@MaxForAI @theinformation @OpenAI 所以到底能不能看懂啊 这波澄清完感觉更慌了哈",
    canonicalUrl: "https://x.com/lmx2000/status/2095134611353588178",
    reason: "Reply / secondary reaction to a clarification, not a new development.",
  }),
  xPin({
    id: "pin-4",
    expectedMeaningful: true,
    title:
      "ChatGPTで複数の事業や案件を進めていると、 「今なに進めてたっけ？」が増えてきました。 そこで、チャットを事業ごとに整理して、次にやることまで一覧できるChrome拡張「ChatBoard」を作りました。 OpenAI API不要・ローカル保存です。 ↓配布はこちら https://t.co/86Umk4T9Ic",
    canonicalUrl: "https://x.com/rakutsune_/status/2095134599471137170",
    reason: "Concrete product release of a Chrome extension.",
  }),
  xPin({
    id: "pin-5",
    expectedMeaningful: false,
    title:
      '@MaxForAI @theinformation @OpenAI 全场都会去转"2 倍"，但 "fragile, and currently trending in a negative direction" 才是新闻。前沿实验室一把手公开承认可监控性正在变差，这比任何架构八卦都重',
    canonicalUrl: "https://x.com/linkcheng94/status/2095134574900920742",
    reason:
      "Reply / quote amplification of secondary commentary on someone else's report.",
  }),
];

/** Extra reply / quote / secondary-commentary cases beyond the five pins. */
export const SYNTHETIC_AMPLIFICATION_FIXTURES: MeaningClassifierLabelFixture[] =
  [
    {
      id: "synthetic-reply-amplifies-lawsuit",
      expectedMeaningful: false,
      title:
        "@dailytechonx everyone needs to boost this — 30 more plaintiffs is huge, RT the lawsuit thread",
      snippet:
        "@dailytechonx everyone needs to boost this — 30 more plaintiffs is huge, RT the lawsuit thread",
      sourceType: "x",
      canonicalUrl: "https://x.com/example/status/synthetic-reply-amplification",
      instruction: PINNED_INSTRUCTION,
      kind: "synthetic",
      reason: "Reply that only amplifies a real filing; not itself a new development.",
    },
    {
      id: "synthetic-quote-amplifies-launch",
      expectedMeaningful: false,
      title:
        'Quote: ChatBoard launched, local-only Chrome extension. "Sharing this so more people see the drop."',
      snippet:
        'Quote: ChatBoard launched, local-only Chrome extension. "Sharing this so more people see the drop."',
      sourceType: "x",
      canonicalUrl: "https://x.com/example/status/synthetic-quote-amplification",
      instruction: PINNED_INSTRUCTION,
      kind: "synthetic",
      reason: "Quote-post amplification of someone else's product launch.",
    },
    {
      id: "synthetic-secondary-commentary",
      expectedMeaningful: false,
      title:
        "@MaxForAI that quote about monitorability trending negative is the real story, the 2x chatter is noise",
      snippet:
        "@MaxForAI that quote about monitorability trending negative is the real story, the 2x chatter is noise",
      sourceType: "x",
      canonicalUrl: "https://x.com/example/status/synthetic-secondary-commentary",
      instruction: PINNED_INSTRUCTION,
      kind: "synthetic",
      reason: "Secondary commentary pointing at a real remark; not a new development.",
    },
    {
      id: "synthetic-original-api-ga",
      expectedMeaningful: true,
      title:
        "OpenAI's batch embeddings endpoint is generally available today, with documented rate limits and pricing.",
      snippet:
        "OpenAI's batch embeddings endpoint is generally available today, with documented rate limits and pricing.",
      sourceType: "x",
      canonicalUrl: "https://x.com/example/status/synthetic-original-development",
      instruction: PINNED_INSTRUCTION,
      kind: "synthetic",
      reason: "Original report of a concrete product/availability change.",
    },
  ];

export const MEANING_CLASSIFIER_LABEL_FIXTURES: MeaningClassifierLabelFixture[] =
  [...PINNED_X_MEANING_FIXTURES, ...SYNTHETIC_AMPLIFICATION_FIXTURES];
