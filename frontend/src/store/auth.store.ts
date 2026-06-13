import { create } from 'zustand';
import { UserRole } from '@/types/enums';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  activeRole: UserRole;
  login: (email: string) => void;
  logout: () => void;
  setRole: (role: UserRole) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  activeRole: UserRole.CLIENT,
  login: (email: string) => set({ 
    isAuthenticated: true, 
    user: { id: '1', email, name: 'Demo User' }
  }),
  logout: () => set({ isAuthenticated: false, user: null }),
  setRole: (role: UserRole) => set({ activeRole: role })
}));
