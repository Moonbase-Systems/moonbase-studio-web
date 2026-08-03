import { useAuthRedirects } from '../composables/useAuthRedirects';

export default defineNuxtRouteMiddleware((to) => {
  if (to.meta.guestOnly !== true) {
    return;
  }

  const { redirectGuestToHome } = useAuthRedirects();
  return redirectGuestToHome();
});
