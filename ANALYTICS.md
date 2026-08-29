# ANALYTICS — Canonical event taxonomy

Status: **docs only**. Do not wire Sentry, PostHog, or Resend SDKs in this phase. No API keys.

## Product vs errors

| System | Owns |
| --- | --- |
| **Sentry** | Errors, crashes, performance, WatchBot worker failures |
| **PostHog** | Product analytics, funnels, retention, feature flags, session behavior, AI/LLM **cost** analytics |
| **Resend** | Transactional email and future WatchBot alerts/digests |

## Clean event rules

Events may include identifiers, action names, and cost metadata.

Events must **never** include:

- secrets or session tokens,
- WatchBot/Agent **instructions**,
- article or social **bodies**,
- source HTML,
- untrusted payloads, titles-as-prompt, snippets, transcripts.

Allowed cost metadata: `provider`, `units`, `watchBotId`, `durationMs`.

## Event names

Prefix: `ob.`

### Canvas

| Event | When |
| --- | --- |
| `ob.canvas.created` | `createCanvas` succeeded |
| `ob.canvas.renamed` | `renameCanvas` succeeded |
| `ob.canvas.switched` | `switchCanvas` succeeded |
| `ob.canvas.viewport_updated` | `updateCanvasViewport` succeeded |

Properties: `canvasId`, `actor` (`human` \| `watchbot` \| `webmcp`).

### Card

| Event | When |
| --- | --- |
| `ob.card.created` | `createCard` succeeded |
| `ob.card.updated` | `updateCard` succeeded |
| `ob.card.moved` | `moveCard` succeeded |
| `ob.card.resized` | `resizeCard` succeeded |
| `ob.card.frame_set` | `setCardFrame` succeeded |

Properties: `canvasId`, `cardId`, `cardType`, `actor`. No body, URL, or HTML.

### Frame

| Event | When |
| --- | --- |
| `ob.frame.created` | `createFrame` succeeded |
| `ob.frame.updated` | `updateFrame` succeeded |
| `ob.frame.moved` | `moveFrame` succeeded |
| `ob.frame.resized` | `resizeFrame` succeeded |
| `ob.frame.fullscreen_toggled` | `fullscreenFrame` view change (not a geometry write) |

Properties: `canvasId`, `frameId`, `actor`, `active` (fullscreen only).

### WatchBot

| Event | When |
| --- | --- |
| `ob.watchbot.created` | `createWatchBot` succeeded |
| `ob.watchbot.updated` | `updateWatchBot` succeeded |
| `ob.watchbot.paused` | `pauseWatchBot` succeeded |
| `ob.watchbot.resumed` | `resumeWatchBot` succeeded |
| `ob.watchbot.status` | Status observed (`running` \| `paused` \| `error`) |
| `ob.watchbot.worker_failed` | Worker exception (Sentry + optional PostHog) |

Properties: `canvasId`, `watchBotId`, `status`, `actor`. **No instruction text.**

Cost (PostHog): `ob.watchbot.cost` with `provider`, `units`, `watchBotId`, `durationMs`.

### Agent

| Event | When |
| --- | --- |
| `ob.agent.activated` | User opened the Agent control |
| `ob.agent.used` | Agent completed a turn that invoked domain actions |

Properties: `canvasId`, `actionCount`. No prompt/instruction text.

### WebMCP

| Event | When |
| --- | --- |
| `ob.webmcp.tool` | A registered tool ran |

Properties: `toolName` (catalog action name), `success` (`true` \| `false`), `canvasId` if known. No input bodies.
