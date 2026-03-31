# Ticket Trading AI Tools

7 AI-powered tools for live event ticket trading, focused on the Denver/Colorado market.

## Tools

- **Open Bell** — AI morning trading brief for the 7:15 AM session
- **Edge Calculator** — Event ROI predictor with comparable analysis
- **TradeBot** — Slack-style AI trading assistant (natural language Q&A)
- **War Room** — Inventory risk heatmap with AI portfolio analysis
- **Comps Engine** — Comparable historical event finder
- **The Radar** — Demand signal tracker across social, streaming, search, and news
- **The Playbook** — Trade performance journal with AI coaching

## Architecture

```
Frontend (React + Vite + Tailwind)
  → callLLM() → Supabase Edge Function (claude-proxy)
      → You.com API (real-time web search)
      → OpenRouter API (LLM: MiniMax-M2.7 / GPT-5.4 mini)
  → Supabase PostgreSQL (positions, trades, watchlist, briefs)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

### 3. Configure Supabase secrets

The AI features require two API keys set as **Supabase Edge Function secrets** (not in `.env`):

1. Go to your Supabase Dashboard > Edge Functions > Secrets
2. Add:
   - `OPENROUTER_API_KEY` — Get one at https://openrouter.ai/keys
   - `YOU_API_KEY` — Get one at https://api.you.com

### 4. Deploy the edge function

```bash
supabase functions deploy claude-proxy
```

### 5. Run the database schema

Apply `supabase/schema.sql` to your Supabase project to create the required tables.

### 6. Run locally

```bash
npm run dev
```

## Build

```bash
npm run build
```
