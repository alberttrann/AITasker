import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserDto } from '@t/api.types';
import type { ActiveRole, ClientSubtype } from '@t/enums';

/**
 * Auth store — persists to localStorage so the user stays logged in across page refreshes.
 *
 * TanStack Query owns the full user object from GET /users/me.
 * This store owns the tokens and the minimum identity needed to make authenticated requests before the query loads.
 */

interface AuthState {
  accessToken:  string | null;
  refreshToken: string | null;
  user:         UserDto | null;

  // Derived helpers
  isAuthenticated: boolean;
  activeRole:      ActiveRole | null;
  clientSubtype:   ClientSubtype | null;

  // Actions
  setTokens:   (access: string, refresh: string) => void;
  setUser:     (user: UserDto) => void;
  switchRole:  (role: ActiveRole, subtype?: ClientSubtype) => void;
  logout:      () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken:     null,
      refreshToken:    null,
      user:            null,
      isAuthenticated: false,
      activeRole:      null,
      clientSubtype:   null,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
          activeRole:    user.activeRole,
          clientSubtype: user.clientSubtype ?? null,
        }),

      switchRole: (role, subtype) =>
        set((s) => ({
          activeRole:    role,
          clientSubtype: subtype ?? null,
          user:          s.user ? { ...s.user, activeRole: role, clientSubtype: subtype ?? null } : s.user,
        })),

      logout: () =>
        set({
          accessToken:     null,
          refreshToken:    null,
          user:            null,
          isAuthenticated: false,
          activeRole:      null,
          clientSubtype:   null,
        }),
    }),
    {
      name: 'aitasker-auth',
      partialize: (s) => ({
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
        user:            s.user,             
        isAuthenticated: s.isAuthenticated,  
        activeRole:      s.activeRole,       
        clientSubtype:   s.clientSubtype,    
      }),
    }
  )
);