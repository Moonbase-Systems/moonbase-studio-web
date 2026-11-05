import { STUDIO_ENTRY_COVER_KEY } from '~/constants/studio-entry-cover';

import { useStudioSessionStore } from '../../layers/studio/app/store/studio-session.store';

export default defineNuxtPlugin(() => {
  const router = useRouter();
  const cover = useState(STUDIO_ENTRY_COVER_KEY, () => false);

  router.beforeEach(async (to, from) => {
    if (to.path !== '/app' || from.path === '/app') {
      return;
    }

    const store = useStudioSessionStore();
    if (store.isInitialized && store.project != null) {
      return;
    }

    cover.value = true;
    await nextTick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });

  router.afterEach((to) => {
    if (to.path !== '/app') {
      cover.value = false;
    }
  });
});
