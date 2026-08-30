# HACKATHON — WebMCP Challenge

**This repository is the submission codebase.** Official rules: https://webmcp.devpost.com/rules

Deadline: **3 September 2026, 1:00pm PDT** (4 September 2026, 00:00 UAE).

OpenBento is an existing concept **meaningfully rebuilt** with WebMCP during the challenge period. Dated work lives here, not in the legacy repo.

## Submission needs (later)

1. Working live URL (judges: ChatGPT in-app browser or Chrome 149+ + WebMCP flag)
2. Public repo + detectable MIT license (already)
3. Demo video &lt; 3 minutes on YouTube
4. Description: WebMCP fit, human+agent loop, implementation
5. Tools via `document.modelContext.registerTool` mapped 1:1 to the domain catalog

## Judging (equal weight)

WebMCP Leverage, Execution, Potential Impact, Creativity & Ambition.

## Current WebMCP implementation

Tools are registered as 13 snake_case wrappers. Eval with `pnpm test` and
`/webmcp`. A live deployment and demo video remain pending owner approval; do
not paywall the judge preview later.
