# AI Provider Configuration

Lifecycle AI can run through either Gemini or 9Router. The runtime selection is centralized in `lib/ai/provider.ts` and controlled by environment variables.

## Provider switch

| Variable | Values | Default | Notes |
| --- | --- | --- | --- |
| `AI_PROVIDER` | `gemini`, `9router`, `ninerouter` | `gemini` | Selects the AI SDK provider used by lifecycle agents. |

## Gemini mode

Use Gemini for the default local/deployment path.

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

`GOOGLE_GENERATIVE_AI_API_KEY` is also accepted as an alias for `GEMINI_API_KEY`.

## 9Router mode

Use 9Router when you want an OpenAI-compatible gateway while keeping the same AI SDK `generateText` code path.

```env
AI_PROVIDER=9router
NINEROUTER_URL=http://localhost:20128
NINEROUTER_KEY=your-9router-api-key
NINEROUTER_MODEL=kr/claude-sonnet-4.5
```

Notes:

- `NINEROUTER_BASE_URL` is accepted as an alias for `NINEROUTER_URL`.
- `NINEROUTER_API_KEY` is accepted as an alias for `NINEROUTER_KEY`.
- If the local 9Router instance does not require API-key auth, leave the key variables empty or unset.
- The app appends `/v1` automatically when `NINEROUTER_URL` / `NINEROUTER_BASE_URL` omits it.
- Pick `NINEROUTER_MODEL` from the OpenAI-compatible models endpoint: `curl $NINEROUTER_URL/v1/models`.

## Local validation

1. Confirm 9Router is reachable: `curl $NINEROUTER_URL/api/health`.
2. Confirm the model id exists: `curl $NINEROUTER_URL/v1/models`.
3. Restart `pnpm dev` after changing `.env.local`.
4. Send one WAHA lifecycle test message and verify the webhook returns `200`.
5. Enable `LIFECYCLE_AI_DEBUG=true` only while triaging provider routing, tool-calling steps, or token usage.
