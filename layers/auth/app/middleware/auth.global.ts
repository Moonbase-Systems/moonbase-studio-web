import { useAuthRedirects } from '../composables/useAuthRedirects';
import { useUserSessionStore } from '../store/user-session.store';

export default defineNuxtRouteMiddleware((to) => {
  const requiresAuth = to.meta.auth === true || (to.meta.requiredPermissions?.length ?? 0) > 0;

  if (!requiresAuth || to.meta.auth === false) {
    return;
  }

  const sessionStore = useUserSessionStore();
  const { hasRequiredPermissions, redirectUnauthenticatedToHome } = useAuthRedirects();

  if (!sessionStore.isAuthenticated) {
    return redirectUnauthenticatedToHome();
  }

  const requiredPermissions = to.meta.requiredPermissions;
  if (!hasRequiredPermissions(requiredPermissions)) {
    return redirectUnauthenticatedToHome();
  }
});
