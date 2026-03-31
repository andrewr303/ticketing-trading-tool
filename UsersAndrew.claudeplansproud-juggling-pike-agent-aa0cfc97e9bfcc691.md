# Deep Research: Event Discovery and Ranking Engine

## Transformation Plan: Opening Bell to Deep Research

### Overview

Transform the static, Denver-focused Opening Bell morning brief (5 search queries, single LLM call, 3 tabs) into a nationwide Deep Research engine that discovers events across all major US markets, ranks them with a multi-factor scoring algorithm, and produces actionable trading signals with confidence scores.

---

## Phase 1: Data Model and Types

### File: src/lib/types.ts

Add new interfaces alongside existing ones. Do NOT remove existing BriefData etc as other pages reference them.

New types to add:

- MarketCode (type alias) - 18 major US markets plus NATIONAL
- EventCategory - concert, sports, theater, festival, comedy
- TradingSignal - BUY, SELL, HOLD, WATCH
- PlatformName - Ticketmaster, StubHub, Vivid Seats, SeatGeek, TickPick, AXS
- RankingFactors (interface) - five 0-100 scores with weights
- RankedEvent (interface) - core ranked event entity
- MarketSummary (interface) - per-market aggregation
- DeepResearchResult (interface) - full response envelope
- TrendingSignal (interface) - market-wide signal
- DeepResearchFilters (interface) - UI filter state

See detailed field specifications in plan body below.