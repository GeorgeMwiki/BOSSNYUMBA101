import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, Toaster } from '@bossnyumba/design-system';
import App from './App';
import { LocaleProvider } from './contexts/LocaleProvider';
import './index.css';

// Shared defaults across all BOSSNYUMBA apps. staleTime avoids redundant
// refetches during rapid navigation; gcTime keeps inactive results in
// memory long enough for back/forward nav without exploding the cache.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          {/* Opt into v7 behaviour early so console.warn stays clean and
              the upgrade to react-router@7 is a no-op semantically.
              `BrowserRouter` only accepts the two non-data-router futures;
              the rest (v7_fetcherPersist, v7_normalizeFormMethod, etc.)
              are only valid on createBrowserRouter. Silences Wave-20
              Agent N's deprecation warnings. */}
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <App />
            <Toaster />
          </BrowserRouter>
        </QueryClientProvider>
      </LocaleProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
