# OpenBento — WebMCP Challenge judge guide

**Live app:** [web-production-4d6c9e.up.railway.app](https://web-production-4d6c9e.up.railway.app)

**WebMCP reference:** [live `/webmcp` page](https://web-production-4d6c9e.up.railway.app/webmcp)
**License:** [MIT](./LICENSE)

OpenBento is an AI-native live intelligence canvas: a person and an external
agent work in the same persistent spatial workspace while WatchBots discover
meaningful, source-backed developments over time.

> **AI organizes the story. Sources remain the story.**

## Why this is a WebMCP project

WebMCP lets an external agent operate the durable Canvas that the person is
already using. It does not write to a separate demo state or return a detached
chat answer. The human UI, Interactive Agent, WatchBot, and WebMCP converge on
the same 20-action `ACTION_CATALOG` and domain executor, so agent changes obey
the same authentication, ownership, Card, Frame, and WatchBot rules.

The implemented WebMCP surface has 13 tools:

`get_canvas_state`, `create_canvas`, `switch_canvas`, `create_card`,
`move_card`, `resize_card`, `create_frame`, `fullscreen_frame`,
`create_watchbot`, `update_watchbot`, `pause_watchbot`, `resume_watchbot`, and
`get_watchbot_status`.

## Suggested judge flow

1. Open the [hosted Canvas](https://web-production-4d6c9e.up.railway.app) and
   authenticate.
2. Create a Canvas or select one, then add and freely arrange a Note Card.
3. Draw a Frame, move the Card inside it, and fullscreen the Frame. Fullscreen
   is view-only; it does not change saved geometry.
4. In a WebMCP-capable host, ask an agent to create a Card, move it, create a
   Frame, or create/manage a WatchBot. Confirm the result appears in the same
   Canvas.
5. Inspect source provenance and current-Canvas monitoring controls.

WebMCP registration is available in ChatGPT’s in-app browser or Chrome 149+
with `chrome://flags/#enable-webmcp-testing`. Ordinary browsers keep the Canvas
fully usable without WebMCP registration.

## Current implementation evidence

- Interactive Agent live proof: it created a Note via `createCard` and a
  WatchBot via `createWatchBot` on the hosted Canvas.
- OpenAI web/news final proof after the relevance hotfix: 5 discovered, 5
  normalized, 4 novel, 1 correctly rejected as irrelevant, and 3 Cards
  created.
- Pinned Luna meaningfulness regression: 5/5.
- Automated baseline after PR #39: 540 tests in 62 files.

WatchBot execution is intentionally fail-closed outside controlled validation;
this submission does not claim unattended always-on production monitoring.

## Local verification

Use Node 22.23.2 and pnpm 10.33.3:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter web build
pnpm --filter web dev
```

See [README.md](./README.md) for setup and [WEBMCP_SPEC.md](./WEBMCP_SPEC.md)
for tool semantics. Keep all secrets out of browser environments: the
Interactive Agent uses web-server-only `OPENAI_AGENT_API_KEY`, while
`OPENAI_API_KEY` and all service-role/provider credentials are worker-only.

## AI-assisted development

ChatGPT, OpenAI Codex, Cursor, and the Grok Build Room / xAI-assisted
development were used where applicable. Human owners retained review and
release authority.
