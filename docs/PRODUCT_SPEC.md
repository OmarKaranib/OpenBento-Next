# PRODUCT_SPEC — OpenBento-Next

Status: **scaffold**. Authoritative product contract for the rebuild. Not a marketing document.

## Vision

OpenBento is an **AI-native live intelligence canvas**. A human and an agent share one workspace. The human arranges live intelligence as Cards and Frames on a Canvas. A WatchBot watches that Canvas and acts through the **same** domain actions the human uses. An external agent reaches those same actions through WebMCP.

This is not a widget grid, not a document editor, and not a semantic-zoom “infinite nest.” It is a live surface with four primitives and one action catalog.

## Four primitives

| Primitive | Definition |
| --- | --- |
| **Canvas** | The workspace. Dark, infinite, dotted. One current Canvas is selected in the top-left. Zoom is **navigation only** — it never changes what objects exist or how they nest. |
| **Card** | The atomic unit of live intelligence on a Canvas. A Card is not valid without **provenance**. |
| **Frame** | A bordered display region on a Canvas. Frames can be fullscreened. Frames are not zoom levels and not a hierarchy. |
| **WatchBot** | A live observer/actor **bound to a Canvas**. Status is shown top-left next to the Canvas name. It creates and updates Cards through the shared catalog. |

## Card provenance (required)

Every Card created or updated through the domain **must** carry:

| Application field | Schema sketch | Meaning |
| --- | --- | --- |
| `sourceUrl` | `source_url` | Source URL |
| `title` | `title` | Source title |
| `publishedAt` | `published_at` | Publish timestamp (ISO-8601) |
| `sourceType` | `source_type` | `web` \| `news` \| `youtube` \| `x` |

`createCard` and `updateCard` both require this object. There is no provenance-less Card path for UI, WatchBot, or WebMCP.

## Shared actions (engineering rule)

Human UI, WatchBot, and WebMCP **converge on `packages/domain`**. Required catalog names WatchBot Engineer builds against:

- `createWatchBot`
- `pauseWatchBot`
- `createCard` (provenance required)
- `updateCard` (provenance required)

No private WatchBot mutation API. No WebMCP tools that are not catalog actions. Handlers are **not** implemented in this phase.

## Relationship to legacy OpenBento

[`OmarKaranib/OpenBento`](https://github.com/OmarKaranib/OpenBento) is **frozen reference**. Do not modify it. Do not port it.

The old product was a 12-column widget dashboard (Vite + Express). This rebuild is a **different product**: Railway-inspired canvas chrome, xyflow later, WatchBot, WebMCP, shared domain actions. Visual or domain ideas may be borrowed; the architecture must not be.

## Users

| User | Job |
| --- | --- |
| **Human** | Opens a Canvas, frames regions, reads and arranges Cards, starts/pauses the WatchBot, talks to the Agent. |
| **WatchBot** | Watches the current Canvas; discovers sources; writes Cards via `createCard` / `updateCard`. |
| **Agent (WebMCP)** | Same catalog, registered as in-page tools. Judges use ChatGPT’s in-app browser or Chrome 149+ with WebMCP enabled. |

## Core loops

### 1. Human on canvas

Select Canvas → see WatchBot status → pan/zoom (navigation) → create Frames → inspect Cards → undo/redo → open Agent.

### 2. WatchBot watching

`createWatchBot` on a Canvas → status `watching` → discover → normalize → dedup → novelty → relevance → attach provenance → `createCard` / `updateCard`. `pauseWatchBot` stops discovery (`paused`).

First slice (documented, **not implemented**): **web and news only**. YouTube and X after web is honest. See `WATCHBOT_SPEC.md`.

### 3. Agent via WebMCP

Page registers catalog actions as tools. Agent calls `createWatchBot`, `pauseWatchBot`, `createCard`, `updateCard` with the same schemas. Execute functions (later) call the same handlers as the human UI.

## v1 in / out

### In v1 (product intent — most of this is not built yet)

- Four primitives as defined above
- Railway-like chrome (rail, top bar, bottom-left vertical toolbar)
- Shared domain actions; provenance-required Cards
- WatchBot first slice: web/news, xAI/Grok provider adapter (not in domain)
- WebMCP tool parity with the catalog
- Local/dev persistence only, using the sketched `WatchBot` and `WatchBotEvent` records

### Out of v1 / this scaffold

- Working canvas UI, xyflow graph, chrome implementation
- Semantic zoom or zoom-as-hierarchy
- Job system, provider calls, pipeline implementation
- YouTube / X sources
- Production Supabase, deploy, DNS, spend
- Port of the legacy dashboard

## This phase

Scaffold + docs + one master roadmap issue. Types and a proposed local schema sketch only. No product features.
