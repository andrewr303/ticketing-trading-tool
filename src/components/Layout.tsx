import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sun,
  Calculator,
  MessageSquare,
  Shield,
  BarChart3,
  Radar,
  BookOpen,
  Menu,
  X,
  Home,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/open-bell', label: 'Open Bell', icon: Sun },
  { path: '/edge', label: 'Edge Calculator', icon: Calculator },
  { path: '/tradebot', label: 'TradeBot', icon: MessageSquare },
  { path: '/war-room', label: 'War Room', icon: Shield },
  { path: '/comps', label: 'Comps Engine', icon: BarChart3 },
  { path: '/radar', label: 'The Radar', icon: Radar },
  { path: '/playbook', label: 'The Playbook', icon: BookOpen },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-56 flex flex-col border-r transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <div>
            <div className="text-sm font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
              TICKET TRADING
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>AI Suite</div>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded text-sm transition-colors"
                style={{
                  background: isActive ? 'var(--bg-card-hover)' : 'transparent',
                  color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
                  borderLeft: isActive ? '2px solid var(--accent-green)' : '2px solid transparent',
                }}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
          v0.1 Beta
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="flex items-center justify-between px-4 py-3 border-b lg:px-6"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} style={{ color: 'var(--text-primary)' }} />
          </button>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Ticket Trading AI Suite
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Live</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
