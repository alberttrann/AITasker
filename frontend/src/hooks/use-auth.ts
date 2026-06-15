import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { apiClient } from '@lib/api-client';
import type { AuthTokens, UserDto } from '@t/api.types';
import type { ActiveRole, ClientSubtype } from '@t/enums';

/**
 * useAuth — the single hook every component uses for auth actions.
 * Never import useAuthStore directly in feature components.
 */
export function useAuth() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const store        = useAuthStore();

  // Login 
  const login = useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      const { data } = await apiClient.post<AuthTokens & { user: UserDto }>(
        '/auth/login',
        creds
      );
      return data;
    },
    onSuccess: (data) => {
      store.setTokens(data.access_token, data.refresh_token);
      store.setUser(data.user);
      redirectByRole(data.user.active_role, data.user.client_subtype ?? undefined, navigate);
    },
  });

  // Logout 
  const logout = () => {
    store.logout();
    queryClient.clear();
    navigate('/login');
  };

  // Switch active role 
  const switchRole = useMutation({
    mutationFn: async (payload: { role: ActiveRole; subtype?: ClientSubtype }) => {
      const { data } = await apiClient.put<UserDto>('/auth/switch-role', payload);
      return data;
    },
    onSuccess: (user) => {
      store.setUser(user);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      redirectByRole(user.active_role, user.client_subtype ?? undefined, navigate);
    },
  });

  return {
    // State (read from store directly — reactive)
    user:            store.user,
    isAuthenticated: store.isAuthenticated,
    activeRole:      store.activeRole,
    clientSubtype:   store.clientSubtype,

    // Actions
    login,
    logout,
    switchRole,
  };
}

// Role-based redirect helper
function redirectByRole(
  role:     ActiveRole,
  subtype:  ClientSubtype | undefined,
  navigate: ReturnType<typeof useNavigate>
) {
  if (role === 'ADMIN')  { navigate('/admin');       return; }
  if (role === 'EXPERT') { navigate('/expert');      return; }
  if (subtype === 'CEO')       { navigate('/ceo');       return; }
  if (subtype === 'TECH_TEAM') { navigate('/tech-team'); return; }
  navigate('/');
}