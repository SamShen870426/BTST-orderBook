import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import OrderBook from './components/OrderBook';

const SocketHealthPage = lazy(() => import('./pages/SocketHealthPage'));

const socketHealthFallback = (
  <div
    style={{
      minHeight: '50vh',
      padding: 24,
      textAlign: 'center',
      color: '#8b949e',
      background: '#0d1117',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 14,
    }}
  >
    載入診斷面板…
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OrderBook />} />
      <Route
        path="/socket-health"
        element={
          <Suspense fallback={socketHealthFallback}>
            <SocketHealthPage />
          </Suspense>
        }
      />
    </Routes>
  );
}
