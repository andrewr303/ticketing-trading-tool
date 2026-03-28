import { useState, useMemo } from 'react';
import { Radar as RadarIcon, Plus, RefreshCw, ArrowUp, ArrowDown, ArrowRight, X, Globe, Music, Search, Newspaper, Users, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { callClaude } from '../components/APIClient';
import { SAMPLE_WATCHLIST } from '../lib/sampleData';
import type { WatchlistEvent, SignalAnalysis, Signal } from '../lib/types';

const SAMPLE_SIGNALS: Record<string, SignalAnalysis> = {
  w1: {
    demand_score: 94, trend: "surging",
    signals: [
      { source: "social_media", signal_name: "Twitter/X Mentions", value: "45K+ mentions in 24hrs", direction: "up", weight: "high", detail: "Tour announcement drove massive social engagement. #KendrickDenver trending locally." },
      { source: "streaming", signal_name: "Spotify Streams", value: "+280% week-over-week", direction: "up", weight: "high", detail: "Album streams surging post-tour announcement. Denver market over-indexing." },
      { source: "search", signal_name: "Google Trends", value: "Score 92/100 (Denver)", direction: "up", weight: "high", detail: "Search interest at near-peak levels. 'Kendrick Denver tickets' breakout query." },
      { source: "news", signal_name: "Media Coverage", value: "12 major articles this week", direction: "up", weight: "medium", detail: "Rolling Stone, Pitchfork, Denver Post all covering the Denver date." },
      { source: "community", signal_name: "Reddit/Fan Forums", value: "3 front-page posts on r/Denver", direction: "up", weight: "medium", detail: "Fan excitement extremely high. Multiple threads about presale strategy." },
    ],
    demand_narrative: "Kendrick Lamar's Denver stadium show is generating the strongest demand signals we've seen for a Denver concert since Beyonce's Renaissance Tour. Every measurable signal is pointing up.",
    price_implication: "Secondary market prices should open 80-120% above face value for floor seats and 40-70% above for lower bowl.",
    action_window: "Buy at face during presale TODAY. First 48 hours post-onsale offer the best entry.",
    catalysts_ahead: ["Presale results (today)", "General on-sale (Friday)", "Setlist/production leaks", "Potential guest artist announcement"],
  },
};

const SOURCE_ICONS: Record<string, typeof Globe> = { social_media: Globe, streaming: Music, search: Search, news: Newspaper, community: Users };
const TREND_DISPLAY: Record<string, { icon: typeof ArrowUp; label: string; color: string }> = {
  surging: { icon: TrendingUp, label: 'Surging', color: '#10b981' },
  rising: { icon: ArrowUp, label: 'Rising', color: '#34d399' },
  stable: { icon: ArrowRight, label: 'Stable', color: '#6b7280' },
  declining: { icon: ArrowDown, label: 'Declining', color: '#f59e0b' },
  crashing: { icon: TrendingDown, label: 'Crashing', color: '#ef4444' },
};

function DemandGauge({ value, color }: { value: number; color: string }) {
  const pct = Math.min(value / 100, 1);
  const radius = 50;
  const circumference = Math.PI * radius;
  const filled = circumference * pct;
  return (
    <svg width="140" height="80" viewBox="0 0 140 80">
      <path d="M 15 75 A 55 55 0 0 1 125 75" fill="none" stroke="#1f2937" strokeWidth={12} strokeLinecap="round" />
      <path d="M 15 75 A 55 55 0 0 1 125 75" fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${filled} ${circumference}`} />
      <text x="70" y="65" textAnchor="middle" fill={color} fontSize="28" fontWeight="bold" fontFamily="monospace">{value}</text>
    </svg>
  );
}

function getScoreColor(score: number | undefined): string {
  if (!score) return '#374151';
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#34d399';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#ef4444';
  return '#991b1b';
}

export default function RadarPage() {
  const [watchlist, setWatchlist] = useState<WatchlistEvent[]>(SAMPLE_WATCHLIST);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signalData, setSignalData] = useState<Record<string, SignalAnalysis>>(SAMPLE_SIGNALS);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('score');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', category: 'concert' as const, eventDate: '', venue: '' });

  const filtered = useMemo(() => {
    let result = [...watchlist];
    if (filter !== 'all') result = result.filter(e => e.trend === filter);
    result.sort((a, b) => {
      if (sortBy === 'score') return (b.demandScore || 0) - (a.demandScore || 0);
      if (sortBy === 'days') return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      return 0;
    });
    return result;
  }, [watchlist, filter, sortBy]);

  const selected = selectedId ? watchlist.find(e => e.id === selectedId) : null;
  const selectedSignals = selectedId ? signalData[selectedId] : null;

  const categoryAvgs = useMemo(() => {
    const cats: Record<string, number[]> = { concert: [], sports: [], theater: [] };
    watchlist.forEach(e => { if (e.demandScore) cats[e.category]?.push(e.demandScore); });
    return Object.entries(cats).map(([cat, scores]) => ({ cat, avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0 }));
  }, [watchlist]);

  const analyzeEvent = async (event: WatchlistEvent) => {
    setLoadingMap(m => ({ ...m, [event.id]: true }));
    try {
      const prompt = `Analyze current demand signals for this live event:
Event: ${event.name}, Venue: ${event.venue}, Date: ${event.eventDate}, Category: ${event.category}

Use web search to find: Social media buzz, streaming numbers, Google Trends, news coverage, fan community sentiment, viral moments.

Return ONLY valid JSON (no markdown, no backticks) matching this schema:
${JSON.stringify(SAMPLE_SIGNALS.w1, null, 2)}

Be specific about numbers and sources.`;
      const raw = await callClaude(prompt, true);
      const parsed: SignalAnalysis = JSON.parse(raw);
      setSignalData(d => ({ ...d, [event.id]: parsed }));
      setWatchlist(wl => wl.map(e => e.id === event.id ? { ...e, demandScore: parsed.demand_score, trend: parsed.trend, lastAnalyzed: new Date().toISOString() } : e));
    } catch {
      if (!signalData[event.id]) {
        setSignalData(d => ({ ...d, [event.id]: SAMPLE_SIGNALS.w1 }));
      }
    } finally {
      setLoadingMap(m => ({ ...m, [event.id]: false }));
    }
  };

  const addEvent = () => {
    const id = 'w-' + Date.now();
    setWatchlist([...watchlist, { id, ...newEvent }]);
    setShowAddForm(false);
    setNewEvent({ name: '', category: 'concert', eventDate: '', venue: '' });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <RadarIcon size={24} style={{ color: '#06b6d4' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>The Radar</h1>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#06b6d4', color: '#fff', fontSize: '10px' }}>BETA</span>
        </div>
        <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs border" style={{ borderColor: 'var(--border-hover)', color: 'var(--text-secondary)' }}><Plus size={14} /> Add Event</button>
      </div>

      {/* Category Pulse */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {categoryAvgs.map(c => (
          <div key={c.cat} className="rounded-lg border p-3 flex items-center justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div>
              <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{c.cat === 'concert' ? 'Concerts' : c.cat === 'sports' ? 'Sports' : 'Theater'}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Avg Demand</div>
            </div>
            <div className="text-2xl font-bold" style={{ fontFamily: 'monospace', color: getScoreColor(c.avg) }}>{c.avg || '—'}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {['all', 'surging', 'rising', 'stable', 'declining'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className="px-3 py-1 rounded text-xs capitalize" style={{ background: filter === f ? 'var(--border-hover)' : 'transparent', color: filter === f ? '#fff' : 'var(--text-muted)', border: `1px solid ${filter === f ? 'var(--border-hover)' : 'var(--border-default)'}` }}>{f}</button>
        ))}
        <div className="w-px h-5" style={{ background: 'var(--border-default)' }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded px-2 py-1 text-xs border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          <option value="score">Sort: Demand Score</option>
          <option value="days">Sort: Days to Event</option>
        </select>
      </div>

      <div className="flex gap-4">
        {/* Watchlist Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(event => {
            const trend = event.trend ? TREND_DISPLAY[event.trend] : null;
            const TrendIcon = trend?.icon || ArrowRight;
            const isLoading = loadingMap[event.id];
            return (
              <div
                key={event.id}
                onClick={() => setSelectedId(event.id === selectedId ? null : event.id)}
                className="rounded-lg border p-4 cursor-pointer transition-all"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: selectedId === event.id ? getScoreColor(event.demandScore) : getScoreColor(event.demandScore) + '40',
                  boxShadow: event.trend === 'surging' ? `0 0 12px ${getScoreColor(event.demandScore)}30` : 'none',
                }}
              >
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{event.name}</div>
                <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{event.category}</span>
                  <span>·</span>
                  <span>{new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    {event.demandScore != null ? (
                      <div className="text-3xl font-bold" style={{ fontFamily: 'monospace', color: getScoreColor(event.demandScore) }}>{event.demandScore}</div>
                    ) : (
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Not analyzed</div>
                    )}
                  </div>
                  {trend && (
                    <div className="flex items-center gap-1">
                      <TrendIcon size={14} style={{ color: trend.color }} />
                      <span className="text-xs" style={{ color: trend.color }}>{trend.label}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); analyzeEvent(event); }}
                  disabled={isLoading}
                  className="mt-3 w-full py-1.5 rounded text-xs flex items-center justify-center gap-1 border"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'transparent' }}
                >
                  {isLoading ? <><Loader2 size={12} className="animate-spin" /> Analyzing...</> : <><RefreshCw size={12} /> {event.demandScore != null ? 'Re-analyze' : 'Analyze'}</>}
                </button>
              </div>
            );
          })}
        </div>

        {/* Signal Detail Panel */}
        {selected && selectedSignals && (
          <div className="w-[360px] shrink-0 rounded-lg border p-4 animate-fade-in max-h-[calc(100vh-200px)] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h3>
              <button onClick={() => setSelectedId(null)}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
            </div>

            <div className="flex justify-center mb-4">
              <DemandGauge value={selectedSignals.demand_score} color={getScoreColor(selectedSignals.demand_score)} />
            </div>

            {(() => {
              const trend = TREND_DISPLAY[selectedSignals.trend];
              return trend ? (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <trend.icon size={18} style={{ color: trend.color }} />
                  <span className="text-sm font-bold" style={{ color: trend.color }}>{trend.label}</span>
                </div>
              ) : null;
            })()}

            <div className="space-y-2 mb-4">
              {selectedSignals.signals.map((s: Signal, i: number) => {
                const SrcIcon = SOURCE_ICONS[s.source] || Globe;
                return (
                  <div key={i} className="rounded border p-3" style={{ borderColor: 'var(--border-default)', borderLeft: `3px solid ${s.direction === 'up' ? '#10b981' : s.direction === 'down' ? '#ef4444' : '#6b7280'}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <SrcIcon size={12} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{s.signal_name}</span>
                      {s.direction === 'up' ? <ArrowUp size={12} style={{ color: '#10b981' }} /> : s.direction === 'down' ? <ArrowDown size={12} style={{ color: '#ef4444' }} /> : <ArrowRight size={12} style={{ color: '#6b7280' }} />}
                      <span className="text-xs px-1.5 py-0.5 rounded ml-auto" style={{ background: s.weight === 'high' ? '#064e3b' : s.weight === 'medium' ? '#78350f' : '#1f2937', color: s.weight === 'high' ? '#6ee7b7' : s.weight === 'medium' ? '#fcd34d' : '#9ca3af' }}>{s.weight}</span>
                    </div>
                    <div className="text-xs" style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{s.value}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.detail}</div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <div><h4 className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Demand Narrative</h4><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedSignals.demand_narrative}</p></div>
              <div className="rounded p-3" style={{ background: '#064e3b20', border: '1px solid #10b98140' }}><h4 className="text-xs uppercase tracking-widest mb-1" style={{ color: '#6ee7b7' }}>Price Implication</h4><p className="text-xs" style={{ color: '#6ee7b7' }}>{selectedSignals.price_implication}</p></div>
              <div className="rounded p-3" style={{ background: '#1e3a5f20', border: '1px solid #3b82f640' }}><h4 className="text-xs uppercase tracking-widest mb-1" style={{ color: '#93c5fd' }}>Action Window</h4><p className="text-xs" style={{ color: '#93c5fd' }}>{selectedSignals.action_window}</p></div>
              <div><h4 className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Upcoming Catalysts</h4>
                {selectedSignals.catalysts_ahead.map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1" style={{ color: 'var(--text-secondary)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#3b82f6' }} />{c}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddForm(false)}>
          <div className="rounded-lg border p-6 w-full max-w-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Add to Watchlist</h3>
            <div className="space-y-3 mb-4">
              <div><label className="block mb-1 text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Event Name</label><input value={newEvent.name} onChange={e => setNewEvent({ ...newEvent, name: e.target.value })} className="w-full rounded px-3 py-2 text-sm border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
              <div><label className="block mb-1 text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Category</label><select value={newEvent.category} onChange={e => setNewEvent({ ...newEvent, category: e.target.value as WatchlistEvent['category'] })} className="w-full rounded px-3 py-2 text-sm border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}><option value="concert">Concert</option><option value="sports">Sports</option><option value="theater">Theater</option></select></div>
              <div><label className="block mb-1 text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Event Date</label><input type="date" value={newEvent.eventDate} onChange={e => setNewEvent({ ...newEvent, eventDate: e.target.value })} className="w-full rounded px-3 py-2 text-sm border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
              <div><label className="block mb-1 text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Venue</label><input value={newEvent.venue} onChange={e => setNewEvent({ ...newEvent, venue: e.target.value })} className="w-full rounded px-3 py-2 text-sm border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
            </div>
            <div className="flex gap-3">
              <button onClick={addEvent} className="flex-1 py-2 rounded text-sm font-medium" style={{ background: '#06b6d4', color: '#fff' }}>Add to Watchlist</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded text-sm border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
