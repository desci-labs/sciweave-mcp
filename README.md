<p align="center"><img src="public/logo.png" alt="SciWeave" width="120" /></p>

# SciWeave MCP Server

Ground Claude, ChatGPT, Cursor, and Windsurf in 300M scientific works — every citation a verifiable DOI.

[![Get API Key](https://img.shields.io/badge/Get%20API%20Key-free%20to%20start-brightgreen)](https://mcp.sciweave.com)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-active-blue)](https://registry.modelcontextprotocol.io/v0.1/servers?search=sciweave)

**Endpoint:** `https://mcp.sciweave.com/mcp` · **Transport:** Streamable HTTP · **Auth:** API key from [mcp.sciweave.com](https://mcp.sciweave.com) (50 free credits to start)

---

## 🚀 Install

### Claude Code (CLI)

```bash
claude mcp add --transport http sciweave https://mcp.sciweave.com/mcp
```

On first use, Claude Code runs the OAuth flow and asks for your SciWeave API key. For headless / CI setups, pass the token directly:

```bash
claude mcp add --transport http sciweave https://mcp.sciweave.com/mcp \
  --header "Authorization: Bearer YOUR_API_KEY"
```

### Claude.ai (web)

1. Click your avatar → **Settings** → **Connectors** → **Add custom connector**
2. **URL:** `https://mcp.sciweave.com/mcp`
3. **Authorization Token:** paste your SciWeave API key
4. Click **Save** — start asking research questions in any new chat

### Cursor / Windsurf / Claude Desktop

Add to your MCP config file (`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`, or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sciweave": {
      "type": "http",
      "url": "https://mcp.sciweave.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### ChatGPT

Add `https://mcp.sciweave.com/mcp` as a remote MCP server in your custom GPT or via the OpenAI Apps SDK, with the `Authorization: Bearer YOUR_API_KEY` header.

> **No API key yet?** Get one free at **[mcp.sciweave.com](https://mcp.sciweave.com)** — new accounts include 50 free credits.

---

## What you get

- **Real citations, not hallucinations.** Every claim returns a verifiable DOI you can click.
- **300M+ scientific works.** The world's largest open research index.
- **Multi-session research.** Resume threads from yesterday, last week, or last month — every saved citation stays verifiable.

## Tools

| Tool | Description |
|------|-------------|
| `ask_research_question` | AI answer with inline citations grounded in SciWeave's index. Supports `min_year` / `max_year` filters. |
| `find_references` | Fast paper lookup (~1s). Returns title, authors, year, DOI, URL, abstract snippet. No AI synthesis. |
| `get_research_thread` | Resume a prior research conversation by `thread_id` (returned by `ask_research_question`). |
| `list_collections` | List your saved paper collections. |
| `get_collection_papers` | Get papers in a specific collection with full metadata. |
| `get_account_status` | Check credit balance and account info. |

All tools are read-only. Every returned paper includes title, authors, publication year, DOI, URL, and abstract snippet.

---

## Examples

### Ask a research question

> **Prompt:** "What are the latest findings on CRISPR-Cas9 off-target effects in mammalian cells?"

The `ask_research_question` tool queries SciWeave's index and returns a synthesized answer with numbered citations including authors, journals, DOIs, and publication years.

```
CRISPR-Cas9 off-target effects in mammalian cells involve several mechanisms...

References (8 sources, 142 total found):
[1] Zhang et al. "Genome-wide off-target analysis..." Nature Methods, 2023
[2] Kim et al. "High-fidelity Cas9 variants..." Science, 2024
...
```

### Browse a research collection

> **Prompt:** "Show me all papers in my Quantum Computing collection"

Claude first calls `list_collections` to find your collections, then `get_collection_papers` with the matching ID.

```
Found 3 research collection(s):
- Quantum Computing (ID: abc123) — 12 papers
- Machine Learning (ID: def456) — 8 papers

12 paper(s) in this collection:
1. Quantum Error Correction with Surface Codes
   Authors: Fowler et al. · Year: 2024 · Journal: Physical Review Letters · DOI: 10.1103/...
```

### Fast reference lookup

> **Prompt:** "Find me 5 recent references about mRNA vaccine stability and storage"

`find_references` is citation-only (no AI synthesis), so results return in ~1 second.

```
References (5 papers in 1.2s):
[1] Schoenmaker et al. "mRNA-lipid nanoparticle COVID-19 vaccines: Structure and stability"
    Year: 2023 · DOI: 10.1016/j.ijpharm.2023.01.015
    Snippet: "Storage temperature significantly impacts mRNA integrity..."
```

### Check account status

> **Prompt:** "How many SciWeave credits do I have left?"

```
SciWeave Account Status
Credits remaining: 42
Manage your account: https://sciweave.com/settings?tab=api-access
View pricing: https://sciweave.com/pricing
```

---

## Authentication

SciWeave supports two auth modes against the same `https://mcp.sciweave.com/mcp` endpoint:

- **OAuth 2.0 authorization code flow** (default for Claude.ai and `claude mcp add` without headers). Claude opens the SciWeave authorization page, you paste your `sciweave_live_` API key, and the server hands back an OAuth access token tied to your account.
- **Direct Bearer token** (Cursor / Windsurf / Claude Desktop / CI). Send `Authorization: Bearer YOUR_API_KEY` directly. No browser flow.

All tools are read-only — the server cannot write to your collections or modify your account. API keys can be rotated at any time at [sciweave.com/settings?tab=api-access](https://sciweave.com/settings?tab=api-access).

---

## Support

- **Email:** support@sciweave.com
- **Documentation:** [sciweave.com/docs](https://sciweave.com/docs)
- **Issues:** [github.com/desci-labs/sciweave-mcp-issues](https://github.com/desci-labs/sciweave-mcp-issues)
- **Privacy Policy:** [sciweave.com/web/privacy-policy](https://sciweave.com/web/privacy-policy)
