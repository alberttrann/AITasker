import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { apiClient } from '@lib/api-client';
import type { AuthTokens, UserDto } from '@t/api.types';
import type { ActiveRole, ClientSubtype, UserRoleItem } from '@t/enums';

/**
 * useAuth — the single hook every component uses for auth actions.
 * Never import useAuthStore directly in feature components.
 */
export function useAuth() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const store        = useAuthStore();

// Register
 const register = useMutation({
  mutationFn: async (creds: { fullName: string; email: string; phone?: string; password: string; roles: UserRoleItem }) => {
    const { data } = await apiClient.post<AuthTokens & { user: UserDto }>(
      '/auth/register',
      creds
    );
    return data;
  }});
 
  // Login 
const login = useMutation({
  mutationFn: async (creds: { email: string; password: string }) => {
    const { data } = await apiClient.post<{ access_token: string; refresh_token?: string }>(
      '/auth/login',
      creds
    );
    return data;
  },
  onSuccess: async (data) => {
    store.setTokens(data.access_token, data.refresh_token ?? '');
    const { data: user } = await apiClient.get<UserDto>('/users/me');
    store.setUser(user);
    redirectByRole(user.activeRole, user.clientSubtype ?? undefined, navigate);
  },
});

  // Logout 
  const logout = () => {
    store.logout();
    queryClient.clear();
    navigate('/');
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
      redirectByRole(user.activeRole, user.clientSubtype ?? undefined, navigate);
    },
  });

  return {
    // State (read from store directly — reactive)
    user:            store.user,
    isAuthenticated: store.isAuthenticated,
    activeRole:      store.activeRole,
    clientSubtype:   store.clientSubtype,

    // Actions
    register,
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