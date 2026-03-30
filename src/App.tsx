import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import OpenBell from './pages/OpenBell';
import EdgeCalculator from './pages/EdgeCalculator';
import TradeBot from './pages/TradeBot';
import WarRoom from './pages/WarRoom';
import CompsEngine from './pages/CompsEngine';
import RadarPage from './pages/Radar';
import Playbook from './pages/Playbook';
import { Loader2, AlertCircle } from 'lucide-react';

function AppRoutes() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-green)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div
          className="max-w-sm rounded-lg border p-6 text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <AlertCircle size={32} className="mx-auto mb-4" style={{ color: 'var(--accent-red)' }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Connection Error
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--accent-green)', color: '#000' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/open-bell" element={<OpenBell />} />
        <Route path="/edge" element={<EdgeCalculator />} />
        <Route path="/tradebot" element={<TradeBot />} />
        <Route path="/war-room" element={<WarRoom />} />
        <Route path="/comps" element={<CompsEngine />} />
        <Route path="/radar" element={<RadarPage />} />
        <Route path="/playbook" element={<Playbook />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
