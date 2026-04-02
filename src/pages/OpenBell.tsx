import { useState, useEffect, useCallback, useMemo } from "react";
import { callLLM } from "../components/APIClient";
import { callDeepResearch } from "../components/APIClient";
import type { DeepResearchResponse } from "../components/APIClient";
import { SAMPLE_BRIEF } from "../lib/sampleData";
import { getTodayBrief, saveBrief, getCachedResearch, saveResearchCache } from "../lib/api";
import { OPEN_BELL_PROMPT } from "../lib/prompts";
import type {
  BriefData,
  PriorityEvent,
  OnSale,
  SocialSignal,
  DeepResearchResult,
  DiscoveredEvent,
  SignalEntry,
  OnSaleDiscovery,
  RiskAlert,
} from "../lib/types";
import {
  AlertTriangle,
  Copy,
  Check,
  Loader2,
  Activity,
  ShoppingCart,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Zap,
  Radio,
  Target,
  CalendarClock,
  Search,
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
  SlidersHorizontal,
  ExternalLink,
  Shield,
  Music,
  Trophy,
  Theater,
  Clock,
  Sparkles,
  ArrowUpDown,
  Filter,
  MapPin,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Sub-components (shared)
// ---------------------------------------------------------------------------

const ACTION_STYLES: Record<string, { bg: string; text: string }> = {
  BUY: { bg: "#064e3b", text: "#6ee7b7" },
  SELL: { bg: "#7f1d1d", text: "#fca5a5" },
  HOLD: { bg: "#78350f", text: "#fcd34d" },
  WATCH: { bg: "#1e3a5f", text: "#93c5fd" },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] ?? { bg: "#374151", text: "#d1d5db" };
  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        fontFamily: "monospace",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "1px",
        padding: "2px 8px",
        borderRadius: "4px",
        textTransform: "uppercase" as const,
      }}
    >
      {action}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 85 ? "#6ee7b7" : value >= 70 ? "#fcd34d" : "#fca5a5";
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1f2937" }}>
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            borderRadius: 3,
            background: color,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: "12px", color, minWidth: 32, textAlign: "right" as const }}>
        {value}%
      </span>
    </div>
  );
}

function EdgeScoreBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "#10b981" : value >= 60 ? "#6ee7b7" : value >= 40 ? "#fcd34d" : value >= 20 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 100 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#1f2937" }}>
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            borderRadius: 4,
            background: `linear-gradient(90deg, #ef4444, #f59e0b, #10b981)`,
            clipPath: `inset(0 ${100 - value}% 0 0)`,
            transition: "clip-path 0.6s ease",
          }}
        />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color, minWidth: 28, textAlign: "right" as const }}>
        {value}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
      <div style={{ fontSize: "10px", letterSpacing: "1px", color: "#6b7280", textTransform: "uppercase" as const, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
        {icon}
        {label}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: "28px", fontWeight: 700, color: accent ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function computeCountdown() {
  const now = new Date();
  const mtNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
  const target = new Date(mtNow);
  target.setHours(7, 15, 0, 0);
  if (mtNow >= target) target.setDate(target.getDate() + 1);
  const diff = target.getTime() - mtNow.getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function CountdownTimer() {
  const [display, setDisplay] = useState(computeCountdown);
  useEffect(() => {
    const id = setInterval(() => setDisplay(computeCountdown()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: "10px", letterSpacing: "1px", color: "#6b7280", textTransform: "uppercase" as const }}>Next Bell</span>
      <span style={{ fontFamily: "monospace", fontSize: "14px", color: "#6ee7b7", background: "#064e3b", padding: "2px 8px", borderRadius: "4px" }}>{display}</span>
    </div>
  );
}

function ImpactDot({ impact }: { impact: string }) {
  const colors: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#6b7280" };
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colors[impact] || "#6b7280", flexShrink: 0 }} />;
}

function ProfitBadge({ level }: { level: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    high: { bg: "#064e3b", text: "#6ee7b7", label: "HIGH" },
    medium: { bg: "#78350f", text: "#fcd34d", label: "MED" },
    low: { bg: "#1f2937", text: "#6b7280", label: "LOW" },
  };
  const s = map[level] || map.low;
  return <span style={{ background: s.bg, color: s.text, fontFamily: "monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", padding: "2px 6px", borderRadius: "4px" }}>{s.label}</span>;
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "up") return <TrendingUp size={12} style={{ color: "#10b981" }} />;
  if (direction === "down") return <TrendingDown size={12} style={{ color: "#ef4444" }} />;
  return <Minus size={12} style={{ color: "#6b7280" }} />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    critical: { bg: "#7f1d1d", text: "#fca5a5" },
    warning: { bg: "#78350f", text: "#fcd34d" },
    info: { bg: "#1e3a5f", text: "#93c5fd" },
  };
  const s = map[severity] || map.info;
  return <span style={{ background: s.bg, color: s.text, fontFamily: "monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase" as const }}>{severity}</span>;
}

function CategoryIcon({ category }: { category: string }) {
  const size = 14;
  const style = { color: "var(--text-muted)", flexShrink: 0 };
  switch (category) {
    case "concert": return <Music size={size} style={style} />;
    case "sports": return <Trophy size={size} style={style} />;
    case "theater": return <Theater size={size} style={style} />;
    default: return <Sparkles size={size} style={style} />;
  }
}

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "1px",
  color: "#6b7280",
  textTransform: "uppercase",
  marginBottom: "12px",
  fontWeight: 600,
};

// ---------------------------------------------------------------------------
// Score weight recalculation
// ---------------------------------------------------------------------------
function recalcEdgeScore(
  event: DiscoveredEvent,
  weights: { demand: number; supply: number; roi: number; timing: number; inefficiency: number }
): number {
  const total = weights.demand + weights.supply + weights.roi + weights.timing + weights.inefficiency;
  if (total === 0) return 0;
  return Math.round(
    (event.demand_score * weights.demand +
      event.supply_score * weights.supply +
      event.roi_score * weights.roi +
      event.timing_score * weights.timing +
      event.inefficiency_score * weights.inefficiency) /
      total
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type MainTab = "dashboard" | "rankings" | "signals" | "onsales" | "brief";

export default function OpenBell() {
  // Quick Brief state (preserved)
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  // Deep Research state
  const [research, setResearch] = useState<DeepResearchResult | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchMeta, setResearchMeta] = useState<DeepResearchResponse["metadata"] | null>(null);

  // Shared
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const [copied, setCopied] = useState(false);

  // Deep Research filters
  const [regionFilter, setRegionFilter] = useState<string[]>(["nationwide"]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("next_2_weeks");
  const [scoreThreshold, setScoreThreshold] = useState(0);
  const [sortColumn, setSortColumn] = useState<string>("edge_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights] = useState({ demand: 25, supply: 20, roi: 25, timing: 15, inefficiency: 15 });

  // Quick Brief filters
  const [briefCategoryFilter, setBriefCategoryFilter] = useState<string>("all");
  const [briefActionFilter, setBriefActionFilter] = useState<string>("all");
  const [briefExpandedEvent, setBriefExpandedEvent] = useState<number | null>(null);
  const [briefActiveTab, setBriefActiveTab] = useState<"brief" | "events" | "signals">("brief");

  // Load cached data on mount
  useEffect(() => {
    getTodayBrief().then(data => { if (data) setBrief(data); }).catch(() => {});
    getCachedResearch({ regions: regionFilter, categories: [], dateRange }).then(data => { if (data) setResearch(data); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Deep Research generation
  // -----------------------------------------------------------------------
  const generateResearch = useCallback(async () => {
    setResearchLoading(true);
    setError(null);
    try {
      const response = await callDeepResearch({
        regions: regionFilter,
        categories: categoryFilter !== "all" ? [categoryFilter] : [],
        dateRange: dateRange as "this_week" | "next_2_weeks" | "this_month" | "next_3_months",
        effortLevel: "standard",
      });
      setResearch(response.result);
      setResearchMeta(response.metadata);
      saveResearchCache(response.result, {
        regions: regionFilter,
        categories: categoryFilter !== "all" ? [categoryFilter] : [],
        dateRange,
      }, response.metadata as unknown as Record<string, unknown>).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deep research failed. Check API keys in Supabase.");
    } finally {
      setResearchLoading(false);
    }
  }, [regionFilter, categoryFilter, dateRange]);

  // -----------------------------------------------------------------------
  // Quick Brief generation (preserved)
  // -----------------------------------------------------------------------
  const generateBrief = useCallback(async () => {
    setBriefLoading(true);
    setError(null);
    try {
      const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const prompt = OPEN_BELL_PROMPT.buildPrompt({ date, searchResults: "${searchResults}" });
      const searchQueries = typeof OPEN_BELL_PROMPT.searchQueries === "function" ? OPEN_BELL_PROMPT.searchQueries({}) : OPEN_BELL_PROMPT.searchQueries;
      const raw = await callLLM({ prompt, modelTier: OPEN_BELL_PROMPT.model, maxTokens: OPEN_BELL_PROMPT.maxTokens, searchQueries });
      const parsed: BriefData = JSON.parse(raw);
      setBrief(parsed);
      saveBrief(parsed).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate brief. Check your API key.");
    } finally {
      setBriefLoading(false);
    }
  }, []);

  const loadDemo = useCallback(() => { setBrief(SAMPLE_BRIEF); }, []);

  // -----------------------------------------------------------------------
  // Derived data — Rankings with recalculated scores and sorting
  // -----------------------------------------------------------------------
  const rankedEvents = useMemo(() => {
    if (!research?.discovered_events) return [];
    return research.discovered_events
      .map(e => ({ ...e, edge_score: recalcEdgeScore(e, weights) }))
      .filter(e => categoryFilter === "all" || e.category === categoryFilter)
      .filter(e => actionFilter === "all" || e.action === actionFilter)
      .filter(e => e.edge_score >= scoreThreshold)
      .sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortColumn] as number;
        const bVal = (b as Record<string, unknown>)[sortColumn] as number;
        return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [research, weights, categoryFilter, actionFilter, scoreThreshold, sortColumn, sortDirection]);

  // Quick Brief filtered events
  const filteredBriefEvents: PriorityEvent[] = brief
    ? brief.priority_events
        .filter(e => briefCategoryFilter === "all" || e.category === briefCategoryFilter)
        .filter(e => briefActionFilter === "all" || e.action === briefActionFilter)
        .sort((a, b) => b.confidence - a.confidence)
    : [];

  const avgConfidence = brief
    ? Math.round(brief.priority_events.reduce((s, e) => s + e.confidence, 0) / (brief.priority_events.length || 1))
    : 0;

  // Slack export
  const handleCopySlack = useCallback(async () => {
    let text = "";
    if (research && activeTab !== "brief") {
      const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      text = `*DEEP RESEARCH REPORT — ${today}*\n`;
      text += `> ${research.market_overview}\n\n`;
      text += `*Top Opportunities (by Edge Score):*\n`;
      for (const e of rankedEvents.slice(0, 10)) {
        text += `${e.action} — ${e.event_name} | Edge: ${e.edge_score} | ${e.confidence}% conf | ~${e.estimated_roi_pct > 0 ? "+" : ""}${e.estimated_roi_pct}% ROI\n`;
      }
      text += `\n*Focus:*\n${research.recommended_focus}\n`;
    } else if (brief) {
      const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      text = `*OPEN BELL — ${today}*\n`;
      text += `> ${brief.market_summary}\n\n`;
      text += `*Priority Events:*\n`;
      for (const e of brief.priority_events) {
        text += `${e.action} — ${e.event_name} (${e.confidence}% conf, ~${e.estimated_roi_pct > 0 ? "+" : ""}${e.estimated_roi_pct}% ROI)\n`;
      }
      text += `\n*Today's Focus:*\n${brief.recommended_focus}\n`;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [research, brief, rankedEvents, activeTab]);

  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Denver" });

  const loading = researchLoading || briefLoading;

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  };

  // Tabs
  const tabs: { key: MainTab; label: string; icon: typeof Target }[] = [
    { key: "dashboard", label: "Dashboard", icon: Activity },
    { key: "rankings", label: "Rankings", icon: BarChart3 },
    { key: "signals", label: "Signals", icon: Radio },
    { key: "onsales", label: "On-Sales", icon: ShoppingCart },
    { key: "brief", label: "Quick Brief", icon: Zap },
  ];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* ===== HEADER ===== */}
      <header style={{ borderBottom: "1px solid var(--border-default)", padding: "16px 24px" }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#6ee7b7" }} />
                <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: "#10b981" }} />
              </span>
              <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px", color: "var(--text-primary)", margin: 0 }}>
                Deep Research
              </h1>
              <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "1.5px", color: "#6ee7b7", background: "#064e3b", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase" as const }}>
                BETA
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>{todayStr}</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <CountdownTimer />
            {/* Region selector */}
            <select
              value={regionFilter[0]}
              onChange={e => setRegionFilter([e.target.value])}
              title="Region filter"
              className="rounded px-2 py-1.5 text-xs border outline-none"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            >
              <option value="nationwide">Nationwide</option>
              <option value="Denver">Denver</option>
              <option value="Los Angeles">Los Angeles</option>
              <option value="New York">New York</option>
              <option value="Chicago">Chicago</option>
              <option value="Miami">Miami</option>
              <option value="Dallas">Dallas</option>
              <option value="Atlanta">Atlanta</option>
              <option value="San Francisco">San Francisco</option>
              <option value="Nashville">Nashville</option>
              <option value="Las Vegas">Las Vegas</option>
            </select>
            {/* Date range */}
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              title="Date range filter"
              className="rounded px-2 py-1.5 text-xs border outline-none"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            >
              <option value="this_week">This Week</option>
              <option value="next_2_weeks">Next 2 Weeks</option>
              <option value="this_month">This Month</option>
              <option value="next_3_months">Next 3 Months</option>
            </select>
            <button
              onClick={generateResearch}
              disabled={loading}
              className="flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{ background: "#059669", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              <Search size={14} />
              {researchLoading ? "Researching..." : "Deep Research"}
            </button>
            <button
              onClick={handleCopySlack}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", color: copied ? "#6ee7b7" : "var(--text-secondary)", borderRadius: "6px", padding: "8px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Slack"}
            </button>
          </div>
        </div>
      </header>

      {/* ===== TAB NAV ===== */}
      <nav className="flex gap-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-default)", padding: "0 24px" }}>
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === t.key ? "2px solid #10b981" : "2px solid transparent",
                color: activeTab === t.key ? "var(--text-primary)" : "var(--text-muted)",
                padding: "12px 16px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.3px",
                transition: "color 0.15s, border-color 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* ===== CONTENT ===== */}
      <main style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {/* LOADING */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 400 }}>
            <Loader2 size={32} className="animate-spin" style={{ color: "#10b981" }} />
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              {researchLoading ? "Running deep research — searching Ticketmaster, StubHub, SeatGeek, Vivid Seats..." : "Scanning markets, aggregating signals..."}
            </p>
            {researchLoading && (
              <p style={{ color: "var(--text-muted)", fontSize: "11px" }}>This may take 30-60 seconds for comprehensive analysis</p>
            )}
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 400 }}>
            <AlertTriangle size={48} style={{ color: "#f59e0b" }} />
            <p style={{ color: "#fcd34d", fontSize: "14px", textAlign: "center", maxWidth: 420, lineHeight: 1.6 }}>{error}</p>
            <div className="flex gap-3">
              <button onClick={generateResearch} className="text-sm px-4 py-2 rounded" style={{ background: "#059669", color: "#fff" }}>Retry</button>
              <button onClick={loadDemo} className="text-sm px-4 py-2 rounded border" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>Load demo brief</button>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="rounded-lg border p-4 mb-4" style={{ background: '#451a1a', borderColor: '#f8717140', color: '#f87171' }}>
            <p className="font-semibold mb-1">Brief generation failed</p>
            <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !research && !brief && !error && (
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 400 }}>
            <Globe size={48} style={{ color: "#374151" }} />
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", maxWidth: 420, lineHeight: 1.6 }}>
              Click <strong style={{ color: "#6ee7b7" }}>Deep Research</strong> to discover nationwide event opportunities with AI-powered analysis, or use <strong style={{ color: "var(--text-secondary)" }}>Quick Brief</strong> tab for your Denver morning brief.
            </p>
          </div>
        )}

        {/* ================================================================ */}
        {/* DASHBOARD TAB */}
        {/* ================================================================ */}
        {!loading && activeTab === "dashboard" && research && (
          <div className="flex flex-col gap-6">
            {/* Market Overview */}
            <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,78,59,0.15) 100%)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", padding: "20px" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <Activity size={14} style={{ color: "#10b981" }} />
                <span style={labelStyle}>Market Overview</span>
                {researchMeta && (
                  <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--text-muted)" }}>
                    {researchMeta.total_sources} sources · {Math.round(researchMeta.generation_time_ms / 1000)}s
                  </span>
                )}
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.65, margin: 0 }}>{research.market_overview}</p>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <MetricCard label="Events Found" value={research.discovered_events.length} icon={<Target size={12} />} accent="#6ee7b7" />
              <MetricCard label="Avg Edge Score" value={rankedEvents.length > 0 ? Math.round(rankedEvents.reduce((s, e) => s + e.edge_score, 0) / rankedEvents.length) : 0} icon={<BarChart3 size={12} />} accent="#fcd34d" />
              <MetricCard label="On-Sales" value={research.on_sales.length} icon={<ShoppingCart size={12} />} accent="#93c5fd" />
              <MetricCard label="Risk Alerts" value={research.risk_alerts.length} icon={<AlertTriangle size={12} />} accent={research.risk_alerts.length > 0 ? "#fca5a5" : "#6ee7b7"} />
              <MetricCard label="BUY Signals" value={research.discovered_events.filter(e => e.action === "BUY").length} icon={<TrendingUp size={12} />} accent="#10b981" />
              <MetricCard label="Total Signals" value={Object.values(research.signal_dashboard).reduce((s, arr) => s + arr.length, 0)} icon={<Radio size={12} />} accent="#a78bfa" />
            </div>

            {/* Game Plan */}
            <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(88,28,135,0.12) 100%)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "8px", padding: "20px" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <Target size={14} style={{ color: "#a78bfa" }} />
                <span style={{ ...labelStyle, color: "#a78bfa" }}>Today&apos;s Game Plan</span>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{research.recommended_focus}</p>
            </div>

            {/* Top 5 opportunities quick list */}
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <Sparkles size={14} style={{ color: "#10b981" }} />
                <span style={labelStyle}>Top Opportunities</span>
              </div>
              <div className="flex flex-col gap-2">
                {rankedEvents.slice(0, 5).map((event, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: 700, color: "#10b981", width: 28, textAlign: "center" }}>#{i + 1}</span>
                    <CategoryIcon category={event.category} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{event.event_name}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{event.venue} · {event.event_date}</div>
                    </div>
                    <ActionBadge action={event.action} />
                    <div style={{ minWidth: 100 }}><EdgeScoreBar value={event.edge_score} /></div>
                    <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: event.estimated_roi_pct >= 0 ? "#6ee7b7" : "#fca5a5", minWidth: 50, textAlign: "right" }}>
                      {event.estimated_roi_pct > 0 ? "+" : ""}{event.estimated_roi_pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Alerts */}
            {research.risk_alerts.length > 0 && (
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                  <Shield size={14} style={{ color: "#f59e0b" }} />
                  <span style={{ ...labelStyle, color: "#f59e0b" }}>Risk Alerts</span>
                </div>
                <div className="flex flex-col gap-3">
                  {research.risk_alerts.map((alert: RiskAlert, i: number) => (
                    <div key={i} style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(120,53,15,0.1) 100%)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "14px 16px" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <SeverityBadge severity={alert.severity} />
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{alert.title}</span>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>{alert.detail}</p>
                      <p className="text-xs" style={{ color: "#fcd34d", margin: 0 }}><strong>Action:</strong> {alert.defensive_action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* RANKINGS TAB */}
        {/* ================================================================ */}
        {!loading && activeTab === "rankings" && research && (
          <div className="flex flex-col gap-5">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
              <Filter size={14} style={{ color: "var(--text-muted)" }} />
              <span style={{ ...labelStyle, marginBottom: 0 }}>Category</span>
              {["all", "concert", "sports", "theater", "comedy", "festival"].map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ background: categoryFilter === cat ? "#1f2937" : "transparent", border: categoryFilter === cat ? "1px solid #374151" : "1px solid transparent", color: categoryFilter === cat ? "var(--text-primary)" : "var(--text-muted)", borderRadius: "4px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>{cat === "all" ? "All" : cat}</button>
              ))}
              <div style={{ width: 1, height: 20, background: "var(--border-default)", margin: "0 4px" }} />
              <span style={{ ...labelStyle, marginBottom: 0 }}>Action</span>
              {["all", "BUY", "SELL", "HOLD", "WATCH"].map(act => (
                <button key={act} onClick={() => setActionFilter(act)} style={{ background: actionFilter === act ? (ACTION_STYLES[act]?.bg ?? "#1f2937") : "transparent", border: actionFilter === act ? `1px solid ${ACTION_STYLES[act]?.text ?? "#374151"}33` : "1px solid transparent", color: actionFilter === act ? (ACTION_STYLES[act]?.text ?? "var(--text-primary)") : "var(--text-muted)", borderRadius: "4px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: act !== "all" ? "monospace" : "inherit" }}>{act === "all" ? "All" : act}</button>
              ))}
              <div style={{ width: 1, height: 20, background: "var(--border-default)", margin: "0 4px" }} />
              <span style={{ ...labelStyle, marginBottom: 0 }}>Min Score</span>
              <input type="range" min={0} max={80} step={5} value={scoreThreshold} onChange={e => setScoreThreshold(Number(e.target.value))} title="Minimum edge score" style={{ width: 80 }} />
              <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-muted)" }}>{scoreThreshold}</span>
              <button onClick={() => setShowWeights(!showWeights)} className="flex items-center gap-1 ml-auto" style={{ background: showWeights ? "#1f2937" : "transparent", border: "1px solid var(--border-default)", color: "var(--text-muted)", borderRadius: "4px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                <SlidersHorizontal size={12} /> Weights
              </button>
            </div>

            {/* Weight sliders */}
            {showWeights && (
              <div className="p-4 rounded-lg border grid grid-cols-2 md:grid-cols-5 gap-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                {(["demand", "supply", "roi", "timing", "inefficiency"] as const).map(key => (
                  <div key={key}>
                    <label className="text-xs uppercase" style={{ color: "var(--text-muted)", letterSpacing: "1px" }}>{key} ({weights[key]})</label>
                    <input type="range" min={0} max={50} step={5} value={weights[key]} onChange={e => setWeights(w => ({ ...w, [key]: Number(e.target.value) }))} title={`${key} weight`} className="w-full mt-1" />
                  </div>
                ))}
              </div>
            )}

            {/* Rankings table */}
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
              <table className="w-full text-sm" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-default)" }}>
                    <th className="text-left py-2.5 px-3" style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, width: 40 }}>#</th>
                    <th className="text-left py-2.5 px-3" style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Event</th>
                    <th className="text-left py-2.5 px-3" style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Date</th>
                    <th className="text-center py-2.5 px-3" style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Action</th>
                    {[
                      { key: "edge_score", label: "Edge" },
                      { key: "demand_score", label: "Demand" },
                      { key: "supply_score", label: "Supply" },
                      { key: "roi_score", label: "ROI" },
                      { key: "confidence", label: "Conf" },
                    ].map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} className="text-right py-2.5 px-3 cursor-pointer hover:opacity-80" style={{ color: sortColumn === col.key ? "#10b981" : "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortColumn === col.key && (sortDirection === "desc" ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
                          {sortColumn !== col.key && <ArrowUpDown size={10} style={{ opacity: 0.3 }} />}
                        </span>
                      </th>
                    ))}
                    <th className="text-right py-2.5 px-3" style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>ROI%</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedEvents.map((event, i) => (
                    <>
                      <tr
                        key={`row-${i}`}
                        onClick={() => setExpandedEvent(expandedEvent === i ? null : i)}
                        className="cursor-pointer transition-colors"
                        style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border-default)" }}
                      >
                        <td className="py-2.5 px-3" style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{i + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <CategoryIcon category={event.category} />
                            <div>
                              <div className="font-medium truncate" style={{ color: "var(--text-primary)", maxWidth: 240 }}>{event.event_name}</div>
                              <div className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}><MapPin size={10} />{event.city}, {event.state}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs" style={{ color: "var(--text-muted)" }}>{event.event_date}</td>
                        <td className="py-2.5 px-3 text-center"><ActionBadge action={event.action} /></td>
                        <td className="py-2.5 px-3 text-right" style={{ fontFamily: "monospace", fontWeight: 700, color: event.edge_score >= 70 ? "#10b981" : event.edge_score >= 50 ? "#fcd34d" : "#fca5a5" }}>{event.edge_score}</td>
                        <td className="py-2.5 px-3 text-right" style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{event.demand_score}</td>
                        <td className="py-2.5 px-3 text-right" style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{event.supply_score}</td>
                        <td className="py-2.5 px-3 text-right" style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{event.roi_score}</td>
                        <td className="py-2.5 px-3 text-right"><ConfidenceBar value={event.confidence ?? 50} /></td>
                        <td className="py-2.5 px-3 text-right" style={{ fontFamily: "monospace", fontWeight: 700, color: event.estimated_roi_pct >= 0 ? "#6ee7b7" : "#fca5a5" }}>
                          {event.estimated_roi_pct > 0 ? "+" : ""}{event.estimated_roi_pct}%
                        </td>
                      </tr>
                      {expandedEvent === i && (
                        <tr key={`detail-${i}`}>
                          <td colSpan={10} style={{ background: "rgba(0,0,0,0.15)", padding: "16px 24px", borderBottom: "1px solid var(--border-default)" }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div style={labelStyle}>Reasoning</div>
                                <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{event.reasoning}</p>
                              </div>
                              <div>
                                <div style={labelStyle}>Market Data</div>
                                <div className="grid grid-cols-2 gap-2 text-xs" style={{ fontFamily: "monospace" }}>
                                  <div><span style={{ color: "var(--text-muted)" }}>Face Value:</span> <span style={{ color: "var(--text-primary)" }}>{event.face_value_range || "N/A"}</span></div>
                                  <div><span style={{ color: "var(--text-muted)" }}>Floor:</span> <span style={{ color: "var(--text-primary)" }}>{event.secondary_floor ? `$${event.secondary_floor}` : "N/A"}</span></div>
                                  <div><span style={{ color: "var(--text-muted)" }}>Median:</span> <span style={{ color: "var(--text-primary)" }}>{event.secondary_median ? `$${event.secondary_median}` : "N/A"}</span></div>
                                  <div><span style={{ color: "var(--text-muted)" }}>Inventory:</span> <span style={{ color: "var(--text-primary)" }}>{event.inventory_level}</span></div>
                                  <div><span style={{ color: "var(--text-muted)" }}>Velocity:</span> <span style={{ color: event.price_velocity === "surging" || event.price_velocity === "rising" ? "#10b981" : event.price_velocity === "declining" || event.price_velocity === "crashing" ? "#ef4444" : "var(--text-primary)" }}>{event.price_velocity}</span></div>
                                  <div><span style={{ color: "var(--text-muted)" }}>Sell-through:</span> <span style={{ color: "var(--text-primary)" }}>{event.sell_through_pct != null ? `${event.sell_through_pct}%` : "N/A"}</span></div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div style={{ ...labelStyle, marginBottom: 6 }}>Score Breakdown</div>
                              <div className="flex gap-3 flex-wrap text-xs" style={{ fontFamily: "monospace" }}>
                                {(["demand_score", "supply_score", "roi_score", "timing_score", "inefficiency_score"] as const).map(key => (
                                  <span key={key} className="px-2 py-1 rounded" style={{ background: "#1f2937", color: "var(--text-secondary)" }}>
                                    {key.replace("_score", "")}: {event[key]}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {(event.source_citations?.length ?? 0) > 0 && research.sources && (
                              <div className="mt-3">
                                <div style={{ ...labelStyle, marginBottom: 6 }}>Sources</div>
                                <div className="flex flex-wrap gap-2">
                                  {(event.source_citations ?? []).map(idx => {
                                    const src = research.sources[idx - 1];
                                    if (!src) return null;
                                    return (
                                      <a key={idx} href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80" style={{ background: "#1e3a5f", color: "#93c5fd", textDecoration: "none" }}>
                                        <ExternalLink size={10} /> [{idx}] {src.title.slice(0, 40)}...
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {rankedEvents.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>No events match the current filters.</p>
              )}
            </div>
            <div className="text-xs text-right" style={{ color: "var(--text-muted)" }}>
              Showing {rankedEvents.length} of {research.discovered_events.length} events
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SIGNALS TAB */}
        {/* ================================================================ */}
        {!loading && activeTab === "signals" && research && (
          <div className="flex flex-col gap-6">
            {(["social", "streaming", "search_trends", "news", "market"] as const).map(category => {
              const signals: SignalEntry[] = research.signal_dashboard[category] || [];
              if (signals.length === 0) return null;
              const iconMap: Record<string, React.ReactNode> = {
                social: <Radio size={14} style={{ color: "#a78bfa" }} />,
                streaming: <Music size={14} style={{ color: "#10b981" }} />,
                search_trends: <Search size={14} style={{ color: "#3b82f6" }} />,
                news: <Zap size={14} style={{ color: "#f59e0b" }} />,
                market: <BarChart3 size={14} style={{ color: "#ef4444" }} />,
              };
              const colorMap: Record<string, string> = { social: "#a78bfa", streaming: "#10b981", search_trends: "#3b82f6", news: "#f59e0b", market: "#ef4444" };
              return (
                <div key={category}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                    {iconMap[category]}
                    <span style={{ ...labelStyle, color: colorMap[category], marginBottom: 0 }}>{category.replace("_", " ")}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#1f2937", color: "var(--text-muted)" }}>{signals.length}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {signals.map((sig: SignalEntry, i: number) => (
                      <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "14px 16px" }}>
                        <div className="flex items-center gap-3 mb-2">
                          <DirectionIcon direction={sig.direction} />
                          <span style={{ fontSize: "11px", letterSpacing: "0.5px", color: "var(--text-muted)", textTransform: "uppercase" as const, fontWeight: 600 }}>{sig.source}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: sig.strength === "strong" ? "#064e3b" : sig.strength === "moderate" ? "#78350f" : "#1f2937", color: sig.strength === "strong" ? "#6ee7b7" : sig.strength === "moderate" ? "#fcd34d" : "#6b7280" }}>{sig.strength}</span>
                          <span className="text-xs" style={{ marginLeft: "auto", fontFamily: "monospace", color: "var(--text-muted)" }}>{sig.metric}: {sig.value}</span>
                        </div>
                        <p className="text-sm mb-2" style={{ color: "var(--text-primary)", lineHeight: 1.5, margin: "0 0 8px 0" }}>{sig.detail}</p>
                        <div className="flex flex-wrap gap-2">
                          {sig.affected_events.map((evt, j) => (
                            <span key={j} style={{ fontSize: "11px", color: "var(--text-muted)", background: "#1f2937", padding: "2px 8px", borderRadius: "4px", border: "1px solid #374151" }}>{evt}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================================================================ */}
        {/* ON-SALES TAB */}
        {/* ================================================================ */}
        {!loading && activeTab === "onsales" && research && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} style={{ color: "#93c5fd" }} />
              <span style={{ ...labelStyle, color: "#93c5fd", marginBottom: 0 }}>Upcoming On-Sales</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#1e3a5f", color: "#93c5fd" }}>{research.on_sales.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {research.on_sales.map((sale: OnSaleDiscovery, i: number) => (
                <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#6ee7b7" }}>{sale.time} {sale.timezone}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#1f2937", color: "var(--text-muted)" }}>{sale.sale_type}</span>
                    </div>
                    <ProfitBadge level={sale.profit_potential} />
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px 0" }}>{sale.event_name}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs" style={{ color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{sale.platform}</span>
                    <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}><MapPin size={10} />{sale.region}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{sale.notes}</p>
                </div>
              ))}
            </div>
            {research.on_sales.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>No on-sales detected in the current research.</p>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* QUICK BRIEF TAB (preserved original) */}
        {/* ================================================================ */}
        {!loading && activeTab === "brief" && (
          <div className="flex flex-col gap-6">
            {/* Quick Brief header */}
            <div className="flex items-center gap-3">
              <Zap size={16} style={{ color: "#f59e0b" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Denver Morning Brief</span>
              <button onClick={generateBrief} disabled={briefLoading} className="flex items-center gap-1.5 ml-auto text-xs px-3 py-1.5 rounded" style={{ background: "#059669", color: "#fff", opacity: briefLoading ? 0.6 : 1 }}>
                {briefLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Generate
              </button>
              <button onClick={loadDemo} className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>Demo</button>
            </div>

            {!brief && (
              <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 300 }}>
                <CalendarClock size={48} style={{ color: "#374151" }} />
                <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", maxWidth: 360, lineHeight: 1.6 }}>
                  No brief loaded. Click <strong style={{ color: "#6ee7b7" }}>Generate</strong> for real-time Denver market intel, or <strong style={{ color: "var(--text-secondary)" }}>Demo</strong> for sample data.
                </p>
              </div>
            )}

            {brief && (
              <>
                {/* Brief sub-tabs */}
                <div className="flex gap-0" style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {(["brief", "events", "signals"] as const).map(t => (
                    <button key={t} onClick={() => setBriefActiveTab(t)} style={{ background: "transparent", border: "none", borderBottom: briefActiveTab === t ? "2px solid #10b981" : "2px solid transparent", color: briefActiveTab === t ? "var(--text-primary)" : "var(--text-muted)", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>{t === "brief" ? "Overview" : t}</button>
                  ))}
                </div>

                {briefActiveTab === "brief" && (
                  <div className="flex flex-col gap-5">
                    <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,78,59,0.15) 100%)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", padding: "20px" }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                        <Activity size={14} style={{ color: "#10b981" }} />
                        <span style={labelStyle}>Market Overview</span>
                      </div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.65, margin: 0 }}>{brief.market_summary}</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <MetricCard label="Priority Events" value={brief.priority_events.length} icon={<Target size={12} />} accent="#6ee7b7" />
                      <MetricCard label="On-Sales Today" value={brief.on_sales_today.length} icon={<ShoppingCart size={12} />} accent="#93c5fd" />
                      <MetricCard label="Avg Confidence" value={`${avgConfidence}%`} icon={<BarChart3 size={12} />} accent="#fcd34d" />
                      <MetricCard label="Risk Alerts" value={brief.risk_alerts.length} icon={<AlertTriangle size={12} />} accent={brief.risk_alerts.length > 0 ? "#fca5a5" : "#6ee7b7"} />
                    </div>
                    <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(88,28,135,0.12) 100%)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "8px", padding: "20px" }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                        <Target size={14} style={{ color: "#a78bfa" }} />
                        <span style={{ ...labelStyle, color: "#a78bfa" }}>Today&apos;s Game Plan</span>
                      </div>
                      <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{brief.recommended_focus}</p>
                    </div>
                    {brief.risk_alerts.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                          <AlertTriangle size={14} style={{ color: "#f59e0b" }} />
                          <span style={{ ...labelStyle, color: "#f59e0b" }}>Risk Alerts</span>
                        </div>
                        <div className="flex flex-col gap-3">
                          {brief.risk_alerts.map((alert, i) => (
                            <div key={i} style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(120,53,15,0.1) 100%)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "14px 16px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                              <AlertTriangle size={13} style={{ color: "#f59e0b", display: "inline", marginRight: 8, verticalAlign: "middle" }} />
                              {alert}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {brief.on_sales_today.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                          <ShoppingCart size={14} style={{ color: "#93c5fd" }} />
                          <span style={{ ...labelStyle, color: "#93c5fd" }}>On-Sales Today</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {brief.on_sales_today.map((sale: OnSale, i: number) => (
                            <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
                              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#6ee7b7" }}>{sale.time}</span>
                                <ProfitBadge level={sale.profit_potential} />
                              </div>
                              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px 0" }}>{sale.event_name}</p>
                              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0 0 8px 0", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{sale.platform}</p>
                              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{sale.notes}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {briefActiveTab === "events" && (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                      <span style={{ ...labelStyle, marginBottom: 0 }}>Category</span>
                      {["all", "concert", "sports", "theater"].map(cat => (
                        <button key={cat} onClick={() => setBriefCategoryFilter(cat)} style={{ background: briefCategoryFilter === cat ? "#1f2937" : "transparent", border: briefCategoryFilter === cat ? "1px solid #374151" : "1px solid transparent", color: briefCategoryFilter === cat ? "var(--text-primary)" : "var(--text-muted)", borderRadius: "4px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>{cat === "all" ? "All" : cat}</button>
                      ))}
                      <div style={{ width: 1, height: 20, background: "var(--border-default)", margin: "0 4px" }} />
                      <span style={{ ...labelStyle, marginBottom: 0 }}>Action</span>
                      {["all", "BUY", "SELL", "HOLD", "WATCH"].map(act => (
                        <button key={act} onClick={() => setBriefActionFilter(act)} style={{ background: briefActionFilter === act ? (ACTION_STYLES[act]?.bg ?? "#1f2937") : "transparent", border: briefActionFilter === act ? `1px solid ${ACTION_STYLES[act]?.text ?? "#374151"}33` : "1px solid transparent", color: briefActionFilter === act ? (ACTION_STYLES[act]?.text ?? "var(--text-primary)") : "var(--text-muted)", borderRadius: "4px", padding: "4px 10px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: act !== "all" ? "monospace" : "inherit" }}>{act === "all" ? "All" : act}</button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-3">
                      {filteredBriefEvents.map((event: PriorityEvent, i: number) => {
                        const isExpanded = briefExpandedEvent === i;
                        const roiColor = event.estimated_roi_pct >= 0 ? "#6ee7b7" : "#fca5a5";
                        return (
                          <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "8px", overflow: "hidden", cursor: "pointer" }} onClick={() => setBriefExpandedEvent(isExpanded ? null : i)}>
                            <div className="flex items-center gap-4 flex-wrap" style={{ padding: "14px 16px" }}>
                              <ActionBadge action={event.action} />
                              <div style={{ flex: 1, minWidth: 180 }}>
                                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{event.event_name}</p>
                                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>{event.event_date} &middot; {event.venue}</p>
                              </div>
                              <div style={{ minWidth: 140 }}><ConfidenceBar value={event.confidence} /></div>
                              <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 700, color: roiColor, minWidth: 60, textAlign: "right" as const }}>{event.estimated_roi_pct > 0 ? "+" : ""}{event.estimated_roi_pct}%</span>
                              {isExpanded ? <ChevronDown size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />}
                            </div>
                            {isExpanded && (
                              <div style={{ borderTop: "1px solid var(--border-default)", padding: "14px 16px", background: "rgba(0,0,0,0.15)" }}>
                                <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                                  <span style={{ ...labelStyle, marginBottom: 0 }}>Signal</span>
                                  <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#93c5fd", background: "#1e3a5f", padding: "2px 6px", borderRadius: "4px" }}>{event.signal.replace(/_/g, " ")}</span>
                                  <span style={{ ...labelStyle, marginBottom: 0 }}>Category</span>
                                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "capitalize" as const }}>{event.category}</span>
                                </div>
                                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>{event.reasoning}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {filteredBriefEvents.length === 0 && (
                        <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>No events match the current filters.</p>
                      )}
                    </div>
                  </div>
                )}

                {briefActiveTab === "signals" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Radio size={14} style={{ color: "#f59e0b" }} />
                      <span style={labelStyle}>Social Signals</span>
                    </div>
                    {brief.social_signals.map((sig: SocialSignal, i: number) => (
                      <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "16px" }}>
                        <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                          <ImpactDot impact={sig.impact} />
                          <span style={{ fontSize: "10px", letterSpacing: "1px", color: "#6b7280", textTransform: "uppercase" as const, fontWeight: 600 }}>{sig.source}</span>
                          <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: sig.impact === "high" ? "#fca5a5" : sig.impact === "medium" ? "#fcd34d" : "#6b7280", background: sig.impact === "high" ? "#7f1d1d" : sig.impact === "medium" ? "#78350f" : "#1f2937", padding: "2px 6px", borderRadius: "4px" }}>{sig.impact} impact</span>
                        </div>
                        <p style={{ fontSize: "14px", color: "var(--text-primary)", margin: "0 0 10px 0", lineHeight: 1.5 }}>{sig.signal}</p>
                        <div className="flex flex-wrap gap-2">
                          {sig.affected_events.map((evt, j) => (
                            <span key={j} style={{ fontSize: "11px", color: "var(--text-muted)", background: "#1f2937", padding: "2px 8px", borderRadius: "4px", border: "1px solid #374151" }}>{evt}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {brief.social_signals.length === 0 && (
                      <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>No social signals detected.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
