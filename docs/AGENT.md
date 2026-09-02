# Interactive Agent (MVP)

The top-right **Agent** control opens a compact right-side panel that chats
about the **current Canvas** and dispatches mutations through the existing
`ACTION_CATALOG` via `runBoundAction` / session-derived `ownerId`.

## Architecture

```
User message
  → sendAgentMessage (server action)
  → requireOwnerIdFromRequest
  → OpenAI Responses API (server-only)
  → ACTION_CATALOG tools
  → runBoundAction + Frame membership follow-up
  → Agent panel (reply + tool activity)
```

No parallel mutation API. No browser access to OpenAI secrets.

## Credential boundary

| Env | Where | Purpose |
|-----|-------|---------|
| `OPENAI_AGENT_API_KEY` | Railway **web** server-only | Interactive Agent only |
| `OPENAI_AGENT_MODEL` | web (optional) | Default `gpt-5.6-terra` |
| `OPENAI_API_KEY` | Railway **worker** only | WatchBot classifier / web-news provider |

Never put `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `X_BEARER_TOKEN`, or
xAI/Grok keys on the web service. Never use `NEXT_PUBLIC_` for any of them.
The Agent must **not** fall back to worker `OPENAI_API_KEY`.

## Local / hosted enablement

1. Set **server-only** on the Railway **web** service:

   - `OPENAI_AGENT_API_KEY` — required for live turns
   - `OPENAI_AGENT_MODEL=gpt-5.6-terra` (default if unset)
   - optional `OPENAI_API_BASE_URL=https://api.openai.com/v1` (endpoint only; not a secret)

2. Redeploy web. Missing `OPENAI_AGENT_API_KEY` fails closed with a clear panel error.

3. Do not put the key in client bundles, committed `.env` files, or public env.

## Safety

- Max 8 tool calls per user turn
- Agent-allowed catalog subset only (no `createCanvas` / `setCardFrame` tool)
- `ownerId` stripped/rejected from model arguments
- Source titles/URLs marked untrusted in prompt context
- Session-local chat history only (no chat schema)
