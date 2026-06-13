import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuthStore } from '@store/auth.store';
import { apiClient } from '@lib/api-client';
import type { UserDto } from '@t/api.types';

interface AuthContextValue {
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ isLoading: true });

/**
 * AuthProvider — wraps the whole app.
 *
 * On every page load it checks for a persisted access token in Zustand
 * (localStorage), then calls GET /users/me to re-hydrate the full user
 * object. If the token is invalid or expired the interceptor in api-client.ts
 * attempts a refresh; if that also fails the user is logged out.
 *
 * Components that need the user read from useAuthStore() directly — they do
 * NOT read from this context. The context only exposes `isLoading` so the
 * app can show a spinner before the identity check completes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const { accessToken, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    apiClient
      .get<UserDto>('/users/me')
      .then(({ data }) => setUser(data))
      .catch(() => logout())
      .finally(() => setIsLoading(false));
  }, []);   // runs once on mount

  return (
    <AuthContext.Provider value={{ isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}