import { Link } from 'react-router-dom';
import {
  Sun,
  Calculator,
  MessageSquare,
  Shield,
  BarChart3,
  Radar,
  BookOpen,
} from 'lucide-react';

const TOOLS = [
  {
    path: '/open-bell',
    name: 'Deep Research',
    description: 'AI-powered nationwide event discovery with multi-dimensional scoring, deep signal analysis, and source citations. Includes quick Denver morning brief.',
    icon: Sun,
    color: '#10b981',
  },
  {
    path: '/edge',
    name: 'Edge Calculator',
    description: 'Search for events, auto-populate details, and get full profitability analysis with ROI projections, comps, and dynamic venue-based section tiers.',
    icon: Calculator,
    color: '#3b82f6',
  },
  {
    path: '/tradebot',
    name: 'TradeBot',
    description: 'Slack-style trading assistant. Ask natural language questions about pricing, comps, and buy/sell guidance.',
    icon: MessageSquare,
    color: '#8b5cf6',
  },
  {
    path: '/war-room',
    name: 'War Room',
    description: 'Inventory risk heatmap. See your entire portfolio at a glance — tile size is position value, color is risk level.',
    icon: Shield,
    color: '#f59e0b',
  },
  {
    path: '/comps',
    name: 'Comps Engine',
    description: 'Find comparable historical events and their resale performance. The ticket trading equivalent of pulling comps.',
    icon: BarChart3,
    color: '#ec4899',
  },
  {
    path: '/radar',
    name: 'The Radar',
    description: 'Demand signal tracker. Spot demand shifts before prices move — social buzz, streaming data, search trends.',
    icon: Radar,
    color: '#06b6d4',
  },
  {
    path: '/playbook',
    name: 'The Playbook',
    description: 'Trade performance journal with AI coaching. Log trades, see P&L patterns, get honest analysis of what\'s working.',
    icon: BookOpen,
    color: '#f97316',
  },
];

export default function Landing() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Trading Tools
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          7 AI-powered tools for live event ticket trading. Denver-focused, built for the morning session.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.path}
              to={tool.path}
              className="group block rounded-lg border p-5 transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = tool.color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${tool.color}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded flex items-center justify-center"
                  style={{ background: `${tool.color}20` }}
                >
                  <Icon size={18} style={{ color: tool.color }} />
                </div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {tool.name}
                </h3>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                {tool.description}
              </p>
              <div
                className="text-xs font-medium tracking-wider uppercase"
                style={{ color: tool.color }}
              >
                Launch →
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
