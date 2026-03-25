import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useStore } from './store/useStore';

// Expose store for debugging and subagent testing
if (import.meta.env.MODE === 'development') {
  (window as any).store = useStore;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
