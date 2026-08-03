import { StatusCodes } from 'http-status-codes';

import { useUserSessionStore } from '#layers/auth/app/store/user-session.store';

/** 401 on these routes means invalid credentials / auth attempt — not an expired session. */
const UNAUTHORIZED_WITHOUT_SESSION_CLEAR = ['/auth/login', '/auth/force-change-password'] as const;

function isUnauthorizedFromCredentialAttempt(request: Request | string): boolean {
  const url = typeof request === 'string' ? request : request.url;
  return UNAUTHORIZED_WITHOUT_SESSION_CLEAR.some((segment) => url.includes(segment));
}

export default defineNuxtPlugin(() => {
  const {
    public: { apiBaseUrl },
  } = useRuntimeConfig();

  const api = $fetch.create({
    baseURL: apiBaseUrl,
    credentials: 'include',

    onRequest({ options }) {
      options.headers.set('Accept', 'application/json');
    },

    async onResponseError({ response, request }) {
      const status = response.status;

      if (status === StatusCodes.UNAUTHORIZED) {
        if (isUnauthorizedFromCredentialAttempt(request)) {
          throw createError({ statusCode: status, data: response._data });
        }

        if (import.meta.client) {
          const sessionStore = useUserSessionStore();
          sessionStore.logout();

          const localePath = useLocalePath();
          await navigateTo(localePath('/'));
        }

        // TODO(Error handling): Add a custom error for this.
        throw new Error('Session expired. Please login again.');
      }

      if (status >= StatusCodes.INTERNAL_SERVER_ERROR) {
        createError({ fatal: true, status, data: response._data });
      }

      throw createError({ status, data: response._data });
    },
  });

  return {
    provide: {
      api,
    },
  };
});
