import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import OverlayApp from './views/OverlayApp';
import './index.css';

// 윈도우 레이블로 어떤 UI를 렌더링할지 결정
// Tauri 윈도우 레이블은 URL 파라미터 방식으로 구분
const isOverlay = new URLSearchParams(window.location.search).get('window') === 'overlay';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isOverlay ? <OverlayApp /> : <App />}
  </React.StrictMode>
);
