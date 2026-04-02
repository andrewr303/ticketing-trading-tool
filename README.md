# Ticket Trading Intelligence Platform

> Seven AI-powered tools that turn raw market signals into trading decisions for live event tickets.

**Live app → [ticketing.andrewvrodriguez.com](https://ticketing.andrewvrodriguez.com)**

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?style=flat-square&logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-backend-3ecf8e?style=flat-square&logo=supabase)

---

## Overview

This platform combines live event data, real-time web search, and large language models to give ticket brokers the analysis layer that manual research can't match. From the 7:15 AM morning brief to post-trade coaching, every tool is purpose-built for the resale workflow.

The stack routes LLM calls through Supabase Edge Functions, blending live Ticketmaster inventory, You.com web search context, and OpenRouter model access into structured, actionable output — all behind Supabase Auth with per-user row-level security.

---

## Tools

| Tool | What it does |
|------|-------------|
| **Open Bell** | AI morning brief: priority events, on-sales, social signals, and risk alerts for the trading day ahead |
| **Edge Calculator** | Enter an event, section, and buy price — get a verdict (Strong Buy → Strong Pass), expected ROI range, demand score, and comparable event data |
| **TradeBot** | Slack-style natural language assistant for ad-hoc market questions, pricing checks, and trade logic |
| **War Room** | Inventory risk heatmap. Scores each open position across time, P&L, trend, and category risk. AI portfolio coaching on demand |
| **Comps Engine** | Finds direct and market-comparable historical events, then generates a pricing guidance table with suggested buy, list, and expected resale ranges |
| **The Radar** | Watchlist with per-event demand scoring across social, streaming, search, news, and community signals |
| **The Playbook** | Trade journal. Tracks P&L, win rate, ROI distribution, and cumulative performance charts. AI coaching grades your history and identifies patterns |

---

## Architecture

```
Browser (React + Vite)
  │
  ├─ Supabase Auth ──────────────────── Email/password, RLS-enforced sessions
  │
  ├─ Supabase PostgreSQL ─────────────── positions · trades · watchlist · briefs · research cache
  │
  └─ callLLM() ──────────────────────── OpenRouter API (frontend, direct)
       │
       └─ Supabase Edge Functions (Deno)
            ├─ claude-proxy     ← LLM routing + You.com search injection
            ├─ deep-research    ← 3-phase research: search → synthesis → structured JSON
            └─ event-search     ← You.com Search → normalized EventSearchResult[]
```

**AI model routing via OpenRouter:**
- Standard tier → `google/gemini-flash` (frontend default)
- Advanced tier → `openai/gpt-5.4-mini` (Edge Functions)
- Research tier → `openai/gpt-5.4-mini` (deep-research function)

**Live data sources:**
- **Ticketmaster Discovery API v2** — event search, inventory levels, presale dates, price ranges
- **You.com Search + Research API** — web context injection for LLM prompts

---

## Repository Structure

```
ticketing-trading-tool/
├── src/
│   ├── components/
│   │   ├── APIClient.tsx        # LLM + Ticketmaster integration, callLLM()
│   │   ├── EventSearchInput.tsx # Debounced autocomplete with keyboard nav
│   │   ├── Layout.tsx           # Sidebar nav, mobile menu, auth header
│   │   └── ErrorBoundary.tsx
│   ├── lib/
│   │   ├── api.ts               # Supabase CRUD (positions, trades, watchlist, briefs)
│   │   ├── auth.tsx             # AuthContext, useAuth() hook
│   │   ├── prompts.ts           # All 7 PromptConfig objects with buildPrompt()
│   │   ├── ticketmaster.ts      # Discovery API v2 client + formatters
│   │   ├── types.ts             # Shared TypeScript interfaces + union types
│   │   └── venueTiers.ts        # 85+ venue → section tier mappings
│   ├── pages/
│   │   ├── Landing.tsx          # Dashboard / tool selector
│   │   ├── Login.tsx            # Auth form (sign-up + sign-in)
│   │   ├── OpenBell.tsx         # Deep Research / morning brief
│   │   ├── EdgeCalculator.tsx   # ROI analyzer
│   │   ├── TradeBot.tsx         # Chat assistant
│   │   ├── WarRoom.tsx          # Portfolio risk heatmap
│   │   ├── CompsEngine.tsx      # Comparable event finder
│   │   ├── Radar.tsx            # Demand signal tracker
│   │   └── Playbook.tsx         # Trade journal + coaching
│   ├── App.tsx                  # Router + auth guard
│   └── main.tsx
├── supabase/
│   ├── functions/
│   │   ├── claude-proxy/        # LLM proxy with model routing + search injection
│   │   ├── deep-research/       # 3-phase multi-source research pipeline
│   │   └── event-search/        # You.com → EventSearchResult normalizer
│   └── schema.sql               # Full PostgreSQL schema with RLS policies
├── .env.example
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [OpenRouter](https://openrouter.ai) API key
- A [You.com API](https://api.you.com) key (for web search in Edge Functions)
- A [Ticketmaster](https://developer.ticketmaster.com) API key (optional, for live event search)

### Installation

```bash
git clone https://github.com/andrewr303/ticketing-trading-tool.git
cd ticketing-trading-tool
npm install
```

---

## Configuration

### 1. Environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Supabase project credentials
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# OpenRouter — required for all AI features
# https://openrouter.ai/keys
VITE_OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 2. Supabase Edge Function secrets

The Edge Functions use server-side secrets that are **not** stored in `.env`. Set them in your Supabase dashboard under **Project Settings → Edge Functions → Secrets**:

| Secret | Where to get it |
|--------|----------------|
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `YOU_API_KEY` | [api.you.com](https://api.you.com) |

### 3. Database schema

Apply the schema to your Supabase project. In the Supabase SQL Editor, run the contents of:

```
supabase/schema.sql
```

This creates five tables (`positions`, `trades`, `watchlist`, `briefs`, `deep_research_cache`) with row-level security policies enforcing per-user data isolation.

### 4. Deploy Edge Functions

```bash
supabase functions deploy claude-proxy
supabase functions deploy deep-research
supabase functions deploy event-search
```

---

## Scripts

```bash
npm run dev       # Start Vite dev server with hot reload
npm run build     # Type-check + production bundle → dist/
npm run preview   # Serve the production build locally
npm run lint      # ESLint static analysis
```

---

## How It Works

### Prompt pipeline

Each tool has a `PromptConfig` in `src/lib/prompts.ts` that defines:

- The system role and task specification
- `searchQueries` — terms sent to Ticketmaster/You.com for live data injection
- `buildPrompt(input)` — assembles the final prompt with user context
- `modelTier` — routes to the appropriate OpenRouter model
- Expected JSON output schema

`callLLM()` in `APIClient.tsx` orchestrates the full flow: fetch live data → inject into prompt → call OpenRouter → parse and return structured output.

### Deep Research (3-phase)

The `deep-research` Edge Function runs three sequential phases:

1. **Search** — parallel You.com queries for market trends, event-specific data, and upcoming on-sales
2. **Synthesis** — You.com Research API for cited deep synthesis across all sources
3. **Structuring** — GPT generates scored, normalized JSON with `edge_score`, `demand_score`, `roi_score`, and `inefficiency_score` per event

Results are cached in Supabase by `(user_id, research_date, regions, categories, date_range)` to avoid redundant API calls.

### Risk scoring (War Room)

Each open position is scored 0–100 from four components:

| Component | Weight | Signal |
|-----------|--------|--------|
| Time to event | 30 | Days remaining before event |
| P&L position | 30 | Current market vs. cost basis |
| Price trend | 25 | Rising / stable / declining |
| Category | 15 | Historical category volatility |

Positions fall into **safe** (≤30), **watch** (31–60), or **danger** (61+) zones with color-coded display and AI coaching recommendations.

---

## Development

The project uses TypeScript in strict mode. Key patterns:

- **Auth guard** — `AppRoutes` in `App.tsx` redirects unauthenticated users to `/login` before rendering any tool
- **RLS enforcement** — all Supabase queries are scoped to the authenticated user; no user can read another's data
- **Prompt modularity** — adding a new tool means adding a `PromptConfig` to `prompts.ts` and a new page; the `callLLM()` contract is unchanged
- **Venue tiers** — `venueTiers.ts` maps 85+ venues to section tier labels used by the Edge Calculator for more accurate pricing context

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: description"`
4. Push and open a pull request against `main`

Please keep PRs focused. If you're adding a new tool, follow the `PromptConfig` pattern in `prompts.ts` and the page structure in `src/pages/`.

---

## License

MIT
