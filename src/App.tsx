import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
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
import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const { user, loading } = useAuth();

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
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
