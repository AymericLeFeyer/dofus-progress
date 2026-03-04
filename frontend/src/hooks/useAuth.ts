import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { user, token, isLoading, isInitialized, login, register, logout } = useAuthStore();
  return { user, token, isAuthenticated: !!token && !!user, isLoading, isInitialized, login, register, logout };
}
