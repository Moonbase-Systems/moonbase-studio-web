import { STORE_KEYS } from '#layers/core/app/constants/store-keys';

import type { AuthenticatedUser } from '../models/user.domain';

export const useUserSessionStore = defineStore(
  STORE_KEYS.USER_SESSION,
  () => {
    const user = ref<AuthenticatedUser | null>(null);

    const isAuthenticated = computed(() => user.value != null);

    const setUser = (nextUser: AuthenticatedUser | null) => {
      user.value = nextUser;
    };

    const logout = () => {
      user.value = null;
    };

    return {
      user,
      isAuthenticated,
      setUser,
      logout,
    };
  },
  {
    persist: true,
  },
);
