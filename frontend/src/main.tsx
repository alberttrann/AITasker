import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@lib/query-client';
import App from './App';

import './index.css';

/**
 * Provider order :
 *   QueryClientProvider  — hooks used inside AuthProvider
 *   BrowserRouter        — needed by AuthProvider (uses useNavigate)
 *   AuthProvider         — validates token on load before anything renders
 *   SocketProvider       — connects Socket.io after auth is confirmed
 *   App                  — routes and screens
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
