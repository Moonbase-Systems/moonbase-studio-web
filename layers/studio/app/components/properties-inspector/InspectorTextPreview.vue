<script setup lang="ts">
import { useElementInspectorUpdate } from '../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../models/ids.domain';
import type { TextElement } from '../../models/scene-elements';

const props = defineProps<{
  sceneId: SceneId;
  element: TextElement;
}>();

const { updateSettings } = useElementInspectorUpdate();

const focused = ref(false);
const draft = ref(props.element.settings.text);
const boxRef = ref<HTMLElement | null>(null);
const fittedSize = ref(32);

watch(
  () => props.element.settings.text,
  (value) => {
    if (!focused.value) {
      draft.value = value;
    }
  },
);

function onInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  draft.value = value;
  updateSettings(props.sceneId, props.element, { text: value });
}

function fitFontSize(maxWidth: number, maxHeight: number) {
  const settings = props.element.settings;
  const lines = (draft.value.length ? draft.value : ' ').split('\n');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context || maxWidth < 1 || maxHeight < 1) {
    return fittedSize.value;
  }

  const padding = Math.max(0, settings.padding);
  const availableWidth = Math.max(8, maxWidth - padding * 2);
  const availableHeight = Math.max(8, maxHeight - padding * 2);
  const lineHeight = settings.lineHeight > 0 ? settings.lineHeight : 1;
  const family = settings.fontFamily.includes(' ') ? `"${settings.fontFamily}"` : settings.fontFamily;

  const fits = (size: number) => {
    context.font = `${settings.fontStyle} ${settings.fontWeight} ${size}px ${family}`;
    let width = 0;
    for (const line of lines) {
      const content = line.length ? line : ' ';
      const spacing = Math.max(content.length - 1, 0) * settings.letterSpacing;
      width = Math.max(width, context.measureText(content).width + spacing);
    }
    const height = lines.length * size * lineHeight;
    const stroke = settings.strokeWidth > 0 ? settings.strokeWidth * 2 : 0;
    return width + stroke <= availableWidth && height + stroke <= availableHeight;
  };

  let low = 1;
  let high = availableHeight;
  if (!fits(low)) {
    return low;
  }
  for (let step = 0; step < 14; step += 1) {
    const mid = (low + high) / 2;
    if (fits(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}

function updateFit() {
  const box = boxRef.value;
  if (!box) {
    return;
  }
  const layerWidth = Math.max(1, props.element.transform.width);
  const layerHeight = Math.max(1, props.element.transform.height);
  const scale = Math.min(box.clientWidth / layerWidth, box.clientHeight / layerHeight);
  fittedSize.value = fitFontSize(layerWidth * scale, layerHeight * scale);
}

watch(
  () =>
    [
      draft.value,
      props.element.settings.fontFamily,
      props.element.settings.fontWeight,
      props.element.settings.fontStyle,
      props.element.settings.letterSpacing,
      props.element.settings.lineHeight,
      props.element.settings.padding,
      props.element.settings.strokeWidth,
      props.element.transform.width,
      props.element.transform.height,
    ] as const,
  () => nextTick(updateFit),
);

onMounted(() => {
  updateFit();
  const observer = new ResizeObserver(() => updateFit());
  if (boxRef.value) {
    observer.observe(boxRef.value);
  }
  onBeforeUnmount(() => observer.disconnect());
});

/** The user's text background, painted on its own layer so its opacity does not fade the text. */
const backgroundStyle = computed(() => {
  const settings = props.element.settings;
  if (!settings.backgroundColor || settings.backgroundOpacity <= 0) {
    return null;
  }
  return {
    backgroundColor: settings.backgroundColor,
    opacity: String(Math.min(1, settings.backgroundOpacity)),
  };
});

const previewStyle = computed(() => {
  const settings = props.element.settings;
  const decorations = [settings.underline ? 'underline' : '', settings.strikethrough ? 'line-through' : ''].filter(
    Boolean,
  );
  return {
    fontFamily: settings.fontFamily,
    fontSize: `${fittedSize.value}px`,
    fontWeight: String(settings.fontWeight),
    fontStyle: settings.fontStyle,
    color: settings.color,
    letterSpacing: `${settings.letterSpacing}px`,
    lineHeight: String(settings.lineHeight > 0 ? settings.lineHeight : 1),
    textAlign: 'center' as const,
    textDecoration: decorations.join(' ') || 'none',
    padding: `${settings.padding}px`,
    whiteSpace: 'pre' as const,
    WebkitTextStroke:
      settings.strokeWidth > 0 ? `${settings.strokeWidth}px ${settings.strokeColor ?? 'transparent'}` : '0',
  };
});
</script>

<template>
  <div
    ref="boxRef"
    class="flex h-full min-h-0 w-full items-center justify-center overflow-hidden"
  >
    <div class="relative flex max-h-full max-w-full overflow-hidden">
      <span
        v-if="backgroundStyle"
        class="pointer-events-none absolute inset-0"
        :style="backgroundStyle"
        aria-hidden="true"
      />
      <textarea
        :value="draft"
        wrap="off"
        rows="1"
        class="relative max-h-full max-w-full resize-none overflow-hidden border-0 bg-transparent text-center outline-none [field-sizing:content]"
        :style="previewStyle"
        @focus="focused = true"
        @blur="focused = false"
        @input="onInput"
      />
    </div>
  </div>
</template>
