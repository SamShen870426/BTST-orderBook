import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { OrderBookRuntimeProvider } from './context/OrderBookRuntimeContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <OrderBookRuntimeProvider>
      <App />
    </OrderBookRuntimeProvider>
  </BrowserRouter>
);
