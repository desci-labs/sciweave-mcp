# SciWeave MCP Server

## Description

SciWeave is a research intelligence platform that helps researchers discover, organize, and synthesize scientific literature. The SciWeave MCP server connects Claude to your SciWeave account, giving it access to AI-powered research answers with citations, your personal paper collections, and fast reference lookups across millions of scientific papers.

## Features

- **Ask Research Questions**: Get AI-powered answers backed by citations from scientific literature and your own paper collections. Filter by year, difficulty level, and collection scope.
- **Browse Collections**: Access your SciWeave research paper collections directly from Claude. List collections, view papers with full metadata (titles, authors, DOIs, abstracts).
- **Find References**: Fast citation lookup without waiting for AI answer generation. Find relevant papers on any topic in seconds.
- **Thread History**: Retrieve previous research conversations by thread ID, including the original question, citations, and follow-up exchanges.
- **Account Management**: Check your credit balance and get links for pricing and top-up directly in the conversation.

## Setup

1. Visit the Anthropic MCP Directory in Claude
2. Search for **SciWeave** and click **Connect**
3. Complete the OAuth flow by entering your SciWeave API key
4. Start asking research questions

If you don't have an API key yet, create one at [sciweave.com/settings](https://sciweave.com/settings?tab=api-access). New accounts receive 50 free API credits.

## Authentication

SciWeave uses OAuth 2.0 authorization code flow. When you connect the server:

1. Claude opens the SciWeave authorization page
2. You enter your `sciweave_live_` API key
3. The server validates your key and redirects back to Claude
4. Your key is stored securely as an OAuth access token

**Permissions required:** Read access to your research collections and the ability to query the SciWeave research engine. No write access is needed — all tools are read-only.

## Examples

### Example 1: Ask a Research Question

**User prompt:** "What are the latest findings on CRISPR-Cas9 off-target effects in mammalian cells?"

**What happens:** The `ask_research_question` tool queries SciWeave's research engine, which searches millions of scientific papers and generates an AI-powered answer. Claude presents a synthesized answer with numbered citations including authors, journals, DOIs, and publication years. Follow-up questions are suggested for deeper exploration.

**Sample output:**
> CRISPR-Cas9 off-target effects in mammalian cells involve several mechanisms...
>
> References (8 sources, 142 total found):
> [1] Zhang et al. "Genome-wide off-target analysis..." Nature Methods, 2023
> [2] Kim et al. "High-fidelity Cas9 variants..." Science, 2024
> ...

### Example 2: Browse a Research Collection

**User prompt:** "Show me all papers in my Quantum Computing collection"

**What happens:** Claude first calls `list_collections` to find all your collections and their IDs, then calls `get_collection_papers` with the matching collection ID. You see each paper's title, authors, year, journal, DOI, and a truncated abstract.

**Sample output:**
> Found 3 research collection(s):
> - **Quantum Computing** (ID: abc123) — 12 papers
> - **Machine Learning** (ID: def456) — 8 papers
>
> 12 paper(s) in this collection:
> 1. **Quantum Error Correction with Surface Codes**
>    Authors: Fowler et al.
>    Year: 2024
>    Journal: Physical Review Letters
>    DOI: 10.1103/...

### Example 3: Fast Reference Lookup

**User prompt:** "Find me 5 recent references about mRNA vaccine stability and storage"

**What happens:** The `find_references` tool performs a fast citation-only search — no AI answer generation, so results return in under 2 seconds. Each reference includes title, authors, year, DOI, and a relevant snippet from the abstract.

**Sample output:**
> References (5 papers in 1.2s):
> [1] Schoenmaker et al. "mRNA-lipid nanoparticle COVID-19 vaccines: Structure and stability"
>    Year: 2023 | DOI: 10.1016/j.ijpharm.2023.01.015
>    Snippet: "Storage temperature significantly impacts mRNA integrity..."

### Example 4: Check Account Status

**User prompt:** "How many SciWeave credits do I have left?"

**What happens:** The `get_account_status` tool checks your credit balance and returns it along with links to view pricing and top up your account.

**Sample output:**
> **SciWeave Account Status**
> Credits remaining: **42**
> Manage your account: https://sciweave.com/settings?tab=api-access
> View pricing: https://sciweave.com/pricing

## Available Tools

| Tool | Description | Type |
|------|-------------|------|
| `ask_research_question` | AI-powered research answers with citations | Read-only |
| `list_collections` | List user's paper collections | Read-only |
| `get_collection_papers` | Get papers in a specific collection | Read-only |
| `get_research_thread` | Retrieve a previous research conversation | Read-only |
| `find_references` | Fast reference lookup (no AI generation) | Read-only |
| `get_account_status` | Check credit balance and account info | Read-only |

## Privacy Policy

[SciWeave Privacy Policy](https://sciweave.com/web/privacy-policy)

## Support

- **Email:** support@sciweave.com
- **Documentation:** [sciweave.com/docs](https://sciweave.com/docs)
- **Issues:** [github.com/desci-labs/sciweave-mcp-issues](https://github.com/desci-labs/sciweave-mcp-issues)
