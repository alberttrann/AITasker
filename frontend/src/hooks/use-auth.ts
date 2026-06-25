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
  mutationFn: async (creds: { fullName: string; email: string; phone?: string; taxCode?: string; password: string; roles: UserRoleItem }) => {
    const { data } = await apiClient.post<{ access_token: string; refresh_token?: string }>(
      '/auth/register',
      creds
    );
    return data;
  },
  onSuccess: async (data) => {
    store.setTokens(data.access_token, data.refresh_token ?? '');
    const { data: user } = await apiClient.get<UserDto>('/users/me');
    store.setUser(user);
    redirectByRole(user, navigate);
  },
});
 
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
    redirectByRole(user, navigate);
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
    mutationFn: async (payload: { activeRole: ActiveRole }) => {
      const { data } = await apiClient.put<{ access_token: string }>('/auth/switch-role', payload);
      return data;
    },
    onSuccess: async (data) => {
      store.setTokens(data.access_token, null);
      const { data: userRes } = await apiClient.get<UserDto>('/users/me');
      store.setUser(userRes);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      redirectByRole(userRes, navigate);
    },
  });

  // Add a second role
  const addRole = useMutation({
    mutationFn: async (payload: { newRole: UserRoleItem }) => {
      const { data } = await apiClient.post<{ success: boolean }>('/users/me/add-role', payload);
      return data;
    },
    onSuccess: async () => {
      const { data: user } = await apiClient.get<UserDto>('/users/me');
      store.setUser(user);
      queryClient.invalidateQueries({ queryKey: ['user'] });
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
    addRole,
  };
}

// Role-based redirect helper
function redirectByRole(
  user:     UserDto,
  navigate: ReturnType<typeof useNavigate>
) {
  const role = user.activeRole;
  let subtype = user.clientSubtype;
  
  // Fallback: if backend didn't return clientSubtype explicitly, infer it from the roles array
  if (!subtype && role === 'CLIENT') {
    if (user.roles?.includes('CLIENT_CEO')) subtype = 'CEO';
    else if (user.roles?.includes('CLIENT_TECH_TEAM')) subtype = 'TECH_TEAM';
  }

  if (role === 'CLIENT' && subtype === 'CEO')       { navigate('/ceo');       return; }
  if (role === 'CLIENT' && subtype === 'TECH_TEAM') { navigate('/tech-team'); return; }
  if (role === 'EXPERT') { navigate('/expert');      return; }
  if (role === 'ADMIN')  { navigate('/admin');       return; }
  navigate('/');
}