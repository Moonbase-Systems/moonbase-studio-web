export interface SceneViewProps {
  name: string;
  open?: boolean;
  selected?: boolean;
  renaming?: boolean;
  renameDraft?: string;
  renameError?: string | null;
}

export { default as SceneView } from './SceneView.vue';
