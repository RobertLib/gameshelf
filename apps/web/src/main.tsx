import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { AuthProvider } from './features/auth/auth-context';
import { createQueryClient } from './lib/query-client';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('The #root element is missing from index.html.');
}

const queryClient = createQueryClient();

createRoot(container).render(
  <StrictMode>
    {/* Outermost, so that it also catches errors from the providers below it. */}
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* AuthProvider sits inside QueryClientProvider - it keeps the session
            in the TanStack Query cache, not in its own state. */}
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
