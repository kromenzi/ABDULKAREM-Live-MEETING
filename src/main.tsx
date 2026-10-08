import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://abdulkarem-live-meeting.onrender.com';
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    input = `${apiBaseUrl}${input}`;
  }
  return nativeFetch(input, init);
};

createRoot(document.getElementById('root')!).render(<App />);
