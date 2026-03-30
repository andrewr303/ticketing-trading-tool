// Shared TypeScript interfaces

export interface BriefData {
  market_summary: string;
  priority_events: PriorityEvent[];
  on_sales_today: OnSale[];
  social_signals: SocialSignal[];
  risk_alerts: string[];
  recommended_focus: string;
}

export interface PriorityEvent {
  event_name: string;
  event_date: string;
  venue: string;
  category: "concert" | "sports" | "theater";
  signal: "price_spike" | "price_drop" | "high_demand" | "low_supply" | "on_sale_today";
  action: "BUY" | "SELL" | "HOLD" | "WATCH";
  confidence: number;
  reasoning: string;
  estimated_roi_pct: number;
}

export interface OnSale {
  event_name: string;
  time: string;
  platform: string;
  profit_potential: "high" | "medium" | "low";
  notes: string;
}

export interface SocialSignal {
  source: string;
  signal: string;
  impact: "high" | "medium" | "low";
  affected_events: string[];
}

export interface Analysis {
  verdict: "STRONG_BUY" | "BUY" | "HOLD" | "PASS" | "STRONG_PASS";
  confidence: number;
  expected_roi: { low: number; mid: number; high: number };
  current_market_price: { floor: number; median: number; ceiling: number };
  demand_score: number;
  supply_assessment: "tight" | "balanced" | "oversupplied";
  comparable_events: ComparableEvent[];
  demand_signals: DemandSignal[];
  risk_factors: string[];
  timing_assessment: string;
  reasoning: string;
}

export interface ComparableEvent {
  event: string;
  date: string;
  face_value: number;
  peak_resale: number;
  roi_achieved: number;
}

export interface DemandSignal {
  signal: string;
  strength: "strong" | "moderate" | "weak";
  direction: "bullish" | "bearish";
}

export interface AnalysisInput {
  event: string;
  venue: string;
  date: string;
  buyPrice: number;
  tier: string;
  quantity: number;
  category: string;
}

export interface Message {
  id: string;
  user: string;
  avatar: string;
  isBot: boolean;
  content: string;
  timestamp: string;
  reactions?: { emoji: string; count: number }[];
}

export interface Position {
  id: string;
  eventName: string;
  artistOrTeam: string;
  venue: string;
  eventDate: string;
  section: string;
  quantity: number;
  costPerTicket: number;
  currentMarketPrice: number;
  category: "concert" | "sports" | "theater";
  purchaseDate: string;
  priceTrend: "rising" | "stable" | "declining";
}

export interface RiskScore {
  total: number;
  breakdown: {
    timeRisk: number;
    plRisk: number;
    trendRisk: number;
    categoryRisk: number;
  };
  zone: "safe" | "watch" | "danger";
  action: string;
}

export interface CompSearchInput {
  event: string;
  venue?: string;
  date?: string;
  category: string;
  market?: string;
}

export interface CompResult {
  target_event: {
    name: string;
    category: string;
    tier: string;
    estimated_demand: "very_high" | "high" | "moderate" | "low";
    market_context: string;
  };
  direct_comps: Comparable[];
  market_comps: Comparable[];
  pricing_guidance: {
    suggested_buy_under: number;
    expected_resale_range: string;
    optimal_list_price: number;
    confidence: number;
    reasoning: string;
  };
  key_differences: string[];
  watch_factors: string[];
}

export interface Comparable {
  event_name: string;
  date: string;
  venue: string;
  city: string;
  relevance: "same_artist" | "same_venue" | "same_genre" | "same_tier";
  relevance_score: number;
  face_value_range: string;
  resale_floor: number;
  resale_median: number;
  resale_peak: number;
  roi_range: string;
  sell_through: "sold_out" | "near_sellout" | "moderate" | "slow";
  notes: string;
}

export interface WatchlistEvent {
  id: string;
  name: string;
  category: "concert" | "sports" | "theater";
  eventDate: string;
  venue: string;
  demandScore?: number;
  trend?: "surging" | "rising" | "stable" | "declining" | "crashing";
  lastAnalyzed?: string;
}

export interface SignalAnalysis {
  demand_score: number;
  trend: "surging" | "rising" | "stable" | "declining" | "crashing";
  signals: Signal[];
  demand_narrative: string;
  price_implication: string;
  action_window: string;
  catalysts_ahead: string[];
}

export interface Signal {
  source: "social_media" | "streaming" | "search" | "news" | "community";
  signal_name: string;
  value: string;
  direction: "up" | "stable" | "down";
  weight: "high" | "medium" | "low";
  detail: string;
}

export interface Trade {
  id: string;
  eventName: string;
  category: "concert" | "sports" | "theater" | "festival" | "other";
  venue: string;
  buyDate: string;
  sellDate: string;
  section: string;
  quantity: number;
  costPerTicket: number;
  salePrice: number;
  platformSold: "StubHub" | "Vivid Seats" | "SeatGeek" | "TickPick" | "Other";
  feesPaid: number;
  notes: string;
}

// ---------- Event Search Types ----------

export interface EventSearchResult {
  id: string;
  name: string;
  venue: string;
  date: string;
  category: "concert" | "sports" | "theater" | "comedy" | "festival" | "other";
  source: string;
  url?: string;
  price_range?: string;
}

export interface VenueTierConfig {
  venueName: string;
  aliases: string[];
  tiers: string[];
}

// ---------- Deep Research Types ----------

export interface DeepResearchResult {
  generated_at: string;
  market_overview: string;
  discovered_events: DiscoveredEvent[];
  signal_dashboard: SignalDashboard;
  on_sales: OnSaleDiscovery[];
  risk_alerts: RiskAlert[];
  sources: Citation[];
  recommended_focus: string;
}

export interface DiscoveredEvent {
  event_name: string;
  artist_or_team: string;
  event_date: string;
  venue: string;
  city: string;
  state: string;
  category: "concert" | "sports" | "theater" | "comedy" | "festival";
  edge_score: number;
  demand_score: number;
  supply_score: number;
  roi_score: number;
  timing_score: number;
  inefficiency_score: number;
  face_value_range: string | null;
  secondary_floor: number | null;
  secondary_median: number | null;
  inventory_level: "scarce" | "tight" | "moderate" | "abundant";
  sell_through_pct: number | null;
  price_velocity: "surging" | "rising" | "stable" | "declining" | "crashing";
  action: "BUY" | "SELL" | "HOLD" | "WATCH";
  confidence: number;
  estimated_roi_pct: number;
  reasoning: string;
  source_citations: number[];
}

export interface SignalDashboard {
  social: SignalEntry[];
  streaming: SignalEntry[];
  search_trends: SignalEntry[];
  news: SignalEntry[];
  market: SignalEntry[];
}

export interface SignalEntry {
  source: string;
  metric: string;
  value: string;
  direction: "up" | "stable" | "down";
  strength: "strong" | "moderate" | "weak";
  affected_events: string[];
  detail: string;
}

export interface OnSaleDiscovery {
  event_name: string;
  date: string;
  time: string;
  timezone: string;
  platform: string;
  sale_type: "general" | "presale" | "amex" | "fan_club" | "venue";
  profit_potential: "high" | "medium" | "low";
  notes: string;
  region: string;
}

export interface RiskAlert {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  affected_events: string[];
  defensive_action: string;
}

export interface Citation {
  index: number;
  title: string;
  url: string;
  snippet: string;
}

export interface DeepResearchRequest {
  regions?: string[];
  categories?: string[];
  dateRange?: "this_week" | "next_2_weeks" | "this_month" | "next_3_months";
  effortLevel?: "standard" | "deep";
  focusAreas?: string[];
}

export interface PerformanceAnalysis {
  overall_assessment: string;
  grade: string;
  strengths: { pattern: string; evidence: string; recommendation: string }[];
  weaknesses: { pattern: string; evidence: string; recommendation: string }[];
  insights: { insight: string; data_point: string; actionable_next_step: string }[];
  optimal_profile: {
    best_category: string;
    best_hold_period: string;
    best_venue: string;
    sweet_spot_price_range: string;
  };
  mistakes_to_avoid: string[];
  next_month_focus: string;
}
