import { useState, useEffect, useCallback } from "react";
import { callClaude } from "../components/APIClient";
import { SAMPLE_BRIEF } from "../lib/sampleData";
import type { BriefData, PriorityEvent, OnSale, SocialSignal } from "../lib/types";
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
  Zap,
  Radio,
  Target,
  CalendarClock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Sub-components
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
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: "#1f2937",
        }}
      >
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
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "12px",
          color,
          minWidth: 32,
          textAlign: "right" as const,
        }}
      >
        {value}%
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
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "1px",
          color: "#6b7280",
          textTransform: "uppercase" as const,
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "28px",
          fontWeight: 700,
          color: accent ?? "var(--text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CountdownTimer() {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    function computeCountdown() {
      const now = new Date();
      // Build a target of 7:15 AM Mountain Time today
      // Mountain Time is UTC-7 (MDT) or UTC-6 depending on DST — use America/Denver
      const mtNow = new Date(
        now.toLocaleString("en-US", { timeZone: "America/Denver" })
      );
      const target = new Date(mtNow);
      target.setHours(7, 15, 0, 0);
      if (mtNow >= target) {
        target.setDate(target.getDate() + 1);
      }
      const diff = target.getTime() - mtNow.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    setDisplay(computeCountdown());
    const id = setInterval(() => setDisplay(computeCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span
        style={{
          fontSize: "10px",
          letterSpacing: "1px",
          color: "#6b7280",
          textTransform: "uppercase" as const,
        }}
      >
        Next Bell
      </span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#6ee7b7",
          background: "#064e3b",
          padding: "2px 8px",
          borderRadius: "4px",
        }}
      >
        {display}
      </span>
    </div>
  );
}

function ImpactDot({ impact }: { impact: "high" | "medium" | "low" }) {
  const colors: Record<string, string> = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#6b7280",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors[impact],
        flexShrink: 0,
      }}
    />
  );
}

function ProfitBadge({ level }: { level: "high" | "medium" | "low" }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    high: { bg: "#064e3b", text: "#6ee7b7", label: "HIGH" },
    medium: { bg: "#78350f", text: "#fcd34d", label: "MED" },
    low: { bg: "#1f2937", text: "#6b7280", label: "LOW" },
  };
  const s = map[level];
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        fontFamily: "monospace",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "1px",
        padding: "2px 6px",
        borderRadius: "4px",
      }}
    >
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Label helper
// ---------------------------------------------------------------------------
const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "1px",
  color: "#6b7280",
  textTransform: "uppercase",
  marginBottom: "12px",
  fontWeight: 600,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OpenBell() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"brief" | "events" | "signals">(
    "brief"
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // -----------------------------------------------------------------------
  // Slack export
  // -----------------------------------------------------------------------
  const buildSlackText = useCallback(() => {
    if (!brief) return "";
    const now = new Date();
    const dayStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    let text = `*OPEN BELL \u2014 ${dayStr}*\n`;
    text += `> ${brief.market_summary}\n\n`;
    text += `*Priority Events:*\n`;
    for (const e of brief.priority_events) {
      text += `${e.action} \u2014 ${e.event_name} (${e.confidence}% conf, ~${e.estimated_roi_pct > 0 ? "+" : ""}${e.estimated_roi_pct}% ROI)\n`;
    }
    text += `\n*Today\u2019s Focus:*\n${brief.recommended_focus}\n`;
    return text;
  }, [brief]);

  const handleCopySlack = useCallback(async () => {
    const text = buildSlackText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [buildSlackText]);

  // -----------------------------------------------------------------------
  // AI generation
  // -----------------------------------------------------------------------
  const generateBrief = useCallback(async () => {
    setLoading(true);
    try {
      const prompt = `You are a ticket resale market analyst for the Denver, Colorado market. Generate a morning trading intelligence brief for today. Return ONLY valid JSON matching this TypeScript interface — no markdown, no explanation:

interface BriefData {
  market_summary: string; // 2-3 sentence Denver secondary ticket market overview
  priority_events: Array<{
    event_name: string;
    event_date: string; // e.g. "Apr 22, 2026"
    venue: string; // Denver area venues
    category: "concert" | "sports" | "theater";
    signal: "price_spike" | "price_drop" | "high_demand" | "low_supply" | "on_sale_today";
    action: "BUY" | "SELL" | "HOLD" | "WATCH";
    confidence: number; // 0-100
    reasoning: string; // 1-2 sentences
    estimated_roi_pct: number;
  }>;
  on_sales_today: Array<{
    event_name: string;
    time: string; // e.g. "10:00 AM MT"
    platform: string;
    profit_potential: "high" | "medium" | "low";
    notes: string;
  }>;
  social_signals: Array<{
    source: string;
    signal: string;
    impact: "high" | "medium" | "low";
    affected_events: string[];
  }>;
  risk_alerts: string[];
  recommended_focus: string;
}

Include 5-7 priority events, 2-3 on-sales, 3-4 social signals, 1-2 risk alerts, and a specific recommended focus for today. Use real Denver venues (Ball Arena, Red Rocks, Empower Field, Coors Field, Denver Center). Make it actionable for a ticket reseller.`;

      const raw = await callClaude(prompt, true);
      const parsed: BriefData = JSON.parse(raw);
      setBrief(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate brief. Check your API key.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDemo = useCallback(() => {
    setBrief(SAMPLE_BRIEF);
  }, []);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------
  const filteredEvents: PriorityEvent[] = brief
    ? brief.priority_events
        .filter(
          (e) => categoryFilter === "all" || e.category === categoryFilter
        )
        .filter((e) => actionFilter === "all" || e.action === actionFilter)
        .sort((a, b) => b.confidence - a.confidence)
    : [];

  const avgConfidence = brief
    ? Math.round(
        brief.priority_events.reduce((s, e) => s + e.confidence, 0) /
          (brief.priority_events.length || 1)
      )
    : 0;

  // -----------------------------------------------------------------------
  // Today string
  // -----------------------------------------------------------------------
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  });

  // -----------------------------------------------------------------------
  // Tabs
  // -----------------------------------------------------------------------
  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "brief", label: "Trading Brief" },
    { key: "events", label: "Events" },
    { key: "signals", label: "Signals" },
  ];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* ===== HEADER ===== */}
      <header
        style={{
          borderBottom: "1px solid var(--border-default)",
          padding: "16px 24px",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {/* Pulsing green dot */}
              <span className="relative flex h-3 w-3">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: "#6ee7b7" }}
                />
                <span
                  className="relative inline-flex rounded-full h-3 w-3"
                  style={{ background: "#10b981" }}
                />
              </span>
              <h1
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  letterSpacing: "-0.5px",
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Open Bell
              </h1>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  color: "#6ee7b7",
                  background: "#064e3b",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  textTransform: "uppercase" as const,
                }}
              >
                BETA
              </span>
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                margin: "4px 0 0 0",
              }}
            >
              {todayStr}
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <CountdownTimer />
            <button
              onClick={generateBrief}
              disabled={loading}
              className="flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{
                background: "#059669",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Zap size={14} />
              Generate live brief
            </button>
            <button
              onClick={loadDemo}
              className="transition-opacity hover:opacity-80"
              style={{
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Load demo
            </button>
          </div>
        </div>
      </header>

      {/* ===== TAB NAV ===== */}
      <nav
        className="flex gap-0"
        style={{
          borderBottom: "1px solid var(--border-default)",
          padding: "0 24px",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === t.key ? "2px solid #10b981" : "2px solid transparent",
              color:
                activeTab === t.key
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
              padding: "12px 20px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.3px",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ===== CONTENT ===== */}
      <main style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
        {/* LOADING */}
        {loading && (
          <div
            className="flex flex-col items-center justify-center gap-4"
            style={{ minHeight: 400 }}
          >
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: "#10b981" }}
            />
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              Scanning markets, aggregating signals...
            </p>
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
        {!loading && !brief && !error && (
          <div
            className="flex flex-col items-center justify-center gap-4"
            style={{ minHeight: 400 }}
          >
            <CalendarClock size={48} style={{ color: "#374151" }} />
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "14px",
                textAlign: "center",
                maxWidth: 360,
                lineHeight: 1.6,
              }}
            >
              No brief loaded. Click{" "}
              <strong style={{ color: "#6ee7b7" }}>Generate live brief</strong>{" "}
              to pull real-time Denver market intelligence, or{" "}
              <strong style={{ color: "var(--text-secondary)" }}>
                Load demo
              </strong>{" "}
              to explore with sample data.
            </p>
          </div>
        )}

        {/* ===== BRIEF TAB ===== */}
        {!loading && brief && activeTab === "brief" && (
          <div className="flex flex-col gap-6">
            {/* Market Overview */}
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,78,59,0.15) 100%)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <Activity size={14} style={{ color: "#10b981" }} />
                <span style={labelStyle}>Market Overview</span>
              </div>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {brief.market_summary}
              </p>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Priority Events"
                value={brief.priority_events.length}
                icon={<Target size={12} />}
                accent="#6ee7b7"
              />
              <MetricCard
                label="On-Sales Today"
                value={brief.on_sales_today.length}
                icon={<ShoppingCart size={12} />}
                accent="#93c5fd"
              />
              <MetricCard
                label="Avg Confidence"
                value={`${avgConfidence}%`}
                icon={<BarChart3 size={12} />}
                accent="#fcd34d"
              />
              <MetricCard
                label="Risk Alerts"
                value={brief.risk_alerts.length}
                icon={<AlertTriangle size={12} />}
                accent={brief.risk_alerts.length > 0 ? "#fca5a5" : "#6ee7b7"}
              />
            </div>

            {/* Game Plan */}
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(88,28,135,0.12) 100%)",
                border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <Target size={14} style={{ color: "#a78bfa" }} />
                <span style={{ ...labelStyle, color: "#a78bfa" }}>
                  Today&apos;s Game Plan
                </span>
              </div>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                  lineHeight: 1.65,
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {brief.recommended_focus}
              </p>
            </div>

            {/* Risk Alerts */}
            {brief.risk_alerts.length > 0 && (
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                  <AlertTriangle size={14} style={{ color: "#f59e0b" }} />
                  <span style={{ ...labelStyle, color: "#f59e0b" }}>
                    Risk Alerts
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {brief.risk_alerts.map((alert, i) => (
                    <div
                      key={i}
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(120,53,15,0.1) 100%)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        borderRadius: "8px",
                        padding: "14px 16px",
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      <AlertTriangle
                        size={13}
                        style={{
                          color: "#f59e0b",
                          display: "inline",
                          marginRight: 8,
                          verticalAlign: "middle",
                        }}
                      />
                      {alert}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* On-Sales Today */}
            {brief.on_sales_today.length > 0 && (
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                  <ShoppingCart size={14} style={{ color: "#93c5fd" }} />
                  <span style={{ ...labelStyle, color: "#93c5fd" }}>
                    On-Sales Today
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brief.on_sales_today.map((sale: OnSale, i: number) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "8px",
                        padding: "16px",
                      }}
                    >
                      <div
                        className="flex items-center justify-between"
                        style={{ marginBottom: 8 }}
                      >
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "12px",
                            color: "#6ee7b7",
                          }}
                        >
                          {sale.time}
                        </span>
                        <ProfitBadge level={sale.profit_potential} />
                      </div>
                      <p
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          margin: "0 0 4px 0",
                        }}
                      >
                        {sale.event_name}
                      </p>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          margin: "0 0 8px 0",
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.5px",
                        }}
                      >
                        {sale.platform}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--text-secondary)",
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        {sale.notes}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Copy for Slack */}
            <div className="flex justify-end">
              <button
                onClick={handleCopySlack}
                className="flex items-center gap-2 transition-opacity hover:opacity-80"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  color: copied ? "#6ee7b7" : "var(--text-secondary)",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy for Slack"}
              </button>
            </div>
          </div>
        )}

        {/* ===== EVENTS TAB ===== */}
        {!loading && brief && activeTab === "events" && (
          <div className="flex flex-col gap-5">
            {/* Filter bar */}
            <div
              className="flex flex-wrap items-center gap-3"
              style={{
                padding: "12px 16px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "8px",
              }}
            >
              <span style={{ ...labelStyle, marginBottom: 0, marginRight: 4 }}>
                Category
              </span>
              {["all", "concert", "sports", "theater"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  style={{
                    background:
                      categoryFilter === cat ? "#1f2937" : "transparent",
                    border:
                      categoryFilter === cat
                        ? "1px solid #374151"
                        : "1px solid transparent",
                    color:
                      categoryFilter === cat
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                    borderRadius: "4px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize" as const,
                  }}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              ))}

              <div
                style={{
                  width: 1,
                  height: 20,
                  background: "var(--border-default)",
                  margin: "0 4px",
                }}
              />

              <span style={{ ...labelStyle, marginBottom: 0, marginRight: 4 }}>
                Action
              </span>
              {["all", "BUY", "SELL", "HOLD", "WATCH"].map((act) => (
                <button
                  key={act}
                  onClick={() => setActionFilter(act)}
                  style={{
                    background:
                      actionFilter === act
                        ? (ACTION_STYLES[act]?.bg ?? "#1f2937")
                        : "transparent",
                    border:
                      actionFilter === act
                        ? `1px solid ${ACTION_STYLES[act]?.text ?? "#374151"}33`
                        : "1px solid transparent",
                    color:
                      actionFilter === act
                        ? (ACTION_STYLES[act]?.text ?? "var(--text-primary)")
                        : "var(--text-muted)",
                    borderRadius: "4px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: act !== "all" ? "monospace" : "inherit",
                    letterSpacing: act !== "all" ? "0.5px" : "0",
                  }}
                >
                  {act === "all" ? "All" : act}
                </button>
              ))}
            </div>

            {/* Event cards */}
            <div className="flex flex-col gap-3">
              {filteredEvents.map((event: PriorityEvent, i: number) => {
                const isExpanded = expandedEvent === i;
                const roiColor =
                  event.estimated_roi_pct >= 0 ? "#6ee7b7" : "#fca5a5";
                return (
                  <div
                    key={i}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "8px",
                      overflow: "hidden",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onClick={() => setExpandedEvent(isExpanded ? null : i)}
                  >
                    <div
                      className="flex items-center gap-4 flex-wrap"
                      style={{ padding: "14px 16px" }}
                    >
                      <ActionBadge action={event.action} />
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <p
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            margin: 0,
                          }}
                        >
                          {event.event_name}
                        </p>
                        <p
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            margin: "2px 0 0 0",
                          }}
                        >
                          {event.event_date} &middot; {event.venue}
                        </p>
                      </div>
                      <div style={{ minWidth: 140 }}>
                        <ConfidenceBar value={event.confidence} />
                      </div>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "14px",
                          fontWeight: 700,
                          color: roiColor,
                          minWidth: 60,
                          textAlign: "right" as const,
                        }}
                      >
                        {event.estimated_roi_pct > 0 ? "+" : ""}
                        {event.estimated_roi_pct}%
                      </span>
                      {isExpanded ? (
                        <ChevronDown
                          size={16}
                          style={{ color: "var(--text-muted)" }}
                        />
                      ) : (
                        <ChevronRight
                          size={16}
                          style={{ color: "var(--text-muted)" }}
                        />
                      )}
                    </div>
                    {isExpanded && (
                      <div
                        style={{
                          borderTop: "1px solid var(--border-default)",
                          padding: "14px 16px",
                          background: "rgba(0,0,0,0.15)",
                        }}
                      >
                        <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                          <span
                            style={{
                              ...labelStyle,
                              marginBottom: 0,
                            }}
                          >
                            Signal
                          </span>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "11px",
                              color: "#93c5fd",
                              background: "#1e3a5f",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            {event.signal.replace(/_/g, " ")}
                          </span>
                          <span
                            style={{
                              ...labelStyle,
                              marginBottom: 0,
                            }}
                          >
                            Category
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--text-secondary)",
                              textTransform: "capitalize" as const,
                            }}
                          >
                            {event.category}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: "13px",
                            color: "var(--text-secondary)",
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {event.reasoning}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredEvents.length === 0 && (
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "13px",
                    textAlign: "center",
                    padding: "32px 0",
                  }}
                >
                  No events match the current filters.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===== SIGNALS TAB ===== */}
        {!loading && brief && activeTab === "signals" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              <Radio size={14} style={{ color: "#f59e0b" }} />
              <span style={labelStyle}>Social Signals</span>
            </div>
            {brief.social_signals.map((sig: SocialSignal, i: number) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <div
                  className="flex items-center gap-3"
                  style={{ marginBottom: 10 }}
                >
                  <ImpactDot impact={sig.impact} />
                  <span
                    style={{
                      fontSize: "10px",
                      letterSpacing: "1px",
                      color: "#6b7280",
                      textTransform: "uppercase" as const,
                      fontWeight: 600,
                    }}
                  >
                    {sig.source}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase" as const,
                      color:
                        sig.impact === "high"
                          ? "#fca5a5"
                          : sig.impact === "medium"
                            ? "#fcd34d"
                            : "#6b7280",
                      background:
                        sig.impact === "high"
                          ? "#7f1d1d"
                          : sig.impact === "medium"
                            ? "#78350f"
                            : "#1f2937",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {sig.impact} impact
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-primary)",
                    margin: "0 0 10px 0",
                    lineHeight: 1.5,
                  }}
                >
                  {sig.signal}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sig.affected_events.map((evt, j) => (
                    <span
                      key={j}
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        background: "#1f2937",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        border: "1px solid #374151",
                      }}
                    >
                      {evt}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {brief.social_signals.length === 0 && (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  textAlign: "center",
                  padding: "32px 0",
                }}
              >
                No social signals detected.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
