import { useState } from 'react';
import {
  BarChart3,
  Search,
  TrendingUp,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Target,
  Zap,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from 'recharts';
import { callClaude } from '../components/APIClient';
import type { CompResult, CompSearchInput, Comparable } from '../lib/types';

/* ------------------------------------------------------------------ */
/*  DEMO DATA                                                         */
/* ------------------------------------------------------------------ */
const DEMO_RESULT: CompResult = {
  target_event: {
    name: 'Kendrick Lamar \u2014 Empower Field',
    category: 'concert',
    tier: 'stadium_headliner',
    estimated_demand: 'very_high',
    market_context:
      'Denver has not had a major hip-hop stadium show since Travis Scott in 2024. Pent-up demand, limited competition.',
  },
  direct_comps: [
    {
      event_name: 'Kendrick Lamar \u2014 SoFi Stadium, LA',
      date: 'Jun 2025',
      venue: 'SoFi Stadium',
      city: 'Los Angeles',
      relevance: 'same_artist',
      relevance_score: 95,
      face_value_range: '$150-$350',
      resale_floor: 195,
      resale_median: 420,
      resale_peak: 680,
      roi_range: '30-289%',
      sell_through: 'sold_out',
      notes: 'LA hometown show. Sold out in 12 minutes. Floor peaked at $680.',
    },
    {
      event_name: 'Kendrick Lamar \u2014 United Center, Chicago',
      date: 'May 2025',
      venue: 'United Center',
      city: 'Chicago',
      relevance: 'same_artist',
      relevance_score: 90,
      face_value_range: '$120-$300',
      resale_floor: 165,
      resale_median: 350,
      resale_peak: 520,
      roi_range: '38-333%',
      sell_through: 'sold_out',
      notes: 'Arena show. Strong Midwest demand.',
    },
    {
      event_name: 'Kendrick Lamar \u2014 Ball Arena, Denver',
      date: 'Oct 2022',
      venue: 'Ball Arena',
      city: 'Denver',
      relevance: 'same_artist',
      relevance_score: 88,
      face_value_range: '$75-$195',
      resale_floor: 95,
      resale_median: 210,
      resale_peak: 310,
      roi_range: '27-226%',
      sell_through: 'sold_out',
      notes: 'Previous Denver date. Smaller venue, lower face values.',
    },
  ],
  market_comps: [
    {
      event_name: 'Travis Scott \u2014 Empower Field',
      date: 'Jul 2024',
      venue: 'Empower Field',
      city: 'Denver',
      relevance: 'same_venue',
      relevance_score: 85,
      face_value_range: '$125-$295',
      resale_floor: 155,
      resale_median: 340,
      resale_peak: 520,
      roi_range: '24-167%',
      sell_through: 'near_sellout',
      notes: 'Same venue, same genre. Strong Denver hip-hop market.',
    },
    {
      event_name: 'Drake \u2014 Ball Arena',
      date: 'Mar 2025',
      venue: 'Ball Arena',
      city: 'Denver',
      relevance: 'same_genre',
      relevance_score: 78,
      face_value_range: '$130-$275',
      resale_floor: 145,
      resale_median: 290,
      resale_peak: 410,
      roi_range: '12-134%',
      sell_through: 'sold_out',
      notes: 'Arena vs stadium \u2014 lower capacity but strong floor premiums.',
    },
    {
      event_name: 'J. Cole \u2014 Red Rocks',
      date: 'Sep 2024',
      venue: 'Red Rocks',
      city: 'Morrison',
      relevance: 'same_genre',
      relevance_score: 72,
      face_value_range: '$95-$185',
      resale_floor: 120,
      resale_median: 195,
      resale_peak: 280,
      roi_range: '26-133%',
      sell_through: 'sold_out',
      notes: 'Smaller venue. Red Rocks premium adds margin.',
    },
    {
      event_name: 'Beyonce \u2014 Empower Field',
      date: 'Aug 2023',
      venue: 'Empower Field',
      city: 'Denver',
      relevance: 'same_venue',
      relevance_score: 80,
      face_value_range: '$180-$450',
      resale_floor: 220,
      resale_median: 520,
      resale_peak: 890,
      roi_range: '22-305%',
      sell_through: 'sold_out',
      notes: 'Stadium headliner benchmark. Highest ROI comps in Denver.',
    },
  ],
  pricing_guidance: {
    suggested_buy_under: 260,
    expected_resale_range: '$380 - $650',
    optimal_list_price: 480,
    confidence: 86,
    reasoning:
      "Every direct and market comp sold out with 100%+ ROI on floor seats. Denver's hip-hop stadium gap makes this event supply-constrained. At face ($250), you're buying below every comparable floor price. Risk is limited to a poor album reception or competing announcement \u2014 neither likely at this stage.",
  },
  key_differences: [
    "This is a stadium show vs Kendrick's previous Denver arena date \u2014 3x capacity could moderate resale ceiling",
    "Post-Drake beef, Kendrick's cultural relevance is at an all-time high \u2014 likely exceeds historical comps",
    'Summer date (Jul) vs previous Denver fall date \u2014 summer concerts historically trade 15-20% higher',
    'Verified Fan presale may limit initial supply on secondary, creating a tighter launch window',
  ],
  watch_factors: [
    "Monitor presale absorption rate \u2014 if Verified Fan doesn't sell out instantly, revise down",
    'Watch for competing Denver hip-hop/stadium announcements in the Jun-Aug window',
    'Track streaming numbers post-announcement for demand confirmation',
    'Secondary market price discovery in first 24 hours post-onsale sets the trading range',
  ],
};

/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */

function relevanceBadge(relevance: Comparable['relevance'], score: number) {
  const colors: Record<string, string> = {
    same_artist: '#10b981',
    same_venue: '#3b82f6',
    same_genre: '#a855f7',
    same_tier: '#f59e0b',
  };
  const c = colors[relevance] || '#6b7280';
  const label = relevance.replace(/_/g, ' ');
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
      style={{ background: `${c}20`, color: c }}
    >
      {label} &middot; {score}
    </span>
  );
}

function sellBadge(st: Comparable['sell_through']) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    sold_out: { bg: '#10b98120', fg: '#10b981', label: 'Sold Out' },
    near_sellout: { bg: '#f59e0b20', fg: '#f59e0b', label: 'Near Sell-Out' },
    moderate: { bg: '#6b728020', fg: '#6b7280', label: 'Moderate' },
    slow: { bg: '#ef444420', fg: '#ef4444', label: 'Slow' },
  };
  const s = map[st] || map.moderate;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function demandBadge(level: CompResult['target_event']['estimated_demand']) {
  const map: Record<string, { bg: string; fg: string }> = {
    very_high: { bg: '#10b98120', fg: '#10b981' },
    high: { bg: '#3b82f620', fg: '#3b82f6' },
    moderate: { bg: '#f59e0b20', fg: '#f59e0b' },
    low: { bg: '#ef444420', fg: '#ef4444' },
  };
  const s = map[level] || map.moderate;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {level.replace(/_/g, ' ')} demand
    </span>
  );
}

function tierBadge(tier: string) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide"
      style={{ background: '#ec489920', color: '#ec4899' }}
    >
      {tier.replace(/_/g, ' ')}
    </span>
  );
}

function money(n: number) {
  return '$' + n.toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  COMP ROW                                                          */
/* ------------------------------------------------------------------ */
function CompRow({ comp }: { comp: Comparable }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-lg border mb-2 overflow-hidden transition-colors"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:brightness-110 transition-all"
        style={{ background: 'transparent' }}
        onClick={() => setOpen(!open)}
      >
        {/* Name + date */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {comp.event_name}
            </span>
            {relevanceBadge(comp.relevance, comp.relevance_score)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {comp.date} &middot; {comp.venue}, {comp.city}
          </div>
        </div>

        {/* Face */}
        <div className="hidden sm:block text-right w-24">
          <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Face
          </div>
          <div className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
            {comp.face_value_range}
          </div>
        </div>

        {/* Floor -> Median -> Peak */}
        <div className="hidden md:flex items-center gap-1 text-center" style={{ width: 200 }}>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Floor</div>
            <div className="text-xs font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {money(comp.resale_floor)}
            </div>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>&rarr;</span>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Med</div>
            <div className="text-xs font-mono font-semibold" style={{ color: '#3b82f6' }}>
              {money(comp.resale_median)}
            </div>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>&rarr;</span>
          <div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Peak</div>
            <div className="text-xs font-mono font-bold" style={{ color: '#10b981' }}>
              {money(comp.resale_peak)}
            </div>
          </div>
        </div>

        {/* ROI */}
        <div className="hidden lg:block text-right w-24">
          <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>ROI</div>
          <div className="text-xs font-mono font-bold" style={{ color: '#10b981' }}>
            {comp.roi_range}
          </div>
        </div>

        {/* Sell-through */}
        <div className="hidden lg:block w-24 text-right">
          {sellBadge(comp.sell_through)}
        </div>

        {/* Expand chevron */}
        <div style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <div
          className="px-4 pb-3 text-xs leading-relaxed border-t"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
        >
          {/* Mobile-only data */}
          <div className="sm:hidden mb-2 pt-2">
            <span style={{ color: 'var(--text-muted)' }}>Face: </span>
            <span className="font-mono">{comp.face_value_range}</span>
          </div>
          <div className="md:hidden mb-2">
            <span style={{ color: 'var(--text-muted)' }}>Resale: </span>
            <span className="font-mono">
              {money(comp.resale_floor)} &rarr; {money(comp.resale_median)} &rarr; {money(comp.resale_peak)}
            </span>
          </div>
          <div className="lg:hidden mb-2">
            <span style={{ color: 'var(--text-muted)' }}>ROI: </span>
            <span className="font-mono" style={{ color: '#10b981' }}>{comp.roi_range}</span>
            {' \u00b7 '}
            {sellBadge(comp.sell_through)}
          </div>
          <p className="pt-1">{comp.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CHART DATA                                                        */
/* ------------------------------------------------------------------ */
function buildChartData(result: CompResult) {
  const all = [...result.direct_comps, ...result.market_comps];
  return all.map((c) => {
    const nums = c.face_value_range.match(/\d+/g)?.map(Number) ?? [0];
    const faceMid = nums.length >= 2 ? Math.round((nums[0] + nums[1]) / 2) : nums[0];
    const label = c.event_name.length > 22 ? c.event_name.slice(0, 20) + '\u2026' : c.event_name;
    return {
      name: label,
      face: faceMid,
      peak: c.resale_peak,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                    */
/* ------------------------------------------------------------------ */
export default function CompsEngine() {
  const [form, setForm] = useState<CompSearchInput>({
    event: '',
    venue: '',
    date: '',
    category: 'concert',
    market: 'Denver',
  });
  const [result, setResult] = useState<CompResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDemo = () => {
    setForm({
      event: 'Kendrick Lamar',
      venue: 'Empower Field',
      date: '2026-07-19',
      category: 'concert',
      market: 'Denver',
    });
    setResult(DEMO_RESULT);
  };

  const handleSearch = async () => {
    if (!form.event.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const prompt = `You are a ticket resale comparable-event analyst. Given the search input, return a JSON object matching this TypeScript type exactly (no markdown, no explanation, ONLY valid JSON):

interface CompResult {
  target_event: { name: string; category: string; tier: string; estimated_demand: "very_high"|"high"|"moderate"|"low"; market_context: string };
  direct_comps: Comparable[];   // 2-4 same-artist comps
  market_comps: Comparable[];   // 3-5 same-venue or same-genre comps
  pricing_guidance: { suggested_buy_under: number; expected_resale_range: string; optimal_list_price: number; confidence: number; reasoning: string };
  key_differences: string[];    // 3-5 items
  watch_factors: string[];      // 3-5 items
}
interface Comparable { event_name: string; date: string; venue: string; city: string; relevance: "same_artist"|"same_venue"|"same_genre"|"same_tier"; relevance_score: number; face_value_range: string; resale_floor: number; resale_median: number; resale_peak: number; roi_range: string; sell_through: "sold_out"|"near_sellout"|"moderate"|"slow"; notes: string }

Search input:
Event/Artist: ${form.event}
Venue: ${form.venue || 'any'}
Date: ${form.date || 'upcoming'}
Category: ${form.category}
Market: ${form.market || 'any'}

Use real historical ticket resale data where possible. For pricing, reference actual face values and secondary market prices. Return ONLY the JSON object.`;

      const raw = await callClaude(prompt);
      const parsed: CompResult = JSON.parse(raw);
      setResult(parsed);
    } catch (err) {
      console.error('Comp search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result ? buildChartData(result) : [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: '#ec489920' }}
        >
          <BarChart3 size={20} style={{ color: '#ec4899' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Comps Engine
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Comparable event analyzer &mdash; pull comps, form a price opinion
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  A. SEARCH FORM                                              */}
      {/* ============================================================ */}
      <div
        className="rounded-lg border p-4 mb-6"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        {/* Row 1: Event */}
        <input
          className="w-full rounded-lg border px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-1"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '1rem',
          }}
          placeholder="Event or Artist name (e.g. Kendrick Lamar)"
          value={form.event}
          onChange={(e) => setForm({ ...form, event: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />

        {/* Row 2: Venue | Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            placeholder="Venue (optional)"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="concert">Concert</option>
            <option value="sports">Sports</option>
            <option value="theater">Theater</option>
            <option value="festival">Festival</option>
          </select>
        </div>

        {/* Row 3: Date | Market */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <input
            type="date"
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <input
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            placeholder="Market / City"
            value={form.market}
            onChange={(e) => setForm({ ...form, market: e.target.value })}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: '#10b981', color: '#fff' }}
            onClick={handleSearch}
            disabled={loading || !form.event.trim()}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? 'Searching\u2026' : 'Find Comps'}
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-opacity hover:brightness-110"
            style={{
              background: 'transparent',
              borderColor: 'var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            onClick={loadDemo}
          >
            <Zap size={14} />
            Load demo
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  LOADING STATE                                               */}
      {/* ============================================================ */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: '#ec4899' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            Pulling comparable events&hellip;
          </span>
        </div>
      )}

      {/* ============================================================ */}
      {/*  EMPTY STATE                                                 */}
      {/* ============================================================ */}
      {!result && !loading && (
        <div className="text-center py-20">
          <BarChart3 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            Enter an event to find comparable historical events and pricing data
          </p>
          <button onClick={loadDemo} className="text-xs underline" style={{ color: '#ec4899' }}>
            or load a demo analysis
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/*  RESULTS                                                     */}
      {/* ============================================================ */}
      {result && !loading && (
        <div className="space-y-6">
          {/* ------------------------------------------------------ */}
          {/*  B. TARGET EVENT SUMMARY                                */}
          {/* ------------------------------------------------------ */}
          <div
            className="rounded-lg border p-5"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <Target size={18} style={{ color: '#ec4899' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {result.target_event.name}
              </h2>
              {tierBadge(result.target_event.tier)}
              {demandBadge(result.target_event.estimated_demand)}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {result.target_event.market_context}
            </p>
          </div>

          {/* ------------------------------------------------------ */}
          {/*  E. PRICING GUIDANCE  (top for fast read)               */}
          {/* ------------------------------------------------------ */}
          <div
            className="rounded-lg border p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.06) 100%)',
              borderColor: '#10b98140',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={18} style={{ color: '#10b981' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Pricing Guidance
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-5">
              {/* Buy Under */}
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                  Buy Under
                </div>
                <div className="text-3xl font-bold font-mono" style={{ color: '#10b981' }}>
                  {money(result.pricing_guidance.suggested_buy_under)}
                </div>
              </div>

              {/* Expected Resale */}
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                  Expected Resale
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: '#3b82f6' }}>
                  {result.pricing_guidance.expected_resale_range}
                </div>
                <div className="mt-2 h-2 rounded-full mx-auto" style={{ background: 'var(--bg-primary)', maxWidth: 200 }}>
                  <div
                    className="h-2 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                      width: '75%',
                    }}
                  />
                </div>
              </div>

              {/* Optimal List */}
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                  Optimal List Price
                </div>
                <div className="text-3xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {money(result.pricing_guidance.optimal_list_price)}
                </div>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Confidence
                </span>
                <span className="text-xs font-mono font-bold" style={{ color: '#10b981' }}>
                  {result.pricing_guidance.confidence}%
                </span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'var(--bg-primary)' }}>
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${result.pricing_guidance.confidence}%`,
                    background:
                      result.pricing_guidance.confidence >= 80
                        ? '#10b981'
                        : result.pricing_guidance.confidence >= 60
                          ? '#f59e0b'
                          : '#ef4444',
                  }}
                />
              </div>
            </div>

            {/* Reasoning */}
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {result.pricing_guidance.reasoning}
            </p>
          </div>

          {/* ------------------------------------------------------ */}
          {/*  C. DIRECT COMPS TABLE                                  */}
          {/* ------------------------------------------------------ */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} style={{ color: '#10b981' }} />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Direct Comparables
              </h2>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: '#10b98120', color: '#10b981' }}
              >
                {result.direct_comps.length}
              </span>
            </div>
            {result.direct_comps.map((c, i) => (
              <CompRow key={`dc-${i}`} comp={c} />
            ))}
          </div>

          {/* ------------------------------------------------------ */}
          {/*  D. MARKET COMPS TABLE                                  */}
          {/* ------------------------------------------------------ */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} style={{ color: '#3b82f6' }} />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Market Comparables
              </h2>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: '#3b82f620', color: '#3b82f6' }}
              >
                {result.market_comps.length}
              </span>
            </div>
            {result.market_comps.map((c, i) => (
              <CompRow key={`mc-${i}`} comp={c} />
            ))}
          </div>

          {/* ------------------------------------------------------ */}
          {/*  H. BAR CHART                                           */}
          {/* ------------------------------------------------------ */}
          <div
            className="rounded-lg border p-5"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-primary)' }}>
              Face Value vs Peak Resale
            </h2>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111827',
                      border: '1px solid #374151',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#9ca3af' }}
                    itemStyle={{ fontFamily: 'monospace' }}
                    formatter={(value) => [`$${value}`, undefined]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                  <ReferenceLine
                    y={result.pricing_guidance.suggested_buy_under}
                    stroke="#f59e0b"
                    strokeDasharray="6 3"
                    label={{
                      value: `Buy under ${money(result.pricing_guidance.suggested_buy_under)}`,
                      fill: '#f59e0b',
                      fontSize: 11,
                      position: 'right',
                    }}
                  />
                  <Bar dataKey="face" name="Face Value (mid)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="peak" name="Peak Resale" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ------------------------------------------------------ */}
          {/*  F. KEY DIFFERENCES                                     */}
          {/* ------------------------------------------------------ */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Key Differences
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.key_differences.map((kd, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-3 text-sm leading-relaxed"
                  style={{
                    background: '#f59e0b08',
                    borderColor: '#f59e0b30',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <AlertTriangle
                    size={13}
                    className="inline-block mr-1.5 -mt-0.5"
                    style={{ color: '#f59e0b' }}
                  />
                  {kd}
                </div>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------ */}
          {/*  G. WATCH FACTORS                                       */}
          {/* ------------------------------------------------------ */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Eye size={16} style={{ color: '#06b6d4' }} />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Watch Factors
              </h2>
            </div>
            <div className="space-y-2">
              {result.watch_factors.map((wf, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border px-4 py-3"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
                >
                  <div
                    className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: '#06b6d420', color: '#06b6d4' }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {wf}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
