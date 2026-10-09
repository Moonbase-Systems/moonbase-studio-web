import type { ElementId, GroupId, SceneId } from './ids.domain';

/** Ephemeral UI state — not part of ProjectFile. */
export type EditorTool = 'select' | 'pan' | (string & {});

export type EditorViewport = {
  zoom: number;
  panX: number;
  panY: number;
};

export type EditorPanels = {
  sourcesOpen?: boolean;
  mixerOpen?: boolean;
  propertiesOpen?: boolean;
};

export type EditorState = {
  selectedElementIds: ElementId[];
  selectedGroupIds: GroupId[];
  activeSceneId: SceneId | null;
  tool: EditorTool;
  viewport: EditorViewport;
  panels: EditorPanels;
};

export const createEmptyEditorState = (): EditorState => ({
  selectedElementIds: [],
  selectedGroupIds: [],
  activeSceneId: null,
  tool: 'select',
  viewport: { zoom: 1, panX: 0, panY: 0 },
  panels: {},
});
