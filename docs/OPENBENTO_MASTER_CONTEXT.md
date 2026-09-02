# OpenBento — Canonical Master Context

> **Status:** Product and engineering source of truth for the fresh OpenBento rebuild.
>
> **Repository:** `OmarKaranib/OpenBento-Next`
>
> **Legacy repository:** `OmarKaranib/OpenBento` — reference only. Do not modify it as part of this rebuild.
>
> **Created:** 29 August 2026
>
> **Audience:** Bento Lead, Canvas Engineer, Platform Engineer, WatchBot Engineer, QA + WebMCP, and any future human or AI contributor.

---

## 0. How every contributor must use this document

Read this document before making product, architecture, UI, data-model, WatchBot, WebMCP, infrastructure, or monetization decisions.

This document captures decisions already made with the product owner. Do not silently reinterpret or replace them because another pattern is more familiar.

If a later explicit owner decision conflicts with this file, the later owner decision wins and this file should be updated. Otherwise, this file is the canonical product context.

The core objective is not to recreate the old OpenBento dashboard. It is to build a new product from first principles.

---

# 1. Product vision

OpenBento is being rebuilt as an **AI-native live intelligence canvas**.

The product helps a user understand a live or continuously changing topic by bringing together multiple source types in one large spatial workspace and allowing persistent AI agents to keep monitoring that topic over time.

The simplest product statement is:

> **Tell OpenBento what you want to follow. It builds and maintains a living canvas of the relevant sources, media, reactions, and developments.**

OpenBento should not feel like a conventional news site, search engine, chatbot, dashboard, or mind-mapping application.

It combines:

- a large spatial canvas,
- multi-source live information,
- multimedia consumption,
- persistent monitoring agents,
- AI organization and synthesis,
- direct access to original sources,
- user-defined display Frames,
- and external agent control through WebMCP.

A useful product principle is:

> **AI organizes the story. Sources remain the story.**

The user must be able to see and inspect the source material rather than receiving only a synthetic AI paragraph.

---

# 2. Example user experience

A user might say:

> “Show me everything happening around the story that Donald Trump wants to rename Lake Ontario to Lake America.”

OpenBento should eventually be able to create a Canvas containing, where relevant and available:

- official statements,
- news articles,
- YouTube coverage,
- livestreams,
- X posts and threads,
- Reddit discussions,
- Instagram content through supported access,
- AI summaries,
- notes,
- timelines,
- grouped reactions,
- and one or more WatchBots that keep monitoring the story.

The important distinction is that OpenBento does not merely generate a search-results page once.

It creates a **persistent workspace** the user can return to, manually rearrange, add to, frame, fullscreen, and continue monitoring.

When something meaningful changes later, a WatchBot should be able to add or update sourced Cards and show that new information visibly.

---

# 3. Four core product primitives

The product is centered on four first-class objects:

1. **Canvas**
2. **Card**
3. **Frame**
4. **WatchBot**

These should remain clear domain concepts rather than becoming incidental UI implementation details.

---

## 3.1 Canvas

A Canvas is a persistent spatial workspace.

Users can create many independent Canvases, for example:

- US Politics
- Crypto
- AI News
- SpaceX
- Middle East
- A particular breaking story
- A company or market-monitoring board

A Canvas contains Cards, Frames, and associated WatchBots.

### Canvas interaction rules

- The Canvas should feel very large / effectively infinite.
- Users pan to navigate.
- Users zoom in and out to navigate.
- **There is no semantic zoom hierarchy.**
- Zooming must not replace Cards with abstractions, clusters, categories, or different information layers merely because of zoom level.
- The same information remains on the Canvas; zoom is a camera operation only.
- The user's viewport/camera can be persisted per Canvas.

### Multiple Canvases

The current Canvas is shown in the top area and should be easy to switch.

The user should be able to:

- create a Canvas,
- switch Canvas,
- rename a Canvas,
- later duplicate/archive/delete/manage Canvases.

The dedicated **Canvases** section in the left rail is for deeper Canvas management. The top Canvas switcher is for fast context switching.

---

## 3.2 Card

A Card is a piece of information or interactive content placed on a Canvas.

Cards are freely positioned and resizable.

Initial/planned Card types include:

- Note
- YouTube / video
- Article / web source
- X post / thread
- Reddit content
- Instagram content where supported
- AI summary
- WatchBot status/output
- Timeline
- Chart
- other future source or analysis types

Card architecture should be registry-based so a new Card type can be added without rewriting the Canvas engine.

### Card source provenance

Every externally discovered source Card must preserve useful provenance, such as applicable:

- source platform,
- canonical URL,
- author/account/channel,
- title,
- published timestamp,
- discovered timestamp,
- external platform ID,
- source type,
- WatchBot that discovered it,
- and any available citation/attribution metadata.

AI-generated summaries should visibly point back to their underlying sources.

### Cards and untrusted content

External URLs, pages, social posts, titles, snippets, transcripts, embeds, and metadata are untrusted input.

WatchBot-discovered content must never implicitly become trusted code or privileged instructions.

---

## 3.3 Frame

A Frame is a **first-class persisted bordered region of a Canvas**.

This is an important product feature and not merely decorative UI.

The product owner specifically wants a control near the Canvas zoom/viewport tools that allows the user to create a bordered display region.

The user can:

- activate the Frame tool,
- draw a rectangular region on the Canvas,
- name the Frame,
- move it,
- resize it,
- place Cards inside it,
- and fullscreen the Frame.

### Frame membership

Frame membership should **feel geometric to the user**.

When the user moves a Card into a Frame, OpenBento should automatically associate it with that Frame. When the Card is moved outside, membership should be removed.

Internally, explicit persisted membership such as `card.frameId` is preferred because fullscreen, persistence, querying, and deterministic behavior should not depend only on geometry calculations.

The UI should not make users manually attach/detach Cards to Frames during normal use.

### Fullscreen Frame

Fullscreen Frame is a curated presentation/monitoring mode.

When activated:

- normal application chrome should disappear,
- only the selected Frame and Cards belonging to it should be shown,
- Card layout relative to the Frame should remain intact,
- the Frame should fit intelligently in the available display,
- entering fullscreen must not mutate the saved Canvas geometry,
- there should be an obvious way to exit.

Potential future uses:

- focused monitoring screen,
- second-screen display,
- presentation view,
- shareable focused board.

---

## 3.4 WatchBot

A WatchBot is a **persistent OpenBento monitoring agent**.

It is not the same thing as the interactive OpenBento Agent.

A WatchBot is configured to keep watching a subject over time.

Example:

> “Monitor meaningful developments around this story.”

A WatchBot belongs to a Canvas and should eventually continue running in background infrastructure after the user leaves the page.

### WatchBot responsibilities

Conceptually:

1. discover candidate information,
2. normalize source data,
3. deduplicate,
4. determine whether an item is actually new,
5. evaluate relevance,
6. rank importance,
7. preserve provenance,
8. create/update OpenBento Cards,
9. maintain visible activity and status,
10. schedule future checks.

A WatchBot must not dump every search result onto the Canvas.

The product should prefer meaningful developments over volume.

### WatchBot source priorities

For the initial product, source priorities are:

1. **Web / news**
2. **X**
3. **YouTube**

Then expand carefully to:

- Reddit
- Instagram through supported access modes
- RSS
- additional providers/sources

### YouTube is first-class

YouTube is particularly important to the OpenBento concept.

WatchBot should eventually support discovery and display of relevant:

- news-channel uploads,
- livestreams,
- press conferences,
- interviews,
- official videos,
- commentary,
- and relevant user-uploaded footage when discoverable through supported APIs/access.

Use supported APIs for discovery/metadata and official embed/player approaches for playback. API quota must be treated as a real product cost and not used without bounds.

### Instagram / social access

Do not architect OpenBento around unrestricted scraping of platforms that do not provide reliable supported access.

Use official APIs, feeds, oEmbed, public URLs, supported integrations, or other legitimate access methods appropriate to the source.

The product may support a known Instagram URL even where broad global Instagram search is constrained.

### Provider independence

WatchBot is an **OpenBento primitive**, not a Grok product.

The initial provider may use xAI/Grok because real-time Web Search and X Search are highly relevant, but the internal architecture should keep AI/search providers replaceable.

A conceptual provider boundary may include operations such as:

- search,
- fetch,
- summarize,
- classify,
- reason,
- tool call.

Do not spread provider-specific Grok calls throughout the product domain.

### Background execution

WatchBot should run in a dedicated background-worker model rather than depending on a user's browser tab staying open.

A planned structure is:

- `apps/web` — user-facing application
- `apps/worker` — WatchBot worker
- shared domain package(s)
- shared WatchBot package(s)

### Adaptive cadence

Longer-term, WatchBot monitoring should be adaptive rather than blindly polling everything constantly.

Example behavior:

- quiet topic → slower checks,
- activity detected → more frequent checks,
- breaking topic → temporary aggressive monitoring,
- quiet again → back off.

This protects cost and reduces unnecessary provider/API usage.

---

# 4. Interactive Agent vs WatchBots

OpenBento has two different AI concepts.

## Interactive Agent

The Agent is the assistant the user talks to now.

Example instructions:

- “Organize this Canvas.”
- “Find videos about this story.”
- “Make the official statement larger.”
- “Put the Canadian reaction sources in a Frame.”
- “Summarize these selected Cards.”
- “Create a WatchBot for this topic.”

The Agent can act on the current Canvas through shared application/domain actions.

The primary Agent entry point belongs in the **top-right**, inspired by the Railway screenshot/reference.

The Agent can open as a right-side panel rather than consuming permanent Canvas space.

## WatchBots

WatchBots are persistent background monitors.

The distinction must remain clear:

- **Agent = interactive, immediate, user-directed**
- **WatchBot = persistent monitoring over time**

---

# 5. UI direction — Railway-inspired

The product owner strongly likes Railway's project Canvas interface and wants OpenBento to follow its **interaction language and structural feel** as closely as reasonably possible while keeping OpenBento branding and not copying Railway trademarks, brand assets, or proprietary implementation.

This is not a generic “dark dashboard” request.

The intended feel is:

- large dark workspace,
- subtle dotted grid,
- minimal interface chrome,
- strong spatial orientation,
- clean floating Card surfaces,
- compact controls,
- polished pan/zoom,
- left rail,
- contextual top bar,
- bottom-left vertical Canvas control stack.

OpenBento should feel like a serious workspace rather than a consumer content feed.

---

## 5.1 Left navigation rail

The left rail should be compact and Railway-like.

Top:

- OpenBento logo/mark

Primary navigation beneath it:

1. **Canvases**
2. **WatchBots**
3. **Settings**

Bottom fixed area:

- **Profile/avatar**

Prefer icon-first navigation with tooltips/labels on hover where appropriate.

Do not use a large persistent sidebar that consumes unnecessary Canvas width.

### Purpose of each item

**Canvases**
- full Canvas management
- create/switch/rename initially
- duplicate/archive/delete later

**WatchBots**
- account-wide WatchBot management
- see Bots across multiple Canvases
- running/paused/error states
- recent activity
- jump to associated Canvas

**Settings**
- product/account settings
- future notification/preferences/integration settings

**Profile**
- account/profile controls

---

## 5.2 Top contextual bar

The top area should communicate the current context without becoming a large header.

### Top-left / current context

Show the current Canvas name/switcher, e.g.:

`OpenBento / Trump News ▾`

Near it, show current-Canvas WatchBot status at a glance, e.g.:

`● 3 WatchBots`

Clicking the WatchBot status can open a compact popover such as:

- Trump Statements — Active — checked 2m ago
- Canadian Reaction — Active — checked 4m ago
- YouTube Coverage — Paused
- Manage WatchBots
- + New WatchBot

This status is **for the current Canvas**.

The left-rail WatchBots section is the global/all-Canvases manager.

### Top-right

Place the **Agent** entry point on the top-right, similar to the Railway reference.

Potential nearby future controls could include notifications/account indicators, but keep the top bar minimal.

---

## 5.3 Canvas controls — important Railway-style requirement

The product owner specifically wants the zoom, Frame, and related Canvas controls to look/behave structurally like Railway's compact vertical control stack shown at the bottom-left of the Canvas.

Do not scatter viewport actions across unrelated UI regions.

The compact vertical stack may include, where justified:

- grid/snap toggle
- zoom in
- zoom out
- fit / fit-to-content
- Frame creation tool
- undo
- redo
- overview/layers if useful

Exact icons may evolve, but the control grouping and compact Railway-style presentation are important.

### Frame creation interaction

Expected interaction:

1. click Frame tool,
2. cursor enters drawing/crosshair mode,
3. user drags a rectangular region,
4. Frame is created,
5. user can name/move/resize it.

The Frame tool should feel like part of Canvas navigation/editing, not a content Card.

---

# 6. Canvas technical direction

The selected initial Canvas engine is:

> **`@xyflow/react` (XYFlow / React Flow)**

Reasons:

- Cards can remain real React DOM/components,
- suitable for YouTube/video embeds and interactive source Cards,
- strong pan/zoom support,
- free spatial positioning,
- node resize support,
- viewport/culling options,
- works well for Railway-like node surfaces,
- no need to build a custom pan/zoom/hit-testing engine from scratch.

### Do not use

- the legacy OpenBento packed grid as the new Canvas model,
- `@dnd-kit` sortable grid as the Canvas engine,
- semantic zoom hierarchy,
- tldraw as the primary Canvas engine for v1,
- custom canvas math unless XYFlow proves genuinely insufficient.

### Graph concepts

OpenBento is not fundamentally a graph editor.

Do not automatically add visible edges, connection handles, flow arrows, minimaps, or node-graph UI simply because XYFlow supports them.

Use only the XYFlow capabilities that serve the OpenBento spatial workspace.

---

# 7. Recommended fresh technical architecture

This is a fresh rebuild. Do not preserve architectural debt merely because the legacy repository used it.

Proposed baseline:

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- `@xyflow/react`
- Supabase Auth
- Supabase PostgreSQL
- Supabase migrations
- Railway for eventual web/worker hosting
- opt-in Sentry error monitoring for web and worker (no product analytics,
  replay, tracing, default PII, or runtime source-map auth token)
- pnpm workspace

Suggested repository structure:

```text
OpenBento-Next/
├── apps/
│   ├── web/
│   └── worker/
├── packages/
│   ├── domain/
│   ├── watchbot/
│   └── ui/
├── supabase/
│   └── migrations/
├── docs/
└── ...
```

Avoid unnecessary monorepo tooling unless there is a concrete reason to add it.

---

# 8. Shared domain/application actions — architectural requirement

A critical architecture rule:

> **Human UI, WatchBot, and WebMCP must converge on the same OpenBento domain/application actions.**

Do not implement one code path for humans, a second bespoke path for WatchBot, and a third for WebMCP.

Examples of shared operations may include:

```text
createCanvas()
renameCanvas()
switchCanvas()
updateCanvasViewport()

createCard()
updateCard()
moveCard()
resizeCard()
setCardFrame()

createFrame()
updateFrame()
moveFrame()
resizeFrame()

createWatchBot()
updateWatchBot()
pauseWatchBot()
resumeWatchBot()
```

The exact API can evolve, but this convergence is non-negotiable.

The product will be much easier to secure, test, expose to WebMCP, and maintain if these actions have clear shared semantics.

---

# 9. Data model direction

Exact implementation should be owned by Platform Engineering, but the intended model is approximately:

## User

Identity handled by Supabase Auth plus application profile data.

## Canvas

Possible fields:

- id
- owner/user id
- name
- viewport x
- viewport y
- viewport zoom
- created timestamp
- updated timestamp
- last opened timestamp

## Card

Possible fields:

- id
- canvas id
- nullable frame id
- type
- x
- y
- width
- height
- z-index/order
- typed payload JSON
- provenance/source metadata
- created by user or WatchBot
- created timestamp
- updated timestamp

## Frame
