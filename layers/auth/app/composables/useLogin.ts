import { isPasswordChangeRequiredResponse } from '../models/auth-api.domain';
import { mapMeToAuthenticatedUser, useAuthService } from '../services/auth.service';
import { useUserSessionStore } from '../store/user-session.store';
import type { LoginSchema } from '../schemas';

export const useLogin = () => {
  const authService = useAuthService();
  const sessionStore = useUserSessionStore();
  const localePath = useLocalePath();

  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const passwordChangeRequiredEmail = ref<string | null>(null);

  const login = async (payload: LoginSchema) => {
    isLoading.value = true;
    error.value = null;
    passwordChangeRequiredEmail.value = null;

    try {
      const response = await authService.login(payload);

      if (isPasswordChangeRequiredResponse(response)) {
        passwordChangeRequiredEmail.value = response.email;
        return { passwordChangeRequired: true as const, email: response.email };
      }

      const me = await authService.me();
      sessionStore.setUser(mapMeToAuthenticatedUser(me));

      return { passwordChangeRequired: false as const, redirectTo: localePath('/') };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    error,
    passwordChangeRequiredEmail,
    login,
  };
};
