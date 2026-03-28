import { useState, useMemo, useEffect } from 'react';
import { Shield, X, Plus, TrendingUp, TrendingDown, Minus, AlertTriangle, Search, Loader2, Brain } from 'lucide-react';
import { SAMPLE_POSITIONS } from '../lib/sampleData';
import { getPositions, upsertPosition } from '../lib/api';
import { callLLM } from '../components/APIClient';
import { WAR_ROOM_PROMPT } from '../lib/prompts';
import type { Position, RiskScore } from '../lib/types';

function calculateRisk(position: Position): RiskScore {
  const today = new Date();
  const eventDay = new Date(position.eventDate);
  const daysToEvent = Math.ceil((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const plPct = ((position.currentMarketPrice - position.costPerTicket) / position.costPerTicket) * 100;

  let timeRisk = 0;
  if (daysToEvent < 3) timeRisk = 40;
  else if (daysToEvent < 7) timeRisk = 35;
  else if (daysToEvent < 14) timeRisk = 25;
  else if (daysToEvent < 30) timeRisk = 15;
  else if (daysToEvent < 60) timeRisk = 5;

  let plRisk = 0;
  if (plPct < -15) plRisk = 30;
  else if (plPct < -5) plRisk = 22;
  else if (plPct < 0) plRisk = 15;
  else if (plPct < 10) plRisk = 8;

  let trendRisk = 0;
  if (position.priceTrend === 'declining') trendRisk = 20;
  else if (position.priceTrend === 'stable') trendRisk = 5;

  const categoryRisk = position.category === 'concert' ? 5 : position.category === 'theater' ? 3 : 0;
  const total = Math.min(timeRisk + plRisk + trendRisk + categoryRisk, 100);
  const zone: RiskScore['zone'] = total <= 30 ? 'safe' : total <= 60 ? 'watch' : 'danger';

  let action = '';
  if (zone === 'danger') {
    if (daysToEvent < 7 && plPct < 0) action = 'SELL NOW — event imminent, underwater';
    else if (plPct < -10) action = 'CUT LOSSES — price declining, limit damage';
    else action = 'URGENT REVIEW — multiple risk factors elevated';
  } else if (zone === 'watch') {
    if (plPct > 20) action = 'CONSIDER TAKING PROFIT — solid gains';
    else action = 'MONITOR — set alerts for price movement';
  } else {
    if (plPct > 50) action = 'HOLD — strong position, let it ride';
    else action = 'HOLD — healthy position, no action needed';
  }

  return { total, breakdown: { timeRisk, plRisk, trendRisk, categoryRisk }, zone, action };
}

function getRiskColor(score: number): string {
  if (score <= 30) return '#10b981';
  if (score <= 60) return '#f59e0b';
  return '#ef4444';
}

function getRiskBg(score: number): string {
  if (score <= 30) return '#064e3b';
  if (score <= 60) return '#78350f';
  return '#7f1d1d';
}

function getZoneBadge(zone: RiskScore['zone']) {
  const styles: Record<string, { bg: string; text: string }> = {
    safe: { bg: '#064e3b', text: '#6ee7b7' },
    watch: { bg: '#78350f', text: '#fcd34d' },
    danger: { bg: '#7f1d1d', text: '#fca5a5' },
  };
  return styles[zone];
}

export default function WarRoom() {
  const [positions, setPositions] = useState<Position[]>(SAMPLE_POSITIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('risk');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPos, setNewPos] = useState({ eventName: '', artistOrTeam: '', venue: '', eventDate: '', section: '', quantity: 2, costPerTicket: 0, currentMarketPrice: 0, category: 'concert' as const, priceTrend: 'stable' as const });

  useEffect(() => {
    getPositions()
      .then(data => { if (data.length > 0) setPositions(data); })
      .catch(() => { /* keep sample data as fallback */ });
  }, []);

  const positionsWithRisk = useMemo(() => positions.map(p => ({ ...p, risk: calculateRisk(p) })), [positions]);

  const filtered = useMemo(() => {
    let result = positionsWithRisk;
    if (categoryFilter !== 'all') result = result.filter(p => p.category === categoryFilter);
    if (riskFilter !== 'all') result = result.filter(p => p.risk.zone === riskFilter);
    if (searchQuery) result = result.filter(p => p.eventName.toLowerCase().includes(searchQuery.toLowerCase()));

    result.sort((a, b) => {
      if (sortBy === 'risk') return b.risk.total - a.risk.total;
      if (sortBy === 'days') return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      if (sortBy === 'pnl') return ((b.currentMarketPrice - b.costPerTicket) / b.costPerTicket) - ((a.currentMarketPrice - a.costPerTicket) / a.costPerTicket);
      if (sortBy === 'size') return (b.costPerTicket * b.quantity) - (a.costPerTicket * a.quantity);
      return 0;
    });
    return result;
  }, [positionsWithRisk, categoryFilter, riskFilter, sortBy, searchQuery]);

  const selected = selectedId ? positionsWithRisk.find(p => p.id === selectedId) : null;

  const totalCost = positionsWithRisk.reduce((s, p) => s + p.costPerTicket * p.quantity, 0);
  const totalMarket = positionsWithRisk.reduce((s, p) => s + p.currentMarketPrice * p.quantity, 0);
  const totalPl = totalMarket - totalCost;
  const plPct = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;
  const dangerCount = positionsWithRisk.filter(p => p.risk.zone === 'danger').length;
  const thisWeekCount = positionsWithRisk.filter(p => { const d = Math.ceil((new Date(p.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)); return d >= 0 && d <= 7; }).length;
  const biggestRisk = [...positionsWithRisk].sort((a, b) => b.risk.total - a.risk.total)[0];

  const addPosition = async () => {
    const purchaseDate = new Date().toISOString().split('T')[0];
    const localId = 'new-' + Date.now();
    const pos = { ...newPos, id: localId, purchaseDate };
    setPositions([...positions, pos]);
    setShowAddForm(false);
    setNewPos({ eventName: '', artistOrTeam: '', venue: '', eventDate: '', section: '', quantity: 2, costPerTicket: 0, currentMarketPrice: 0, category: 'concert', priceTrend: 'stable' });
    await upsertPosition({ ...newPos, purchaseDate }).catch(() => {});
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const analyzePortfolio = async () => {
    setAnalyzing(true);
    setShowAnalysis(true);
    try {
      const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const posData = positionsWithRisk.map(p => ({
        eventName: p.eventName, category: p.category, venue: p.venue, eventDate: p.eventDate,
        daysToEvent: Math.ceil((new Date(p.eventDate).getTime() - Date.now()) / 86400000),
        quantity: p.quantity, costPerTicket: p.costPerTicket, currentMarketPrice: p.currentMarketPrice,
        totalCost: p.costPerTicket * p.quantity, totalMarketValue: p.currentMarketPrice * p.quantity,
        plPerTicket: Math.round((p.currentMarketPrice * 0.85) - p.costPerTicket),
        roiPct: Math.round(((p.currentMarketPrice * 0.85 - p.costPerTicket) / p.costPerTicket) * 100),
        priceTrend: p.priceTrend, riskScore: p.risk.total, riskZone: p.risk.zone,
      }));
      const metricsStr = `Total positions: ${positions.length}\nTotal cost basis: $${totalCost.toLocaleString()}\nTotal market value: $${totalMarket.toLocaleString()}\nUnrealized P&L: $${totalPl.toLocaleString()} (${plPct.toFixed(1)}%)\nPositions in danger zone: ${dangerCount}`;
      const prompt = WAR_ROOM_PROMPT.buildPrompt({
        date, searchResults: "${searchResults}",
        positionData: JSON.stringify(posData, null, 2),
        metrics: metricsStr,
      });
      const searchQueries = typeof WAR_ROOM_PROMPT.searchQueries === 'function'
        ? WAR_ROOM_PROMPT.searchQueries({})
        : WAR_ROOM_PROMPT.searchQueries;
      const raw = await callLLM({ prompt, modelTier: WAR_ROOM_PROMPT.model, maxTokens: WAR_ROOM_PROMPT.maxTokens, searchQueries });
      setPortfolioAnalysis(JSON.parse(raw));
    } catch {
      setPortfolioAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const filterBtn = (label: string, value: string, current: string, setter: (v: string) => void, color?: string) => (
    <button key={value} onClick={() => setter(value)} className="px-3 py-1 rounded text-xs" style={{
      background: current === value ? (color || 'var(--border-hover)') : 'transparent',
      color: current === value ? '#fff' : 'var(--text-muted)',
      border: `1px solid ${current === value ? (color || 'var(--border-hover)') : 'var(--border-default)'}`,
    }}>{label}</button>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield size={24} style={{ color: '#f59e0b' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>War Room</h1>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#f59e0b', color: '#000', fontSize: '10px' }}>BETA</span>
        </div>
        <div className="flex gap-2">
          <button onClick={analyzePortfolio} disabled={analyzing} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs border" style={{ borderColor: '#f59e0b40', color: '#fcd34d', background: '#78350f30' }}>
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />} {analyzing ? 'Analyzing...' : 'Analyze Portfolio'}
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs border" style={{ borderColor: 'var(--border-hover)', color: 'var(--text-secondary)' }}><Plus size={14} /> Add Position</button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {[
          { label: 'Positions', value: positions.length, color: 'var(--text-primary)' },
          { label: 'Cost Basis', value: `$${totalCost.toLocaleString()}`, color: 'var(--text-primary)' },
          { label: 'Market Value', value: `$${totalMarket.toLocaleString()}`, color: 'var(--text-primary)' },
          { label: 'Unrealized P&L', value: `${totalPl >= 0 ? '+' : ''}$${totalPl.toLocaleString()}`, color: totalPl >= 0 ? '#10b981' : '#ef4444' },
          { label: 'P&L %', value: `${plPct >= 0 ? '+' : ''}${plPct.toFixed(1)}%`, color: plPct >= 0 ? '#10b981' : '#ef4444' },
          { label: 'At-Risk', value: dangerCount, color: dangerCount > 0 ? '#ef4444' : '#10b981' },
        ].map(m => (
          <div key={m.label} className="rounded-lg border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{m.label}</div>
            <div className="text-lg font-bold mt-1" style={{ fontFamily: 'monospace', color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Alert Bar */}
      {(dangerCount > 0 || thisWeekCount > 0) && (
        <div className="rounded-lg border p-3 mb-4 flex flex-wrap gap-4 text-xs" style={{ background: '#78350f20', borderColor: '#f59e0b40', color: '#fcd34d' }}>
          <AlertTriangle size={14} />
          {dangerCount > 0 && <span><strong>{dangerCount}</strong> positions need attention</span>}
          {thisWeekCount > 0 && <span><strong>{thisWeekCount}</strong> events this week</span>}
          {biggestRisk && <span>Biggest risk: <strong>{biggestRisk.eventName}</strong> — {biggestRisk.risk.action.split('—')[0]}</span>}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          {filterBtn('All', 'all', categoryFilter, setCategoryFilter)}
          {filterBtn('Concerts', 'concert', categoryFilter, setCategoryFilter)}
          {filterBtn('Sports', 'sports', categoryFilter, setCategoryFilter)}
          {filterBtn('Theater', 'theater', categoryFilter, setCategoryFilter)}
        </div>
        <div className="w-px h-5" style={{ background: 'var(--border-default)' }} />
        <div className="flex gap-1">
          {filterBtn('All', 'all', riskFilter, setRiskFilter)}
          {filterBtn('Safe', 'safe', riskFilter, setRiskFilter, '#064e3b')}
          {filterBtn('Watch', 'watch', riskFilter, setRiskFilter, '#78350f')}
          {filterBtn('Danger', 'danger', riskFilter, setRiskFilter, '#7f1d1d')}
        </div>
        <div className="w-px h-5" style={{ background: 'var(--border-default)' }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded px-2 py-1 text-xs border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          <option value="risk">Sort: Risk</option>
          <option value="days">Sort: Days</option>
          <option value="pnl">Sort: P&L</option>
          <option value="size">Sort: Size</option>
        </select>
        <div className="relative flex-1 min-w-[150px]">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search events..." className="w-full rounded pl-7 pr-3 py-1 text-xs border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      <div className="flex gap-4">
        {/* Heatmap */}
        <div className="flex-1 flex flex-wrap gap-2 content-start">
          {filtered.map(p => {
            const plPctPos = ((p.currentMarketPrice - p.costPerTicket) / p.costPerTicket) * 100;
            const daysTo = Math.ceil((new Date(p.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const posValue = p.costPerTicket * p.quantity;
            const basis = Math.max(Math.sqrt(posValue) * 1.8, 120);
            return (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                className="rounded-lg border p-3 cursor-pointer transition-all hover:brightness-110"
                style={{
                  flexBasis: `${basis}px`,
                  flexGrow: 1,
                  maxWidth: '300px',
                  minWidth: '120px',
                  background: getRiskBg(p.risk.total),
                  borderColor: selectedId === p.id ? getRiskColor(p.risk.total) : getRiskColor(p.risk.total) + '40',
                  boxShadow: selectedId === p.id ? `0 0 12px ${getRiskColor(p.risk.total)}30` : 'none',
                }}
              >
                <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.eventName}</div>
                <div className="flex items-center justify-between mt-1.5 text-xs" style={{ fontFamily: 'monospace' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{daysTo}d</span>
                  <span style={{ color: plPctPos >= 0 ? '#6ee7b7' : '#fca5a5' }}>{plPctPos >= 0 ? '+' : ''}{plPctPos.toFixed(0)}%</span>
                </div>
                {p.risk.zone === 'danger' && (
                  <div className="mt-1 text-xs px-1.5 py-0.5 rounded inline-block" style={{ background: '#ef444440', color: '#fca5a5', fontSize: '9px' }}>ACTION NEEDED</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-[340px] shrink-0 rounded-lg border p-4 animate-fade-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{selected.eventName}</h3>
              <button onClick={() => setSelectedId(null)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="text-xs space-y-1 mb-4" style={{ color: 'var(--text-secondary)' }}>
              <div>{selected.venue}</div>
              <div>{new Date(selected.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div className="flex items-center gap-1">
                {selected.priceTrend === 'rising' ? <TrendingUp size={12} style={{ color: '#10b981' }} /> : selected.priceTrend === 'declining' ? <TrendingDown size={12} style={{ color: '#ef4444' }} /> : <Minus size={12} style={{ color: '#6b7280' }} />}
                {selected.priceTrend}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded p-2 text-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Cost</div>
                <div className="text-sm font-bold" style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>${(selected.costPerTicket * selected.quantity).toLocaleString()}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{selected.quantity} × ${selected.costPerTicket}</div>
              </div>
              <div className="rounded p-2 text-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Market</div>
                <div className="text-sm font-bold" style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>${(selected.currentMarketPrice * selected.quantity).toLocaleString()}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{selected.quantity} × ${selected.currentMarketPrice}</div>
              </div>
            </div>

            {(() => {
              const pl = (selected.currentMarketPrice - selected.costPerTicket) * selected.quantity;
              const plPer = selected.currentMarketPrice - selected.costPerTicket;
              return (
                <div className="rounded p-3 mb-4 text-center" style={{ background: pl >= 0 ? '#064e3b' : '#7f1d1d' }}>
                  <div className="text-xs" style={{ color: pl >= 0 ? '#6ee7b7' : '#fca5a5' }}>Total P&L</div>
                  <div className="text-xl font-bold" style={{ fontFamily: 'monospace', color: pl >= 0 ? '#6ee7b7' : '#fca5a5' }}>{pl >= 0 ? '+' : ''}${pl.toLocaleString()}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{plPer >= 0 ? '+' : ''}${plPer}/ticket</div>
                </div>
              );
            })()}

            <div className="mb-4">
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Risk Breakdown</div>
              <div className="text-2xl font-bold mb-2" style={{ fontFamily: 'monospace', color: getRiskColor(selected.risk.total) }}>{selected.risk.total}</div>
              {Object.entries(selected.risk.breakdown).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs w-16 capitalize" style={{ color: 'var(--text-muted)' }}>{key.replace('Risk', '')}</span>
                  <div className="flex-1 h-2 rounded-full" style={{ background: '#1f2937' }}>
                    <div className="h-full rounded-full" style={{ width: `${(value / 40) * 100}%`, background: getRiskColor(selected.risk.total) }} />
                  </div>
                  <span className="text-xs w-6 text-right" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="rounded p-3" style={{ ...getZoneBadge(selected.risk.zone), background: getZoneBadge(selected.risk.zone).bg }}>
              <div className="text-xs font-bold" style={{ color: getZoneBadge(selected.risk.zone).text }}>{selected.risk.action}</div>
            </div>
          </div>
        )}
      </div>

      {/* Portfolio Analysis Panel */}
      {showAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAnalysis(false)}>
          <div className="rounded-lg border p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Brain size={18} style={{ color: '#f59e0b' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Portfolio Analysis</h3>
              </div>
              <button type="button" onClick={() => setShowAnalysis(false)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>

            {analyzing && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin" style={{ color: '#f59e0b' }} />
                <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>Analyzing {positions.length} positions...</span>
              </div>
            )}

            {!analyzing && !portfolioAnalysis && (
              <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                Analysis unavailable. Try again.
              </div>
            )}

            {!analyzing && portfolioAnalysis && (
              <div className="space-y-4 text-sm">
                {/* Grade + Headline */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold" style={{ fontFamily: 'monospace', color: portfolioAnalysis.portfolio_health_grade?.startsWith('A') || portfolioAnalysis.portfolio_health_grade?.startsWith('B') ? '#10b981' : portfolioAnalysis.portfolio_health_grade?.startsWith('C') ? '#f59e0b' : '#ef4444' }}>
                    {portfolioAnalysis.portfolio_health_grade}
                  </span>
                  <p style={{ color: 'var(--text-secondary)' }}>{portfolioAnalysis.headline}</p>
                </div>

                {/* Triage */}
                {portfolioAnalysis.triage?.immediate?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#ef4444' }}>Immediate Action</div>
                    {portfolioAnalysis.triage.immediate.map((t: { position: string; prescribed_action: string; financial_impact: string }, i: number) => (
                      <div key={i} className="rounded p-3 mb-2" style={{ background: '#7f1d1d' }}>
                        <div className="font-semibold" style={{ color: '#fca5a5' }}>{t.position}</div>
                        <div style={{ color: '#fca5a5' }}>{t.prescribed_action}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t.financial_impact}</div>
                      </div>
                    ))}
                  </div>
                )}

                {portfolioAnalysis.triage?.this_week?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f59e0b' }}>This Week</div>
                    {portfolioAnalysis.triage.this_week.map((t: { position: string; prescribed_action: string; financial_impact: string }, i: number) => (
                      <div key={i} className="rounded p-3 mb-2" style={{ background: '#78350f' }}>
                        <div className="font-semibold" style={{ color: '#fcd34d' }}>{t.position}</div>
                        <div style={{ color: '#fcd34d' }}>{t.prescribed_action}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t.financial_impact}</div>
                      </div>
                    ))}
                  </div>
                )}

                {portfolioAnalysis.triage?.monitor_count > 0 && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{portfolioAnalysis.triage.monitor_count} positions in monitor (no action needed)</div>
                )}

                {/* Exposure */}
                {portfolioAnalysis.exposure_analysis?.concentration_verdict && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Concentration</div>
                    <p style={{ color: 'var(--text-secondary)' }}>{portfolioAnalysis.exposure_analysis.concentration_verdict}</p>
                  </div>
                )}

                {/* Patterns */}
                {portfolioAnalysis.patterns?.strengths?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#10b981' }}>Strengths</div>
                    {portfolioAnalysis.patterns.strengths.map((s: { pattern: string; recommendation: string }, i: number) => (
                      <div key={i} className="mb-1">
                        <span style={{ color: 'var(--text-primary)' }}>{s.pattern}</span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{s.recommendation}</span>
                      </div>
                    ))}
                  </div>
                )}

                {portfolioAnalysis.patterns?.weaknesses?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#ef4444' }}>Weaknesses</div>
                    {portfolioAnalysis.patterns.weaknesses.map((w: { pattern: string; recommendation: string }, i: number) => (
                      <div key={i} className="mb-1">
                        <span style={{ color: 'var(--text-primary)' }}>{w.pattern}</span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{w.recommendation}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rebalancing */}
                {portfolioAnalysis.rebalancing?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Rebalancing</div>
                    {portfolioAnalysis.rebalancing.map((r: { action: string; position: string; detail: string }, i: number) => (
                      <div key={i} className="flex gap-2 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{
                          background: r.action === 'EXIT' ? '#7f1d1d' : r.action === 'TRIM' ? '#78350f' : r.action === 'ADD' ? '#064e3b' : '#1f2937',
                          color: r.action === 'EXIT' ? '#fca5a5' : r.action === 'TRIM' ? '#fcd34d' : r.action === 'ADD' ? '#6ee7b7' : '#9ca3af',
                        }}>{r.action}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{r.position}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Position Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddForm(false)}>
          <div className="rounded-lg border p-6 w-full max-w-lg" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Add Position</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Event Name', key: 'eventName', full: true, type: 'text' },
                { label: 'Venue', key: 'venue', type: 'text' },
                { label: 'Event Date', key: 'eventDate', type: 'date' },
                { label: 'Section', key: 'section', type: 'text' },
                { label: 'Quantity', key: 'quantity', type: 'number' },
                { label: 'Cost/Ticket', key: 'costPerTicket', type: 'number' },
                { label: 'Market Price', key: 'currentMarketPrice', type: 'number' },
              ].map(f => (
                <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                  <label className="block mb-1 text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{f.label}</label>
                  <input type={f.type} value={(newPos as Record<string, string | number>)[f.key]} onChange={e => setNewPos({ ...newPos, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })} className="w-full rounded px-3 py-2 text-sm border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                </div>
              ))}
              <div>
                <label className="block mb-1 text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Category</label>
                <select value={newPos.category} onChange={e => setNewPos({ ...newPos, category: e.target.value as Position['category'] })} className="w-full rounded px-3 py-2 text-sm border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                  <option value="concert">Concert</option><option value="sports">Sports</option><option value="theater">Theater</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={addPosition} className="flex-1 py-2 rounded text-sm font-medium" style={{ background: 'var(--accent-green)', color: '#fff' }}>Add Position</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded text-sm border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-center py-3 mt-4" style={{ color: 'var(--text-muted)' }}>
        {positions.length} positions · Last updated {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
