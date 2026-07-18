import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { apiClient } from '@lib/api-client';
import { useNotificationsStore } from '@/store/notifications.store';
import type { AuthTokens, ResendOtpDto, UserDto, VerifyOtpDto } from '@t/api.types';
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
    if (!data.access_token) {
      // Email verification is required. Return early and let the local onSuccess transition to OTP mode.
      return;
    }
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

const loginNoRedirect = useMutation({
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
  },
});

  // Logout 
  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      console.error('Logout API failed:', e);
    }
    store.logout();
    useNotificationsStore.getState().clear();
    queryClient.clear();
    navigate('/');
  };

  // Change Password
  const changePassword = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const { data } = await apiClient.put<{ message: string }>('/auth/me/password', payload);
      return data;
    },
    onSuccess: () => {
      // Side effect: All sessions invalidated. We should log out immediately.
      logout();
    }
  });

  // Switch active role 
  const switchRole = useMutation({
    mutationFn: async (payload: { activeRole: ActiveRole }) => {
      const { data } = await apiClient.put<{ access_token: string }>('/auth/switch-role', payload);
      return data;
    },
    onSuccess: async (data) => {
      store.setTokens(data.access_token, store.refreshToken ?? '');
      const { data: userRes } = await apiClient.get<UserDto>('/users/me');
      store.setUser(userRes);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      redirectByRole(userRes, navigate, true);
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

  const registerHandoff = useMutation({
    mutationFn: async (payload: { invite_token: string; email: string; fullName: string; password: string }) => {
      const { data } = await apiClient.post<{ access_token: string; refresh_token: string }>('/auth/register/handoff', payload);
      return data;
    },
    onSuccess: async (data) => {
      store.setTokens(data.access_token, data.refresh_token);
      const { data: user } = await apiClient.get<UserDto>('/users/me');
      store.setUser(user);
      redirectByRole(user, navigate);
    },
  });

  const forgotPassword = useMutation({
    mutationFn: async (payload: { email: string }) => {
      const { data } = await apiClient.post<{ message: string }>('/auth/forgot-password', payload);
      return data;
    },
  });

  const resetPassword = useMutation({
    mutationFn: async (payload: { token: string; newPassword: string }) => {
      const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', payload);
      return data;
    },
  });

  const verifyResetToken = (token?: string) => {
    return useQuery({
      queryKey: ['verify-reset-token', token],
      queryFn: async () => {
        if (!token) throw new Error("No token");
        const { data } = await apiClient.get(`/auth/verify-reset-token/${token}`);
        return data;
      },
      enabled: !!token,
      retry: false,
    });
  };

  const claimHandoff = useMutation({
    mutationFn: async (payload: { invite_token: string }) => {
      const { data } = await apiClient.post<{ access_token: string; user: UserDto }>('/auth/claim-handoff', payload);
      return data;
    },
    onSuccess: async (data) => {
      store.setTokens(data.access_token, '');
      store.setUser(data.user);
    },
  });

  const refreshUser = async () => {
    const { data: userRes } = await apiClient.get<UserDto>('/users/me');
    store.setUser(userRes);
    queryClient.setQueryData(['user', 'me'], userRes);
    queryClient.invalidateQueries({ queryKey: ['user'] });
  };

  const verifyOtp = useMutation({
    mutationFn: async (payload: VerifyOtpDto) => {
      const { data } = await apiClient.post<{ access_token: string; refresh_token?: string }>(
        '/auth/verify-otp',
        payload
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

  const resendOtp = useMutation({
    mutationFn: async (payload: ResendOtpDto) => {
      const { data } = await apiClient.post<{ message: string }>('/auth/resend-otp', payload);
      return data;
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
    registerHandoff,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyResetToken,
    refreshUser,
    verifyOtp,
    resendOtp,
    loginNoRedirect,
    claimHandoff,
  };
}

// Role-based redirect helper
function redirectByRole(
  user:     UserDto,
  navigate: ReturnType<typeof useNavigate>,
  isSwitchRole: boolean = false
) {
  const role = user.activeRole;
  let subtype = user.clientSubtype;
  
  // Fallback: if backend didn't return clientSubtype explicitly, infer it from the roles array
  if (!subtype && role === 'CLIENT') {
    if (user.roles?.includes('CLIENT_CEO')) subtype = 'CEO';
    else if (user.roles?.includes('CLIENT_TECH_TEAM')) subtype = 'TECH_TEAM';
  }

  let basePath = '/';
  if (role === 'CLIENT' && subtype === 'CEO')       { basePath = '/ceo'; }
  else if (role === 'CLIENT' && subtype === 'TECH_TEAM') { basePath = '/tech-team'; }
  else if (role === 'EXPERT')                       { basePath = '/expert'; }
  else if (role === 'ADMIN')                        { basePath = '/admin'; }

  // U7: remove stay in profile page after switch, go to dashboard after switch.
  // U6: fix back button routing bug -> use replace: true so we don't build history of wrong roles
  navigate(basePath, { replace: true });
}