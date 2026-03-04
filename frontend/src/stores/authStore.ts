import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/auth.service';

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isInitialized: true });
      return;
    }
    try {
      const user = await authService.getMe();
      set({ user, token, isInitialized: true });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isInitialized: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { user, token } = await authService.login(email, password);
      localStorage.setItem('token', token);
      set({ user, token, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true });
    try {
      const { user, token } = await authService.register(email, username, password);
      localStorage.setItem('token', token);
      set({ user, token, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
