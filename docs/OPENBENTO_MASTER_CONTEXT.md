
Possible fields:

- id
- canvas id
- name
- x
- y
- width
- height
- z-index/order
- created timestamp
- updated timestamp

## WatchBot

Possible fields:

- id
- owner/user id
- canvas id
- name
- instruction
- status: running / paused / error
- provider configuration
- source configuration
- cadence configuration
- last activity
- last error
- next scheduled run
- timestamps

## WatchBot discovery/event record

Likely useful later for:

- deduplication fingerprint,
- source item ID,
- WatchBot run,
- associated Card,
- discovered timestamp,
- novelty state,
- decision/rejection metadata.

---

# 10. Authentication and authorization

Supabase is the chosen auth/database platform.

Security principles:

- never trust a client-supplied user ID,
- derive identity from authenticated session/token,
- all Canvas/Card/Frame/WatchBot access must be owner-scoped,
- prevent IDOR across users and Canvases,
- validate that a Card and Frame belong to the same Canvas before membership assignment (Platform uses `canSetCardFrame` / `assertSameCanvasMembership`; RLS is not sufficient on its own),
- use RLS where appropriate,
- validate server inputs,
- do not expose service-role or provider secrets client-side.

The fresh rebuild should establish clean ownership rules early rather than bolting them on later.

---

# 11. WatchBot discovery architecture

WatchBot should have a source-normalization layer.

Regardless of origin, a discovered candidate should be transformable into a consistent internal source object.

A conceptual source item might include:

```text
id
platform
url
canonicalUrl
externalId
title
author
publishedAt
discoveredAt
snippet/content
mediaUrl
sourceType
metadata
```

After normalization:

### Deduplication

Use deterministic signals before expensive AI where possible:

- canonical URL,
- platform external ID,
- normalized URL,
- content hash,
- title/text similarity,
- semantic similarity where justified.

A Reuters article copied by many sites should not become twenty equivalent Cards.

### Intelligence layer

The intelligence model can then help decide:

- is this relevant?
- is this actually new?
- is it significant?
- does it contradict something already known?
- is it an original source or repetition?
- which existing Card/cluster should it update?

### Social reaction aggregation

Do not necessarily create thousands of individual social Cards.

Where useful, OpenBento can represent aggregate reaction, then allow expansion to underlying sources.

---

# 12. Monetization decisions

OpenBento will **not** support Bring Your Own Key (BYOK) as part of the current product plan.

OpenBento is a managed AI service.

Intended business model:

> **subscription + included usage / Watch Credits + optional top-ups**

Why usage controls matter:

OpenBento incurs costs from more than LLM tokens:

- model reasoning,
- web searches,
- X searches,
- YouTube/API quota,
- future social providers,
- background workers,
- database/storage,
- bandwidth,
- potential transcription/media processing.

Therefore do not expose raw provider token counts as the primary customer mental model.

A future OpenBento abstraction such as **Watch Credits** can represent managed usage.

Possible future plan differences:

- number of active WatchBots,
- included Watch Credits,
- monitoring frequency,
- access to premium source integrations,
- amount of historical storage,
- priority/breaking monitoring.

Do not build billing during the immediate hackathon foundation unless explicitly authorized.

### Hackathon preview

The WebMCP Challenge / early preview should be easy for judges to access and should not place a payment wall in front of evaluation.

A free preview period with internal rate/abuse limits is appropriate.

---

# 13. WebMCP Challenge

OpenBento is being built for participation in OpenAI's **WebMCP Challenge**.

The project concept existed before the challenge, so the submission must remain transparent that OpenBento is an existing concept/product that is being **meaningfully rebuilt/extended with WebMCP during the challenge period**.

The fresh `OpenBento-Next` repository provides clean dated evidence of the new implementation.

### Official judging dimensions to optimize for

1. **WebMCP Leverage**
2. **Execution**
3. **Potential Impact**
4. **Creativity & Ambition**

The implementation must be more than registering trivial tools.

### WebMCP product purpose

WebMCP is the external agent control layer for OpenBento.

It is not the WatchBot research engine.

Potential tools may include:

```text
get_canvas_state
create_canvas
switch_canvas
create_card
move_card
resize_card
create_frame
fullscreen_frame
create_watchbot
update_watchbot
pause_watchbot
resume_watchbot
get_watchbot_status
```

Again: these must reuse the same domain/application actions as the human UI.

### Strong demo concept

A compelling challenge demo can show:

1. user asks an agent to create/follow a live story,
2. OpenBento Canvas is created/populated,
3. sourced Cards appear,
4. a WatchBot is created or shown monitoring,
5. user asks the agent to reorganize the Canvas,
6. agent creates/uses a Frame,
7. Frame is fullscreened as a clean monitoring view.

The important “wow” is that the agent is **operating a rich visual application**, not merely returning text.

### Submission constraints already known

The submission will ultimately need:

- working hosted project,
- public repository,
- visible open-source license,
- project description explaining WebMCP fit,
- clear testing instructions,
- public demo video under 3 minutes with audio,
- WebMCP client/agent testing information.

The repository is public and uses MIT licensing at project start.

Challenge submission deadline is **3 September 2026 at 1:00 PM Pacific**, which corresponds to **4 September 2026 at 12:00 AM UAE time**.

Do not leave deployment/video/submission to the final minutes.

---

# 14. Bot engineering team

The intended Grok Bot team has five roles:

1. **Bento Lead**
2. **Canvas Engineer**
3. **Platform Engineer**
4. **WatchBot Engineer**
5. **QA + WebMCP**

They should collaborate in an **OpenBento Build Room** group/channel.

## Bento Lead

Owns:

- architecture,
- roadmap,
- integration,
- product coherence,
- engineering decisions,
- shared contracts,
- merge/integration review.

Bento Lead is the integration owner.

## Canvas Engineer

Owns:

- Railway-inspired shell,
- left rail,
- top context bar,
- Agent UI entry,
- WatchBot status UI,
- XYFlow Canvas,
- Cards,
- Frames,
- bottom-left control stack,
- interactions,
- fullscreen Frame,
- UI quality.

## Platform Engineer

Owns:

- Supabase,
- auth,
- RLS,
- persistence,
- data model,
- domain actions,
- APIs/server boundaries,
- ownership isolation,
- durable contracts.

## WatchBot Engineer

Owns:

- source adapters,
- discovery,
- normalization,
- deduplication,
- novelty/relevance pipeline,
- AI provider abstraction,
- web/X/YouTube integration,
- background worker,
- WatchBot scheduling/activity.

## QA + WebMCP

Owns independent verification of:

- behavior,
- security,
- ownership/RLS,
- regressions,
- Canvas interactions,
- Frame membership/fullscreen,
- WatchBot provenance,
- untrusted-source handling,
- WebMCP tools/evals,
- challenge compliance.

QA should behave adversarially rather than simply approving builder output.

---

# 15. Bot collaboration and Git rules

All Bots may communicate, but they should not all modify one checkout/branch concurrently.

Use isolated branches/worktrees for specialist work.

A conceptual branch structure:

```text
main
├── bot/canvas
├── bot/platform
├── bot/watchbot
└── bot/webmcp-qa
```

Bento Lead owns integration.

### Operational safety rules

Without explicit owner approval, Bots must not:

- deploy production,
- modify production infrastructure,
- apply production database migrations,
- alter DNS,
- spend money,
- create paid services,
- expose secrets,
- weaken security controls,
- force-push/rewrite shared history,
- modify the legacy `OmarKaranib/OpenBento` repository.

GitHub and Supabase are connected tools. Connection is not blanket authorization to make consequential production changes.

### Source of truth

Use:

- this master context document for durable product context,
- GitHub issue #1 / roadmap for current execution status and continuation checkpoints,
- code/tests/migrations as implementation truth.

Do not create competing roadmaps across five Bot chats.

---

# 16. Fresh rebuild means fresh rebuild

The previous OpenBento implementation is useful only as a reference for ideas, branding, prior widget behavior, or lessons learned.

Do not mechanically port its architecture.

Do not preserve the old 12×6 grid.

Do not treat its old dashboard state object as the new domain model.

Do not make the fresh repo a compatibility wrapper around legacy code.

The new product should be designed around Canvas, Card, Frame, WatchBot, Agent, and WebMCP from the beginning.

---

# 17. Suggested build sequence

The exact roadmap may be refined by Bento Lead, but the recommended dependency order is:

## Phase 0 — Foundation

- fresh repo
- docs / decisions
- workspace structure
- Next.js web scaffold
- worker scaffold
- shared packages
- lint/typecheck/test/build
- master roadmap

## Phase 1 — Canvas foundation

- Railway-inspired app shell
- left rail
- top Canvas context
- top-right Agent entry placeholder
- current Canvas WatchBot status placeholder
- XYFlow dotted Canvas
- multi-Canvas create/switch/rename
- Note Card
- drag/resize/persistence
- bottom-left Railway-style controls
- Frame tool
- Frame move/resize/name
- geometric-feeling membership + explicit frameId
- fullscreen Frame

## Phase 2 — Source Cards

- Card registry polish
- YouTube/video Card
- article/web-source Card
- source provenance UI
- safe embed handling
- selection/inspector as needed

## Phase 3 — Platform hardening

- finalized Supabase models
- RLS
- ownership tests
- production-safe domain API contracts
- persistence/performance tuning

This can overlap with earlier UI work if contracts are agreed first.

## Phase 4 — WatchBot v0

- WatchBot data model
- running/paused/error status
- worker execution
- provider abstraction
- web/news discovery
- X discovery
- YouTube discovery
- source normalization
- dedupe
- create sourced Cards through shared domain actions

## Phase 5 — WatchBot management

- global WatchBots area
- current-Canvas WatchBot status popover
- activity log
- pause/resume/edit
- monitoring cadence
- internal preview usage limits

## Phase 6 — Agent + WebMCP

- meaningful WebMCP tool surface
- same shared domain actions
- agent Canvas manipulation
- evals
- security testing
- judge testing instructions

## Phase 7 — Hackathon polish/submission

- hosted preview
- UX polish
- README
- source attribution
- demo scenario
- <3 minute public video
- Devpost submission

## Phase 8 — Commercialization after challenge

- subscription
- Watch Credits
- top-ups
- usage telemetry
- billing
- expanded social integrations
- notifications
- collaboration/sharing where appropriate

---

# 18. Performance principles

A spatial multimedia workspace can become heavy quickly.

Design early for:

- viewport culling,
- memoized Card rendering,
- minimizing whole-Canvas rerenders,
- debounced/batched persistence during drag/resize,
- avoiding expensive iframe remounts,
- limiting simultaneously active live media players,
- lazy mounting media where appropriate,
- handling hundreds of lightweight Cards better than dozens of simultaneously live videos.

Do not assume “infinite Canvas” means unlimited active embeds.

---

# 19. Product UX principles

## Keep the Canvas dominant

Most screen real estate should belong to the Canvas.

Avoid giant headers, conventional dashboard sidebars, and excessive permanent controls.

## Progressive complexity

Basic use should be obvious:

- create Canvas,
- add Card,
- move it,
- create Frame,
- create WatchBot.

Advanced functionality can appear contextually.

## Source-first trust

AI analysis should be traceable to sources.

## WatchBot visibility

The user should always understand whether a Canvas is actively being monitored and by what.

## Human control

AI may arrange/add/update, but the user remains able to manually move, resize, remove, pause, frame, and reorganize content.

## No semantic zoom

Repeated intentionally: do not introduce it unless the owner explicitly reverses this decision.

---

# 20. Important non-goals for the immediate build

Do not prematurely build:

- BYOK,
- Stripe/payment flows,
- unlimited provider integrations,
- unrestricted social scraping,
- team collaboration,
- enterprise admin,
- a giant AI chat product,
- semantic zoom,
- graph edges merely because XYFlow supports them,
- migration of all legacy widgets,
- mobile apps,
- elaborate notification systems.

The immediate objective is to prove the core OpenBento experience and WebMCP value with a coherent product.

---

# 21. Reference visual structure

A rough structural reference, not a pixel specification:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ OB │ Trump News ▾  ·  ● 3 WatchBots                   Agent   ...   │
├────┼─────────────────────────────────────────────────────────────────┤
│ ▦  │                                                                 │
│    │          infinite / very large dotted Canvas                    │
│ ◎  │                                                                 │
│    │       ┌──────────────┐          ┌──────────────┐                │
│ ⚙  │       │ YouTube      │          │ Article      │                │
│    │       │ live/video   │          │ source       │                │
│    │       └──────────────┘          └──────────────┘                │
│    │                                                                 │
│    │          ┌────────────────────────────────────┐                 │
│    │          │ FRAME: Main Story                  │                 │
│    │          │                                    │                 │
│    │          │   X Card       AI Summary          │                 │
│    │          │                                    │                 │
│    │          └────────────────────────────────────┘                 │
│    │                                                                 │
│ 👤 │  ┌─────┐                                                        │
│    │  │ +   │  zoom in                                              │
│    │  │ -   │  zoom out                                             │
│    │  │ fit │  fit                                                   │
│    │  │ □   │  Frame tool                                           │
│    │  │ ↶   │  undo                                                 │
│    │  │ ↷   │  redo                                                 │
│    │  └─────┘                                                        │
└────┴─────────────────────────────────────────────────────────────────┘
```

The visual implementation should be more polished than this sketch, but the information architecture is intentional.

---

# 22. Acceptance story for the product direction

A future user should be able to do something close to the following:

1. Open OpenBento.
2. Create a Canvas called `Trump News`.
3. Ask the Agent to investigate a developing story.
4. See sourced Article/X/YouTube Cards appear.
5. Create a WatchBot that keeps monitoring the story.
6. See `● 1 WatchBot` or equivalent status in the top context area.
7. Manually drag/resize Cards on the Canvas.
8. Click the bottom-left Frame tool.
9. Draw a Frame around the most important content.
10. Ask the Agent to organize selected content into that Frame.
11. Fullscreen the Frame into a clean monitoring display.
12. Return later and see meaningful new WatchBot discoveries.
13. Inspect original sources rather than relying only on an AI summary.

If the implementation architecture makes this workflow awkward, the architecture is probably drifting away from the intended product.

---

# 23. Decisions currently locked

Unless explicitly changed by the product owner:

- Fresh repository: **yes**
- Legacy repository modified: **no**
- Core primitives: **Canvas / Card / Frame / WatchBot**
- Railway-inspired spatial UI: **yes**
- Copy Railway branding/assets: **no**
- Left rail: **Canvases / WatchBots / Settings / Profile bottom**
- Current Canvas selector top-left: **yes**
- Current Canvas WatchBot status near top-left context: **yes**
- Interactive Agent top-right: **yes**
- Railway-style compact bottom-left Canvas controls: **yes**
- Frame tool grouped with Canvas controls: **yes**
- Semantic zoom hierarchy: **no**
- Canvas engine: **XYFlow initially**
- Frame persisted object: **yes**
- Fullscreen Frame: **yes**
- Geometric-feeling + explicit internal Frame membership: **yes**
- WatchBot as persistent background worker: **yes**
- Initial WatchBot sources: **Web/news + X + YouTube**
- YouTube first-class: **yes**
- Instagram/Reddit added through supported access, not assumed unrestricted scraping: **yes**
- Initial AI/search provider may be Grok/xAI: **yes**
- Product permanently hard-wired to Grok: **no**
- BYOK: **no**
- Managed subscription model later: **yes**
- Subscription + included Watch Credits + possible top-ups: **yes**
- Hackathon preview paywall: **no**
- Human UI/WatchBot/WebMCP reuse shared domain actions: **yes**
- Supabase Auth/Postgres: **yes**
- Railway intended for eventual app/worker hosting: **yes**
- Production deployment without owner approval: **no**

---

# 24. Final instruction to all Bots

Do not optimize locally at the cost of the product vision.

A technically elegant implementation that turns OpenBento into a generic node editor, generic chatbot, generic RSS dashboard, or generic search-results page is the wrong implementation.

The target is a polished **living intelligence Canvas** where humans, persistent WatchBots, and external AI agents can work with the same visual information environment.

When uncertain about a decision, ask:

> Does this make it easier for a person and their agents to build, understand, monitor, and present a live information story together?

If not, it is probably not core to OpenBento.
