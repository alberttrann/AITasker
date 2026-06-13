import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@lib/query-client';
import { AuthProvider } from '@lib/auth-context';
import { SocketProvider } from '@lib/socket-provider';
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
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);