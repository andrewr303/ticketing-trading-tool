import { useState, useRef, useEffect } from 'react';
import { Calculator, Loader2, TrendingUp, TrendingDown, AlertTriangle, Target, Clock, DollarSign, BarChart3, ShieldAlert, ArrowRight } from 'lucide-react';
import { callLLM } from '../components/APIClient';
import { EDGE_CALC_PROMPT } from '../lib/prompts';
import type { Analysis, AnalysisInput } from '../lib/types';

const SAMPLE_ANALYSIS: Analysis = {
  verdict: "STRONG_BUY",
  confidence: 89,
  expected_roi: { low: 40, mid: 130, high: 250 },
  current_market_price: { floor: 195, median: 380, ceiling: 750 },
  demand_score: 92,
  supply_assessment: "tight",
  comparable_events: [
    { event: "Travis Scott — Empower Field '24", date: "Jul 2024", face_value: 195, peak_resale: 520, roi_achieved: 167 },
    { event: "Drake — Ball Arena '25", date: "Mar 2025", face_value: 175, peak_resale: 410, roi_achieved: 134 },
    { event: "Beyonce — Empower Field '23", date: "Aug 2023", face_value: 220, peak_resale: 890, roi_achieved: 305 },
    { event: "J. Cole — Red Rocks '24", date: "Sep 2024", face_value: 120, peak_resale: 280, roi_achieved: 133 },
  ],
  demand_signals: [
    { signal: "Presale registrations 3.2x venue capacity", strength: "strong", direction: "bullish" },
    { signal: "Spotify streams up 280% since tour announcement", strength: "strong", direction: "bullish" },
    { signal: "No competing hip-hop stadium date within 6 weeks in Denver", strength: "strong", direction: "bullish" },
    { signal: "Tour reviews from opening dates: 9.2/10 average", strength: "moderate", direction: "bullish" },
    { signal: "Summer stadium shows historically trade 15-20% higher", strength: "moderate", direction: "bullish" },
  ],
  risk_factors: [
    "Stadium capacity (76K) could moderate resale ceiling vs arena shows",
    "Weather-dependent outdoor venue — severe weather could impact attendance",
    "Verified Fan presale may limit initial secondary supply",
    "General market downturn could reduce discretionary entertainment spending",
  ],
  timing_assessment: "Buy at face during presale (today) or general on-sale. First 48 hours post-onsale offer best entry. List 2-3 weeks before show date for peak FOMO pricing. Floor seats should be listed at $450-550 initially, adjusting based on velocity.",
  reasoning: "Every comparable event in this category has delivered 100%+ ROI on floor seats. Kendrick's cultural moment post-Drake feud is at an all-time high. Denver hasn't had a major hip-hop stadium show since Travis Scott, creating pent-up demand. At $250 face value for floor, you're buying well below every comparable's resale floor. The risk-reward is overwhelmingly favorable.",
};

function GaugeChart({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min(value / max, 1);
  const radius = 50;
  const strokeWidth = 10;
  const circumference = Math.PI * radius;
  const filled = circumference * pct;

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d={`M 10 65 A 50 50 0 0 1 110 65`} fill="none" stroke="#1f2937" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={`M 10 65 A 50 50 0 0 1 110 65`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${filled} ${circumference}`} />
        <text x="60" y="55" textAnchor="middle" fill={color} fontSize="22" fontWeight="bold" fontFamily="monospace">{value}</text>
      </svg>
      <span className="text-xs mt-1" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
    </div>
  );
}

const VERDICT_STYLES: Record<string, { bg: string; text: string; glow: string }> = {
  STRONG_BUY: { bg: '#064e3b', text: '#10b981', glow: '0 0 30px rgba(16,185,129,0.3)' },
  BUY: { bg: '#065f46', text: '#34d399', glow: 'none' },
  HOLD: { bg: '#78350f', text: '#fbbf24', glow: '0 0 30px rgba(251,191,36,0.2)' },
  PASS: { bg: '#7f1d1d', text: '#f87171', glow: 'none' },
  STRONG_PASS: { bg: '#450a0a', text: '#ef4444', glow: '0 0 30px rgba(239,68,68,0.3)' },
};

export default function EdgeCalculator() {
  const [form, setForm] = useState<AnalysisInput>({ event: '', venue: '', date: '', buyPrice: 0, tier: 'Floor/VIP', quantity: 2, category: 'Concert' });
  const [analysis, setAnalysis] = useState<Analysis | null>(() => {
    const saved = localStorage.getItem('edge_calculator_analysis');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (analysis) {
      localStorage.setItem('edge_calculator_analysis', JSON.stringify(analysis));
    }
  }, [analysis]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('overview');
  const verdictRef = useRef<HTMLDivElement>(null);

  const loadDemo = () => {
    setForm({ event: 'Kendrick Lamar — Empower Field', venue: 'Empower Field, Denver', date: '2026-07-25', buyPrice: 250, tier: 'Floor/VIP', quantity: 4, category: 'Concert' });
    setAnalysis(SAMPLE_ANALYSIS);
    setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const analyze = async () => {
    if (!form.event || !form.buyPrice) return;
    setLoading(true);
    setError(null);
    try {
      const date = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const input = {
        event: form.event,
        venue: form.venue,
        eventDate: form.date,
        buyPrice: form.buyPrice,
        tier: form.tier,
        quantity: form.quantity,
        category: form.category,
      };
      const searchQueries = typeof EDGE_CALC_PROMPT.searchQueries === 'function'
        ? EDGE_CALC_PROMPT.searchQueries(input)
        : EDGE_CALC_PROMPT.searchQueries;
      const prompt = EDGE_CALC_PROMPT.buildPrompt({
        date,
        searchResults: "${searchResults}",
        ...input,
      });
      const raw = await callLLM({
        prompt,
        modelTier: EDGE_CALC_PROMPT.model,
        maxTokens: EDGE_CALC_PROMPT.maxTokens,
        searchQueries,
      });
      const parsed: Analysis = JSON.parse(raw);
      setAnalysis(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Check that API keys are configured in Supabase.');
    } finally {
      setLoading(false);
      setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const positionCost = form.buyPrice * form.quantity;

  const pnlRows = analysis ? [
    { scenario: 'Floor', price: analysis.current_market_price.floor },
    { scenario: 'Median -10%', price: Math.round(analysis.current_market_price.median * 0.9) },
    { scenario: 'Median', price: analysis.current_market_price.median },
    { scenario: 'Median +10%', price: Math.round(analysis.current_market_price.median * 1.1) },
    { scenario: 'Ceiling', price: analysis.current_market_price.ceiling },
  ].map(r => {
    const afterFees = Math.round(r.price * 0.85);
    const plPerTicket = afterFees - form.buyPrice;
    const totalPl = plPerTicket * form.quantity;
    const roi = form.buyPrice > 0 ? Math.round((plPerTicket / form.buyPrice) * 100) : 0;
    return { ...r, afterFees, plPerTicket, totalPl, roi };
  }) : [];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'pnl', label: 'P&L Table', icon: DollarSign },
    { id: 'comps', label: 'Comparables', icon: BarChart3 },
    { id: 'signals', label: 'Signals', icon: TrendingUp },
    { id: 'risks', label: 'Risks', icon: ShieldAlert },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Calculator size={24} style={{ color: 'var(--accent-blue)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Edge Calculator</h1>
        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-blue)', color: '#fff', fontSize: '10px' }}>BETA</span>
      </div>

      {/* Input Form */}
      <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Event / Artist / Team</label>
            <input value={form.event} onChange={e => setForm({ ...form, event: e.target.value })} className="w-full rounded px-3 py-2.5 text-sm border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="e.g. Kendrick Lamar — Empower Field" />
          </div>
          <div>
            <label className="block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Venue</label>
            <input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className="w-full rounded px-3 py-2.5 text-sm border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Event Date</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full rounded px-3 py-2.5 text-sm border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Buy Price per Ticket ($)</label>
            <input type="number" value={form.buyPrice || ''} onChange={e => setForm({ ...form, buyPrice: Number(e.target.value) })} className="w-full rounded px-3 py-2.5 text-sm border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="250" />
          </div>
          <div>
            <label className="block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Quantity</label>
            <input type="number" value={form.quantity || ''} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} className="w-full rounded px-3 py-2.5 text-sm border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Section Tier</label>
            <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className="w-full rounded px-3 py-2.5 text-sm border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
              <option>Floor/VIP</option><option>Lower Bowl</option><option>Mid Level</option><option>Upper Bowl</option><option>GA</option>
            </select>
          </div>
          <div>
            <label className="block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded px-3 py-2.5 text-sm border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
              <option>Concert</option><option>Sports</option><option>Theater</option><option>Festival</option><option>Comedy</option><option>Other</option>
            </select>
          </div>
        </div>
        {form.buyPrice > 0 && form.quantity > 0 && (
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            Position: {form.quantity} tickets × ${form.buyPrice} = <span style={{ color: 'var(--text-primary)' }}>${positionCost.toLocaleString()}</span> total capital at risk
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={analyze} disabled={loading || !form.event} className="flex-1 py-2.5 rounded font-medium text-sm flex items-center justify-center gap-2" style={{ background: 'var(--accent-green)', color: '#fff', opacity: loading || !form.event ? 0.5 : 1 }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Analyzing...</> : 'Analyze profitability'}
          </button>
          <button onClick={loadDemo} className="px-4 py-2.5 rounded text-sm border" style={{ borderColor: 'var(--border-hover)', color: 'var(--text-secondary)', background: 'transparent' }}>Load demo</button>
        </div>
      </div>

      {/* Results */}
      {analysis && (
        <div className="space-y-4 animate-fade-in" ref={verdictRef}>
          {/* Verdict Banner */}
          <div className="rounded-lg border p-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ background: VERDICT_STYLES[analysis.verdict]?.bg, borderColor: VERDICT_STYLES[analysis.verdict]?.text + '40', boxShadow: VERDICT_STYLES[analysis.verdict]?.glow }}>
            <div>
              <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Verdict</span>
              <div className="text-3xl font-bold mt-1" style={{ color: VERDICT_STYLES[analysis.verdict]?.text, fontFamily: 'monospace' }}>{analysis.verdict.replace('_', ' ')}</div>
              <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>Confidence: {analysis.confidence}%</span>
                <span>Supply: {analysis.supply_assessment}</span>
              </div>
            </div>
            <div className="flex gap-6">
              <GaugeChart value={analysis.confidence} max={100} label="Confidence" color={VERDICT_STYLES[analysis.verdict]?.text || '#10b981'} />
              <GaugeChart value={analysis.demand_score} max={100} label="Demand" color="#3b82f6" />
            </div>
          </div>

          {/* ROI Range Bar */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Expected ROI Range</span>
            <div className="mt-3 relative h-4 rounded-full overflow-hidden" style={{ background: '#1f2937' }}>
              <div className="absolute inset-y-0 rounded-full" style={{ left: `${Math.max(0, analysis.expected_roi.low / (analysis.expected_roi.high + 50) * 100)}%`, right: `${100 - analysis.expected_roi.high / (analysis.expected_roi.high + 50) * 100}%`, background: 'linear-gradient(90deg, #f59e0b, #10b981)' }} />
            </div>
            <div className="flex justify-between mt-2 text-xs" style={{ fontFamily: 'monospace' }}>
              <div className="text-center"><div style={{ color: '#f59e0b' }}>{analysis.expected_roi.low}%</div><div style={{ color: 'var(--text-muted)' }}>Bear</div></div>
              <div className="text-center"><div style={{ color: '#10b981' }}>{analysis.expected_roi.mid}%</div><div style={{ color: 'var(--text-muted)' }}>Base</div></div>
              <div className="text-center"><div style={{ color: '#34d399' }}>{analysis.expected_roi.high}%</div><div style={{ color: 'var(--text-muted)' }}>Bull</div></div>
            </div>
          </div>

          {/* Market Price Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Floor', value: analysis.current_market_price.floor, color: '#f59e0b' },
              { label: 'Median', value: analysis.current_market_price.median, color: '#10b981' },
              { label: 'Ceiling', value: analysis.current_market_price.ceiling, color: '#34d399' },
              { label: 'Your Cost', value: form.buyPrice, color: '#6b7280' },
            ].map(c => {
              const netRoi = form.buyPrice > 0 ? Math.round(((c.value * 0.85 - form.buyPrice) / form.buyPrice) * 100) : 0;
              return (
                <div key={c.label} className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                  <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                  <div className="text-2xl font-bold mt-1" style={{ fontFamily: 'monospace', color: c.color }}>${c.value}</div>
                  <div className="text-xs mt-1" style={{ fontFamily: 'monospace', color: netRoi >= 0 ? '#10b981' : '#ef4444' }}>{netRoi >= 0 ? '+' : ''}{netRoi}% net</div>
                </div>
              );
            })}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border-default)' }}>
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setActiveSection(t.id)} className="flex items-center gap-1.5 px-4 py-2.5 text-sm" style={{ color: activeSection === t.id ? 'var(--accent-green)' : 'var(--text-muted)', borderBottom: activeSection === t.id ? '2px solid var(--accent-green)' : '2px solid transparent' }}>
                  <Icon size={14} />{t.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="rounded-lg border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            {activeSection === 'overview' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Analysis</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{analysis.reasoning}</p>
                </div>
                <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-default)' }}>
                  <h3 className="text-xs uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Clock size={12} /> Timing Strategy</h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{analysis.timing_assessment}</p>
                </div>
                <div className="rounded-lg p-4" style={{ background: '#1e3a5f20', border: '1px solid #3b82f640' }}>
                  <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: '#93c5fd' }}>Position Sizing</h3>
                  <div className="grid grid-cols-3 gap-4 text-center mb-3">
                    <div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>Capital at Risk</div><div className="text-lg font-bold" style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>${positionCost.toLocaleString()}</div></div>
                    <div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>Est. Market Value</div><div className="text-lg font-bold" style={{ fontFamily: 'monospace', color: '#10b981' }}>${(analysis.current_market_price.median * form.quantity).toLocaleString()}</div></div>
                    <div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>Max Loss</div><div className="text-lg font-bold" style={{ fontFamily: 'monospace', color: '#ef4444' }}>${positionCost.toLocaleString()}</div></div>
                  </div>
                  <p className="text-xs" style={{ color: '#93c5fd' }}>At {analysis.confidence}% confidence with {analysis.expected_roi.mid}% base-case ROI, mid-case net profit: ${Math.round((analysis.current_market_price.median * 0.85 - form.buyPrice) * form.quantity).toLocaleString()} after ~15% platform fees.</p>
                </div>
              </div>
            )}

            {activeSection === 'pnl' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-default)' }}>
                      {['Scenario', 'Sale Price', 'After Fees (15%)', 'P/L per Ticket', 'Total P/L', 'ROI'].map(h => (
                        <th key={h} className="text-right py-2 px-3 first:text-left" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pnlRows.map((r, i) => (
                      <tr key={r.scenario} className={i % 2 === 1 ? '' : ''} style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: r.plPerTicket === 0 ? '1px dashed var(--accent-amber)' : undefined }}>
                        <td className="py-2.5 px-3 text-sm" style={{ color: 'var(--text-primary)' }}>{r.scenario}</td>
                        <td className="py-2.5 px-3 text-right" style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>${r.price}</td>
                        <td className="py-2.5 px-3 text-right" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>${r.afterFees}</td>
                        <td className="py-2.5 px-3 text-right" style={{ fontFamily: 'monospace', color: r.plPerTicket >= 0 ? '#10b981' : '#ef4444' }}>{r.plPerTicket >= 0 ? '+' : ''}${r.plPerTicket}</td>
                        <td className="py-2.5 px-3 text-right font-medium" style={{ fontFamily: 'monospace', color: r.totalPl >= 0 ? '#10b981' : '#ef4444' }}>{r.totalPl >= 0 ? '+' : ''}${r.totalPl.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right" style={{ fontFamily: 'monospace', color: r.roi >= 0 ? '#10b981' : '#ef4444' }}>{r.roi >= 0 ? '+' : ''}{r.roi}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeSection === 'comps' && (
              <div className="space-y-3">
                {analysis.comparable_events.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded border" style={{ borderColor: 'var(--border-default)' }}>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.event}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.date}</div>
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ fontFamily: 'monospace' }}>
                      <div className="text-center"><div style={{ color: 'var(--text-muted)' }}>Face</div><div style={{ color: 'var(--text-secondary)' }}>${c.face_value}</div></div>
                      <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                      <div className="text-center"><div style={{ color: 'var(--text-muted)' }}>Peak</div><div style={{ color: 'var(--text-primary)' }}>${c.peak_resale}</div></div>
                      <div className="text-center"><div style={{ color: 'var(--text-muted)' }}>ROI</div><div style={{ color: c.roi_achieved >= 100 ? '#10b981' : c.roi_achieved >= 50 ? '#f59e0b' : 'var(--text-secondary)' }}>+{c.roi_achieved}%</div></div>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-right mt-2" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Avg comp ROI: +{Math.round(analysis.comparable_events.reduce((s, c) => s + c.roi_achieved, 0) / analysis.comparable_events.length)}%
                </div>
              </div>
            )}

            {activeSection === 'signals' && (
              <div className="space-y-3">
                {analysis.demand_signals.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded border" style={{ borderColor: 'var(--border-default)' }}>
                    {s.direction === 'bullish' ? <TrendingUp size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} /> : <TrendingDown size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />}
                    <div className="flex-1">
                      <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.signal}</div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: s.strength === 'strong' ? '#064e3b' : '#78350f', color: s.strength === 'strong' ? '#6ee7b7' : '#fcd34d' }}>{s.strength}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: s.direction === 'bullish' ? '#064e3b' : '#7f1d1d', color: s.direction === 'bullish' ? '#6ee7b7' : '#fca5a5' }}>{s.direction}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'risks' && (
              <div className="space-y-3">
                {analysis.risk_factors.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded border" style={{ borderColor: '#78350f40' }}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
            Edge Calculator v0.1 · Not financial advice
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-lg border p-6 text-center" style={{ background: '#78350f20', borderColor: '#f59e0b40' }}>
          <AlertTriangle size={32} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
          <p className="text-sm mb-4" style={{ color: '#fcd34d' }}>{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={analyze} className="text-sm px-4 py-2 rounded" style={{ background: 'var(--accent-green)', color: '#fff' }}>Retry</button>
            <button onClick={loadDemo} className="text-sm px-4 py-2 rounded border" style={{ borderColor: 'var(--border-hover)', color: 'var(--text-secondary)' }}>Load demo instead</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analysis && !loading && !error && (
        <div className="text-center py-16">
          <Calculator size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Enter an event and buy price to analyze profitability</p>
          <button onClick={loadDemo} className="mt-4 text-xs underline" style={{ color: 'var(--accent-blue)' }}>or load a demo analysis</button>
        </div>
      )}
    </div>
  );
}
