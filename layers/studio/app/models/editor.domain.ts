import type { ChannelId, ElementId, GroupId, OverlaySoundId, SceneId } from './ids.domain';

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
  /** Project overlay sound open in the inspector. Not stored in the project file. */
  selectedOverlaySoundId: OverlaySoundId | null;
  /** Global microphone or system input open in the inspector. Not stored in the project file. */
  selectedGlobalChannelId: ChannelId | null;
  activeSceneId: SceneId | null;
  tool: EditorTool;
  viewport: EditorViewport;
  panels: EditorPanels;
};

export const createEmptyEditorState = (): EditorState => ({
  selectedElementIds: [],
  selectedGroupIds: [],
  selectedOverlaySoundId: null,
  selectedGlobalChannelId: null,
  activeSceneId: null,
  tool: 'select',
  viewport: { zoom: 1, panX: 0, panY: 0 },
  panels: {},
});
