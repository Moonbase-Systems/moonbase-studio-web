import type { RegisterSchema } from '../schemas';
import { mapMeToAuthenticatedUser, useAuthService } from '../services/auth.service';
import { useUserSessionStore } from '../store/user-session.store';

export const useRegister = () => {
  const authService = useAuthService();
  const sessionStore = useUserSessionStore();
  const localePath = useLocalePath();

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const register = async (payload: RegisterSchema) => {
    isLoading.value = true;
    error.value = null;

    try {
      await authService.register(payload);
      await authService.login({ email: payload.email, password: payload.password });
      const me = await authService.me();
      sessionStore.setUser(mapMeToAuthenticatedUser(me));

      return { redirectTo: localePath('/') };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Registration failed';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    error,
    register,
  };
};
