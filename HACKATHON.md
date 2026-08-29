# HACKATHON — WebMCP Challenge

**This repository (`OmarKaranib/OpenBento-Next`) is the submission codebase.**

Official rules: https://webmcp.devpost.com/rules

## Dates

| Milestone | When |
| --- | --- |
| Submission deadline | **September 3, 2026, 1:00pm PDT** |
| Judging period | September 4, 2026 10:00am PT – September 21, 2026 5:00pm PT |
| Winners (on or around) | September 23, 2026 2:00pm PT |

## What a submission needs

1. **Working live URL** — judges hit it with ChatGPT’s in-app browser or Chrome with WebMCP enabled. Host anywhere later (not this phase).
2. **Public repo** with a **detectable open-source license** visible in GitHub About. This repo is public; MIT `LICENSE` is at the root.
3. **Demo video &lt; 3 minutes** on public YouTube (audio: what we built and how we used WebMCP). Judges are not required to watch past 3 minutes.
4. **Text description:** why WebMCP fits; better UX; what humans and agents can do together; how WebMCP was implemented.
5. **Tools in repo** matching:

```ts
document.modelContext.registerTool({
  name,
  description,
  inputSchema,
  execute,
});
```

## How judges access WebMCP

- ChatGPT desktop in-app browser (WebMCP on by default), **or**
- Google Chrome **149+**, enable `chrome://flags/#enable-webmcp-testing`, restart.

## Judging (equal weight)

1. **WebMCP Leverage** — thorough, skillful, non-trivial use of WebMCP.
2. **Execution** — working, coherent product — not just a PoC.
3. **Potential Impact** — real problem, real audience, demonstrated.
4. **Creativity & Ambition** — novel vs existing concepts.

Stage one is pass/fail theme + API fit; stage two uses the four criteria.

## Intended WebMCP fit (when built)

OpenBento exposes the **same** canvas actions the human uses (`createWatchBot`, `pauseWatchBot`, `createCard`, `updateCard`) so an agent can watch and write Cards with required provenance — not scrape the DOM.

## Not done yet (this phase)

- No live deploy / no working live URL
- No `registerTool` implementation
- No demo video
- No WatchBot pipeline
- Scaffold + specs + shared types only

Do not deploy from this phase without explicit approval.
