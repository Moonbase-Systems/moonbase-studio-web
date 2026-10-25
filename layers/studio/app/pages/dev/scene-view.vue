<script setup lang="ts">
import { SceneElementList } from '../../components/scene-element-list';
import { useStudioSessionStore } from '../../store/studio-session.store';

definePageMeta({
  title: 'nav.app',
});

const { t } = useI18n();
const store = useStudioSessionStore();

onMounted(() => {
  if (!store.isInitialized) {
    store.initialize();
  }
  if (!store.project) {
    store.createProject({ name: 'Preview Project' });
    return;
  }
  if (store.project.scenes.length === 0) {
    store.createScene('Scene 1');
  }
});
</script>

<template>
  <div class="bg-surface px-x-lg py-x-lg font-roboto text-on-surface min-h-screen">
    <div class="gap-x-lg mx-auto flex max-w-[40rem] flex-col">
      <section class="gap-md flex flex-col">
        <h2 class="text-body-md text-accent font-medium">{{ t('nav.app') }} — SceneView preview</h2>

        <SceneElementList />
      </section>
    </div>
  </div>
</template>
