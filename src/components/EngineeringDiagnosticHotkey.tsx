import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * 工程師診斷用：不顯示 UI 入口。Ctrl+Alt+D 在 `/` 與 `/socket-health` 間做客戶端切換（不整頁重載）。
 */
export function EngineeringDiagnosticHotkey() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.altKey) return;
      if (e.key !== 'd' && e.key !== 'D') return;
      e.preventDefault();
      const p = pathnameRef.current;
      navigate(p === '/socket-health' ? '/' : '/socket-health');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [navigate]);

  return null;
}
