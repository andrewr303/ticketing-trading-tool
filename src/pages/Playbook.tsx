import { useState, useMemo, useEffect } from 'react';
import { BookOpen, Brain, Loader2, TrendingUp, TrendingDown, DollarSign, Target, Award, AlertTriangle, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { SAMPLE_TRADES } from '../lib/sampleData';
import { getTrades } from '../lib/api';
import { callLLM } from '../components/APIClient';
import { PLAYBOOK_PROMPT } from '../lib/prompts';
import type { Trade, PerformanceAnalysis } from '../lib/types';

function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function computeTradeMetrics(t: Trade) {
  const holdDays = daysBetween(t.buyDate, t.sellDate);
  const totalCost = t.costPerTicket * t.quantity;
  const totalRevenue = t.salePrice * t.quantity;
  const netProfit = totalRevenue - t.feesPaid - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  return { holdDays, totalCost, totalRevenue, netProfit, roi, isWin: netProfit > 0 };
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#10b981', A: '#10b981', 'B+': '#34d399', B: '#34d399', 'B-': '#6ee7b7',
  'C+': '#f59e0b', C: '#f59e0b', 'C-': '#f59e0b',
  D: '#ef4444', F: '#ef4444',
};

export default function Playbook() {
  const [trades, setTrades] = useState<Trade[]>(SAMPLE_TRADES);
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'coaching'>('overview');

  useEffect(() => {
    getTrades()
      .then(data => { if (data.length > 0) setTrades(data); })
      .catch(() => {});
  }, []);

  const enriched = useMemo(() => trades.map(t => ({ ...t, ...computeTradeMetrics(t) })), [trades]);

  const metrics = useMemo(() => {
    const wins = enriched.filter(t => t.isWin).length;
    const totalPL = enriched.reduce((s, t) => s + t.netProfit, 0);
    const avgROI = enriched.length > 0 ? enriched.reduce((s, t) => s + t.roi, 0) / enriched.length : 0;
    const best = [...enriched].sort((a, b) => b.netProfit - a.netProfit)[0];
    const worst = [...enriched].sort((a, b) => a.netProfit - b.netProfit)[0];
    return {
      totalTrades: enriched.length,
      winRate: enriched.length > 0 ? Math.round((wins / enriched.length) * 100) : 0,
      totalPL: Math.round(totalPL),
      avgROI: Math.round(avgROI),
      best,
      worst,
    };
  }, [enriched]);

  // Cumulative P&L chart data
  const cumulativePL = useMemo(() => {
    const sorted = [...enriched].sort((a, b) => new Date(a.sellDate).getTime() - new Date(b.sellDate).getTime());
    let cumulative = 0;
    return sorted.map(t => {
      cumulative += t.netProfit;
      return { date: new Date(t.sellDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), pl: Math.round(cumulative), name: t.eventName.split(' ')[0] };
    });
  }, [enriched]);

  // ROI by category
  const categoryData = useMemo(() => {
    const cats: Record<string, { total: number; count: number; wins: number }> = {};
    enriched.forEach(t => {
      if (!cats[t.category]) cats[t.category] = { total: 0, count: 0, wins: 0 };
      cats[t.category].total += t.roi;
      cats[t.category].count++;
      if (t.isWin) cats[t.category].wins++;
    });
    return Object.entries(cats).map(([cat, d]) => ({
      category: cat.charAt(0).toUpperCase() + cat.slice(1),
      avgROI: Math.round(d.total / d.count),
      winRate: Math.round((d.wins / d.count) * 100),
      count: d.count,
    }));
  }, [enriched]);

  const analyzeTrading = async () => {
    setAnalyzing(true);
    setActiveTab('coaching');
    try {
      const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const tradeData = enriched.map(t => ({
        eventName: t.eventName, category: t.category, venue: t.venue,
        buyDate: t.buyDate, sellDate: t.sellDate, holdDays: t.holdDays,
        section: t.section, quantity: t.quantity,
        costPerTicket: t.costPerTicket, salePrice: t.salePrice,
        platformSold: t.platformSold, feesPaid: t.feesPaid,
        netProfit: Math.round(t.netProfit), roi: Math.round(t.roi),
        isWin: t.isWin, notes: t.notes,
      }));
      const metricsStr = [
        `Total trades: ${metrics.totalTrades}`,
        `Win rate: ${metrics.winRate}%`,
        `Total P&L: $${metrics.totalPL.toLocaleString()}`,
        `Average ROI: ${metrics.avgROI}%`,
        metrics.best ? `Best trade: ${metrics.best.eventName} (+$${Math.round(metrics.best.netProfit)})` : '',
        metrics.worst ? `Worst trade: ${metrics.worst.eventName} ($${Math.round(metrics.worst.netProfit)})` : '',
      ].filter(Boolean).join('\n');
      const prompt = PLAYBOOK_PROMPT.buildPrompt({
        date, searchResults: '',
        tradeData: JSON.stringify(tradeData, null, 2),
        metrics: metricsStr,
      });
      const raw = await callLLM({ prompt, modelTier: PLAYBOOK_PROMPT.model, maxTokens: PLAYBOOK_PROMPT.maxTokens, searchQueries: [] });
      setAnalysis(JSON.parse(raw));
    } catch {
      setAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const statCard = (label: string, value: string, color: string, icon: typeof DollarSign) => {
    const Icon = icon;
    return (
      <div className="rounded-lg border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} style={{ color }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{label}</span>
        </div>
        <div className="text-lg font-bold" style={{ fontFamily: 'monospace', color }}>{value}</div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen size={24} style={{ color: '#f97316' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>The Playbook</h1>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#f97316', color: '#000', fontSize: '10px' }}>BETA</span>
        </div>
        <button type="button" onClick={analyzeTrading} disabled={analyzing} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs border" style={{ borderColor: '#f9731640', color: '#fb923c', background: '#7c2d1230' }}>
          {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
          {analyzing ? 'Analyzing...' : 'Analyze My Trading'}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {statCard('Total Trades', String(metrics.totalTrades), 'var(--text-primary)', BarChart3)}
        {statCard('Win Rate', `${metrics.winRate}%`, metrics.winRate >= 55 ? '#10b981' : metrics.winRate >= 45 ? '#f59e0b' : '#ef4444', Target)}
        {statCard('Total P&L', `${metrics.totalPL >= 0 ? '+' : ''}$${metrics.totalPL.toLocaleString()}`, metrics.totalPL >= 0 ? '#10b981' : '#ef4444', DollarSign)}
        {statCard('Avg ROI', `${metrics.avgROI >= 0 ? '+' : ''}${metrics.avgROI}%`, metrics.avgROI >= 0 ? '#10b981' : '#ef4444', TrendingUp)}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(['overview', 'trades', 'coaching'] as const).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className="px-3 py-1.5 rounded text-xs" style={{
            background: activeTab === tab ? 'var(--border-hover)' : 'transparent',
            color: activeTab === tab ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${activeTab === tab ? 'var(--border-hover)' : 'var(--border-default)'}`,
          }}>
            {tab === 'overview' ? 'Overview' : tab === 'trades' ? 'Trade Log' : 'AI Coaching'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-fade-in">
          {/* Cumulative P&L Chart */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>Cumulative P&L</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cumulativePL}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`$${v}`, 'P&L']} />
                <Line type="monotone" dataKey="pl" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ROI by Category */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>ROI by Category</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="category" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`, 'Avg ROI']} />
                <Bar dataKey="avgROI" radius={[4, 4, 0, 0]}>
                  {categoryData.map((d, i) => (
                    <Cell key={i} fill={d.avgROI >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Best/Worst */}
          <div className="grid grid-cols-2 gap-3">
            {metrics.best && (
              <div className="rounded-lg border p-3" style={{ background: '#064e3b', borderColor: '#10b98140' }}>
                <div className="text-xs uppercase tracking-widest" style={{ color: '#6ee7b7', fontSize: '10px' }}>Best Trade</div>
                <div className="text-sm font-semibold mt-1" style={{ color: '#6ee7b7' }}>{metrics.best.eventName}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>+${Math.round(metrics.best.netProfit)} ({Math.round(metrics.best.roi)}% ROI)</div>
              </div>
            )}
            {metrics.worst && (
              <div className="rounded-lg border p-3" style={{ background: '#7f1d1d', borderColor: '#ef444440' }}>
                <div className="text-xs uppercase tracking-widest" style={{ color: '#fca5a5', fontSize: '10px' }}>Worst Trade</div>
                <div className="text-sm font-semibold mt-1" style={{ color: '#fca5a5' }}>{metrics.worst.eventName}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>${Math.round(metrics.worst.netProfit)} ({Math.round(metrics.worst.roi)}% ROI)</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trade Log Tab */}
      {activeTab === 'trades' && (
        <div className="rounded-lg border overflow-hidden animate-fade-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-primary)' }}>
                  {['Event', 'Category', 'Qty', 'Cost', 'Sale', 'Fees', 'P&L', 'ROI', 'Hold', 'Platform'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map(t => (
                  <tr key={t.id} className="border-t" style={{ borderColor: 'var(--border-default)' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)', maxWidth: 200 }}>
                      <div className="truncate">{t.eventName}</div>
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{t.category}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{t.quantity}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>${t.costPerTicket}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>${t.salePrice}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>${Math.round(t.feesPaid)}</td>
                    <td className="px-3 py-2 font-medium" style={{ fontFamily: 'monospace', color: t.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                      {t.netProfit >= 0 ? '+' : ''}${Math.round(t.netProfit)}
                    </td>
                    <td className="px-3 py-2" style={{ fontFamily: 'monospace', color: t.roi >= 0 ? '#10b981' : '#ef4444' }}>
                      {t.roi >= 0 ? '+' : ''}{Math.round(t.roi)}%
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{t.holdDays}d</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{t.platformSold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Coaching Tab */}
      {activeTab === 'coaching' && (
        <div className="animate-fade-in">
          {analyzing && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin" style={{ color: '#f97316' }} />
              <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>Analyzing {trades.length} trades...</span>
            </div>
          )}

          {!analyzing && !analysis && (
            <div className="text-center py-16">
              <Brain size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Click "Analyze My Trading" to get AI coaching insights.</p>
            </div>
          )}

          {!analyzing && analysis && (
            <div className="space-y-4 text-sm">
              {/* Grade + Assessment */}
              <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Award size={20} style={{ color: GRADE_COLORS[analysis.grade] || '#6b7280' }} />
                    <span className="text-3xl font-bold" style={{ fontFamily: 'monospace', color: GRADE_COLORS[analysis.grade] || '#6b7280' }}>{analysis.grade}</span>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{analysis.overall_assessment}</p>
              </div>

              {/* Optimal Profile */}
              {analysis.optimal_profile && (
                <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#f97316' }}>Your Sweet Spot</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Best Category', value: analysis.optimal_profile.best_category },
                      { label: 'Best Hold Period', value: analysis.optimal_profile.best_hold_period },
                      { label: 'Best Venue', value: analysis.optimal_profile.best_venue },
                      { label: 'Price Range', value: analysis.optimal_profile.sweet_spot_price_range },
                    ].map(item => (
                      <div key={item.label}>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {analysis.strengths?.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#10b981' }}>
                    <TrendingUp size={12} className="inline mr-1" /> Strengths
                  </div>
                  {analysis.strengths.map((s, i) => (
                    <div key={i} className="rounded-lg border p-3 mb-2" style={{ background: '#064e3b30', borderColor: '#10b98130' }}>
                      <div className="font-semibold mb-1" style={{ color: '#6ee7b7' }}>{s.pattern}</div>
                      <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{s.evidence}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.recommendation}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Weaknesses */}
              {analysis.weaknesses?.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#ef4444' }}>
                    <TrendingDown size={12} className="inline mr-1" /> Weaknesses
                  </div>
                  {analysis.weaknesses.map((w, i) => (
                    <div key={i} className="rounded-lg border p-3 mb-2" style={{ background: '#7f1d1d30', borderColor: '#ef444430' }}>
                      <div className="font-semibold mb-1" style={{ color: '#fca5a5' }}>{w.pattern}</div>
                      <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{w.evidence}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{w.recommendation}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Insights */}
              {analysis.insights?.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#3b82f6' }}>
                    <Target size={12} className="inline mr-1" /> Insights
                  </div>
                  {analysis.insights.map((ins, i) => (
                    <div key={i} className="rounded-lg border p-3 mb-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                      <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{ins.insight}</div>
                      <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{ins.data_point}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{ins.actionable_next_step}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mistakes to Avoid */}
              {analysis.mistakes_to_avoid?.length > 0 && (
                <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f59e0b' }}>
                    <AlertTriangle size={12} className="inline mr-1" /> Mistakes to Avoid
                  </div>
                  {analysis.mistakes_to_avoid.map((m, i) => (
                    <div key={i} className="text-xs py-1.5 border-b last:border-0" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>{m}</div>
                  ))}
                </div>
              )}

              {/* Next Month Focus */}
              {analysis.next_month_focus && (
                <div className="rounded-lg border p-4" style={{ background: '#f9731615', borderColor: '#f9731640' }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f97316' }}>Next Month Focus</div>
                  <p style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>{analysis.next_month_focus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-center py-3 mt-4" style={{ color: 'var(--text-muted)' }}>
        {trades.length} completed trades logged
      </div>
    </div>
  );
}
