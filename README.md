# SciWeave MCP Server

Connect Claude and other AI assistants to your SciWeave account for AI-powered research answers with citations, paper collection browsing, and fast reference lookups across millions of scientific papers.

**Endpoint:** `https://mcp.sciweave.com/mcp`

## Quick Start (static bearer — works in every client)

Grab your API key from [sciweave.com/settings](https://sciweave.com/settings?tab=api-access) (new accounts get 50 free credits), then use the command / config for your client:

### Claude Code

```bash
claude mcp add --transport http sciweave https://mcp.sciweave.com/mcp \
  --header "Authorization: Bearer sciweave_live_..."
```

To keep the key out of `~/.claude.json`, use a project-local `.mcp.json` instead — Claude Code expands `${VAR}` in that file (but not in `--header` values):

```json
{
  "mcpServers": {
    "sciweave": {
      "type": "http",
      "url": "https://mcp.sciweave.com/mcp",
      "headers": { "Authorization": "Bearer ${SCIWEAVE_API_KEY}" }
    }
  }
}
```

### Claude.ai (web) and Claude Desktop

Settings → **Connectors** → **Add custom connector**:

1. URL: `https://mcp.sciweave.com/mcp`
2. **Authorization Token** field: paste your `sciweave_live_...` key
3. Save

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sciweave": {
      "url": "https://mcp.sciweave.com/mcp",
      "headers": { "Authorization": "Bearer sciweave_live_..." }
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "sciweave": {
      "serverUrl": "https://mcp.sciweave.com/mcp",
      "headers": { "Authorization": "Bearer sciweave_live_..." }
    }
  }
}
```

## OAuth flow (fallback — for clients without static-header support)

If your client doesn't accept a pre-configured `Authorization` header, add the endpoint without one:

```bash
claude mcp add --transport http sciweave https://mcp.sciweave.com/mcp
```

Then trigger OAuth in your client. A browser opens the SciWeave authorization page, you paste your API key once, and the server hands an access token back to the client. The server supports OAuth 2.1 with PKCE (S256) and RFC 7591 dynamic client registration — any spec-compliant MCP client should work.

## Features

- **Ask research questions**: AI-powered answers backed by citations from scientific literature and your paper collections. Filter by year, difficulty level, and collection scope.
- **Browse collections**: Access your SciWeave research paper collections — list names, view papers with full metadata (titles, authors, DOIs, abstracts).
- **Find references**: Fast citation lookup without waiting for AI answer generation.
- **Thread history**: Retrieve previous research conversations, including the original question, citations, and follow-ups.
- **Account management**: Check credit balance and get pricing / top-up links.

All tools are **read-only** — no write access is needed.

## Examples

### Ask a research question

> **User:** What are the latest findings on CRISPR-Cas9 off-target effects in mammalian cells?
>
> **SciWeave:** CRISPR-Cas9 off-target effects in mammalian cells involve several mechanisms...
>
> References (8 sources, 142 total found):
> [1] Zhang et al. "Genome-wide off-target analysis..." Nature Methods, 2023
> [2] Kim et al. "High-fidelity Cas9 variants..." Science, 2024

### Browse a research collection

> **User:** Show me all papers in my Quantum Computing collection
>
> Claude calls `list_collections` → matches by name → calls `get_collection_papers` with that ID. You see each paper's title, authors, year, journal, DOI, and a truncated abstract.

### Fast reference lookup

> **User:** Find me 5 recent references about mRNA vaccine stability and storage
>
> `find_references` returns in under 2s — titles, authors, years, DOIs, and an abstract snippet per paper. No AI answer generation.

### Check account status

> **User:** How many SciWeave credits do I have left?
>
> **SciWeave Account Status** — Credits remaining: **42** — [Manage](https://sciweave.com/settings?tab=api-access) · [Pricing](https://sciweave.com/pricing)

## Available Tools

| Tool | Description | Type |
|------|-------------|------|
| `ask_research_question` | AI-powered research answers with citations | Read-only |
| `list_collections` | List user's paper collections | Read-only |
| `get_collection_papers` | Get papers in a specific collection | Read-only |
| `get_research_thread` | Retrieve a previous research conversation | Read-only |
| `find_references` | Fast reference lookup (no AI generation) | Read-only |
| `get_account_status` | Check credit balance and account info | Read-only |

## Authentication architecture

The server accepts two authentication paths, both resolving to the same underlying SciWeave API key:

- **Static bearer** (primary). Clients pass `Authorization: Bearer sciweave_live_...` directly. No redirects, no session state.
- **OAuth 2.1 + PKCE** (fallback). The server runs as both the authorization server and the protected resource. The authorization endpoint collects your API key via a short form; the token endpoint returns that key as the `access_token`. PKCE S256 is enforced end-to-end; auth codes are HMAC-signed and expire in 5 minutes.

Per RFC 9728, the protected-resource metadata is served at path-specific well-known URLs so clients that connect to the bare host (`https://mcp.sciweave.com`) and clients that connect to `/mcp` both see a `resource` field matching the URL they used.

## Privacy

[SciWeave Privacy Policy](https://sciweave.com/web/privacy-policy)

## Support

- **Email:** support@sciweave.com
- **Documentation:** [sciweave.com/docs](https://sciweave.com/docs)
- **Issues:** [github.com/desci-labs/sciweave-mcp-issues](https://github.com/desci-labs/sciweave-mcp-issues)
