import type { Permission } from '../models/user.domain';
import { useUserSessionStore } from '../store/user-session.store';

export const useAuthRedirects = () => {
  const sessionStore = useUserSessionStore();
  const localePath = useLocalePath();

  const redirectUnauthenticatedToHome = async () => {
    await navigateTo(localePath('/'));
  };

  const redirectGuestToHome = async () => {
    if (sessionStore.isAuthenticated) {
      await navigateTo(localePath('/'));
    }
  };

  const hasRequiredPermissions = (requiredPermissions?: Permission[]) => {
    if (requiredPermissions == null || requiredPermissions.length === 0) {
      return true;
    }

    const userPermissions = sessionStore.user?.permissions ?? [];
    return requiredPermissions.every((permission) => userPermissions.includes(permission));
  };

  return {
    redirectUnauthenticatedToHome,
    redirectGuestToHome,
    hasRequiredPermissions,
  };
};
