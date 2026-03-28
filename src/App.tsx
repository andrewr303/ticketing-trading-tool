import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import OpenBell from './pages/OpenBell';
import EdgeCalculator from './pages/EdgeCalculator';
import TradeBot from './pages/TradeBot';
import WarRoom from './pages/WarRoom';
import CompsEngine from './pages/CompsEngine';
import RadarPage from './pages/Radar';
import Playbook from './pages/Playbook';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
