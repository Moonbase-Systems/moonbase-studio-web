# Data Models — MoonBase Studio

All models are TypeScript `type`s in `layers/studio/app/models/` and validated by Zod in `layers/studio/app/schemas/`. Domain code must remain free of Vue/Pinia/render/runtime objects.

**Persistence:** fields marked _session_ are not written to `ProjectFile`. Everything else is _persistent_ unless noted.

---

## Identifiers

| Type                                                                                                                                            | Shape                               | Notes                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| `ProjectId`, `SceneId`, `ElementId`, `GroupId`, `SourceId`, `AssetId`, `TransitionId`, `ChannelId`, `EffectId`, `AnimationId`, `HistoryEntryId` | non-empty `string` (UUID preferred) | Opaque; never reuse across kinds in one project |

---

## Project

**Purpose:** Root aggregate for one studio composition workspace.

| Field         | Type              | Required | Notes                                               |
| ------------- | ----------------- | -------- | --------------------------------------------------- |
| `id`          | `ProjectId`       | yes      |                                                     |
| `name`        | `string`          | yes      | 1–128 chars                                         |
| `type`        | `ProjectType`     | yes      | `'podcast' \| 'gaming' \| 'broadcast' \| 'general'` |
| `settings`    | `ProjectSettings` | yes      |                                                     |
| `scenes`      | `Scene[]`         | yes      | at least one recommended                            |
| `sources`     | `Source[]`        | yes      | may be empty                                        |
| `assets`      | `Asset[]`         | yes      | may be empty                                        |
| `audioMixer`  | `AudioMixer`      | yes      |                                                     |
| `transitions` | `Transition[]`    | yes      | library of definitions                              |
| `history`     | `ProjectHistory`  | yes      | _session_ — empty after load                        |
| `metadata`    | `ProjectMetadata` | yes      | createdAt, updatedAt, schema hints                  |

**Relations:** owns scenes, sources, assets, mixer, transitions, history.

**Validation:** unique IDs within each collection; all `sourceId` / `assetId` references resolve inside the project.

---

## ProjectSettings

| Field         | Type                    | Required | Notes                                          |
| ------------- | ----------------------- | -------- | ---------------------------------------------- |
| `video`       | `ProjectVideoSettings`  | yes      | resolution, fps, colorSpace                    |
| `audio`       | `ProjectAudioSettings`  | yes      | sampleRate, channels                           |
| `output`      | `ProjectOutputSettings` | yes      | intended output profile (not stream transport) |
| `preferences` | `ProjectPreferences`    | yes      | editor defaults for this project               |

Do not mix with editor state on `studioSession` (selection, open panels).

---

## ProjectMetadata

| Field         | Type         | Required |
| ------------- | ------------ | -------- |
| `createdAt`   | ISO `string` | yes      |
| `updatedAt`   | ISO `string` | yes      |
| `description` | `string`     | no       |

---

## Scene

| Field        | Type                                                                  | Required | Notes                                |
| ------------ | --------------------------------------------------------------------- | -------- | ------------------------------------ |
| `id`         | `SceneId`                                                             | yes      |                                      |
| `name`       | `string`                                                              | yes      |                                      |
| `settings`   | `SceneSettings`                                                       | yes      | incl. optional `defaultTransitionId` |
| `background` | `SceneBackground`                                                     | yes      | color / image asset ref / none       |
| `elements`   | `SceneElement[]`                                                      | yes      | includes overlays                    |
| `groups`     | `SceneGroup[]`                                                        | yes      | v1: non-nested                       |
| `animations` | `{ onEnter: SceneAnimation \| null; onExit: SceneAnimation \| null }` | yes      |                                      |
| `metadata`   | `Record<string, string> \| SceneMetadata`                             | no       |                                      |

**Independent of Pixi/Three.** Renderer maps this model outward.

---

## SceneSettings

| Field                 | Type                   | Required | Notes                                                                       |
| --------------------- | ---------------------- | -------- | --------------------------------------------------------------------------- |
| `defaultTransitionId` | `TransitionId \| null` | yes      | project transition library                                                  |
| `active`              | `boolean`              | no       | optional hint; the editor tracks the active scene on `studioSession.editor` |

---

## SceneBackground

Discriminated union, e.g.:

- `{ kind: 'none' }`
- `{ kind: 'color'; color: string }`
- `{ kind: 'image', assetId: AssetId }`

---

## SceneElement

Discriminated union on `type`. Shared fields:

| Field           | Type               | Required | Notes                           |
| --------------- | ------------------ | -------- | ------------------------------- |
| `id`            | `ElementId`        | yes      |                                 |
| `type`          | `SceneElementType` | yes      |                                 |
| `parentGroupId` | `GroupId \| null`  | yes      | `null` = scene root             |
| `transform`     | `Transform2D`      | yes      | position, size, scale, rotation |
| `appearance`    | `Appearance`       | yes      | opacity, blendMode, …           |
| `effects`       | `ElementEffect[]`  | yes      | extensible; may be empty        |
| `visibility`    | `boolean`          | yes      |                                 |
| `zIndex`        | `number`           | yes      | order among siblings / root     |

### Source-backed variants

`type`: `'camera' | 'screen' | 'image' | 'video' | 'text' | 'shape' | 'browser' | 'audioVisual'` (extensible)

| Field      | Type       | Required                                     |
| ---------- | ---------- | -------------------------------------------- |
| `sourceId` | `SourceId` | yes — must match a Source of compatible type |

### Overlay variant (`type: 'overlay'`)

| Field         | Type               | Required | Notes                                            |
| ------------- | ------------------ | -------- | ------------------------------------------------ |
| `overlayKind` | `string`           | yes      | e.g. `lower-third`, `alert`, `counter`, `custom` |
| `content`     | `OverlayContent`   | yes      | kind-specific payload                            |
| `animations`  | `SceneAnimation[]` | yes      | asset-based media clips                          |

No `sourceId` on overlay.

**Grouping:** overlays participate in `parentGroupId` / `SceneGroup.elementIds` like any element.

---

## Transform2D

| Field              | Type     | Required  |
| ------------------ | -------- | --------- | ------- |
| `x`, `y`           | `number` | yes       |
| `width`, `height`  | `number` | yes (> 0) |
| `scaleX`, `scaleY` | `number` | yes       |
| `rotation`         | `number` | yes       | degrees |

---

## Appearance

| Field       | Type     | Required |
| ----------- | -------- | -------- | ---------------- |
| `opacity`   | `number` | yes      | 0–1              |
| `blendMode` | `string` | no       | default `normal` |

---

## SceneGroup

| Field        | Type                  | Required | Notes                           |
| ------------ | --------------------- | -------- | ------------------------------- |
| `id`         | `GroupId`             | yes      |                                 |
| `name`       | `string`              | yes      |                                 |
| `type`       | `'default' \| string` | yes      | reserved for future group kinds |
| `elementIds` | `ElementId[]`         | yes      | ordered members                 |
| `transform`  | `Transform2D`         | yes      | group transform                 |
| `appearance` | `Appearance`          | yes      |                                 |

**Invariant:** every `elementId` in `elementIds` must exist on the scene and have `parentGroupId === group.id`. Every element with that `parentGroupId` must appear in `elementIds` exactly once.

**v1:** groups do not nest.

---

## Source

Discriminated union on `type`. Shared:

| Field      | Type             | Required |
| ---------- | ---------------- | -------- |
| `id`       | `SourceId`       | yes      |
| `name`     | `string`         | yes      |
| `type`     | `SourceType`     | yes      |
| `metadata` | `SourceMetadata` | no       |

### BrowserSource (`type: 'browser'`)

| Field             | Type                     | Required | Notes           |
| ----------------- | ------------------------ | -------- | --------------- |
| `url`             | `string`                 | yes      | absolute URL    |
| `width`           | `number`                 | yes      | viewport width  |
| `height`          | `number`                 | yes      | viewport height |
| `refreshSettings` | `BrowserRefreshSettings` | yes      |                 |

```ts
type BrowserRefreshSettings = {
  intervalMs: number | null;
  refreshOnActivate: boolean;
  bypassCache: boolean;
};
```

Not an Asset — live URL, not a stored file.

### Other source kinds (extensible)

| Type     | Key settings                 |
| -------- | ---------------------------- |
| `camera` | `deviceId?`, constraints     |
| `screen` | `displayId?` / capture hints |
| `image`  | `assetId`                    |
| `video`  | `assetId`, loop?             |
| `text`   | text content, typography     |
| `shape`  | shapeKind, fill, stroke      |
| `audio`  | `assetId` or device ref      |

---

## Asset

**Purpose:** File resource metadata + durable storage location.

| Field          | Type                                                     | Required | Notes                                |
| -------------- | -------------------------------------------------------- | -------- | ------------------------------------ |
| `id`           | `AssetId`                                                | yes      |                                      |
| `name`         | `string`                                                 | yes      |                                      |
| `type`         | `'image' \| 'video' \| 'audio' \| 'gif' \| 'other'`      | yes      |                                      |
| `location`     | `AssetLocation`                                          | yes      | storage key / URI — not OS-only path |
| `availability` | `'available' \| 'missing' \| 'pending'`                  | yes      |                                      |
| `metadata`     | `{ mimeType?, byteSize?, width?, height?, durationMs? }` | no       |                                      |

```ts
type AssetLocation = { kind: 'storageKey'; key: string } | { kind: 'remoteUrl'; url: string };
```

---

## SceneAnimation (v1)

Media clip for scene enter/exit or overlay animations — **not** keyframe tweens.

| Field        | Type                                                      | Required | Notes              |
| ------------ | --------------------------------------------------------- | -------- | ------------------ |
| `id`         | `AnimationId`                                             | yes      |                    |
| `assetId`    | `AssetId`                                                 | yes      | gif or video asset |
| `mediaKind`  | `'gif' \| 'video'`                                        | yes      | must match asset   |
| `durationMs` | `number`                                                  | no       | optional override  |
| `settings`   | `{ loop?: boolean; playbackRate?: number; fit?: string }` | yes      |                    |

---

## Transition

Inter-scene effect definition (project library).

| Field        | Type                                             | Required |
| ------------ | ------------------------------------------------ | -------- |
| `id`         | `TransitionId`                                   | yes      |
| `type`       | `'cut' \| 'fade' \| 'slide' \| 'zoom' \| string` | yes      |
| `durationMs` | `number`                                         | yes      |
| `easing`     | `string`                                         | yes      |
| `settings`   | type-specific object                             | yes      |

Distinct from `SceneAnimation`. Assignment: `Scene.settings.defaultTransitionId`; optional future `TransitionEdge` (`fromSceneId`, `toSceneId`, `transitionId`).

---

## AudioMixer

| Field      | Type             | Required |
| ---------- | ---------------- | -------- |
| `master`   | `AudioMaster`    | yes      |
| `channels` | `AudioChannel[]` | yes      |

### AudioMaster

| Field    | Type      | Required |
| -------- | --------- | -------- | --- |
| `volume` | `number`  | yes      | 0–1 |
| `muted`  | `boolean` | yes      |

### AudioChannel

| Field      | Type               | Required |
| ---------- | ------------------ | -------- | ---- |
| `id`       | `ChannelId`        | yes      |
| `name`     | `string`           | yes      |
| `sourceId` | `SourceId \| null` | yes      |
| `volume`   | `number`           | yes      |
| `muted`    | `boolean`          | yes      |
| `solo`     | `boolean`          | yes      |
| `pan`      | `number`           | yes      | -1…1 |
| `filters`  | `AudioFilter[]`    | yes      |
| `effects`  | `AudioEffect[]`    | yes      |

### AudioFilter / AudioEffect

Shared envelope + typed params:

| Field        | Type                 | Required |
| ------------ | -------------------- | -------- |
| `id`         | `EffectId`           | yes      |
| `type`       | string discriminant  | yes      |
| `enabled`    | `boolean`            | yes      |
| `parameters` | type-specific object | yes      |

Configuration only — no Web Audio nodes in the model.

---

## ProjectHistory (_session_)

| Field    | Type             | Required |
| -------- | ---------------- | -------- | --------------- |
| `past`   | `HistoryEntry[]` | yes      |
| `future` | `HistoryEntry[]` | yes      |
| `limit`  | `number`         | yes      | max stack depth |

### HistoryEntry

| Field       | Type                               | Required | Notes                   |
| ----------- | ---------------------------------- | -------- | ----------------------- |
| `id`        | `HistoryEntryId`                   | yes      |                         |
| `label`     | `string`                           | yes      | i18n key or short label |
| `timestamp` | ISO `string`                       | yes      |                         |
| `patch`     | serializable inverse/forward patch | yes      | no UI/runtime refs      |

---

## ProjectFile (persistable)

```ts
type ProjectFile = {
  formatVersion: 2;
  project: Omit<Project, 'history'>;
};
```

On load: migrate `formatVersion: 1` to v2, validate with Zod, attach empty `history: { past: [], future: [], limit }`. Unknown versions fail validation.

---

## Architectural notes

1. **Source vs element:** Source = reusable input config; Element = placement in a scene.
2. **Asset vs source:** Asset = file; Source may reference an asset or describe a live device/URL (browser).
3. **Overlay vs browser:** Overlay is an element variant with inline content; browser is source + element with `sourceId`.
4. **Animations vs transitions:** SceneAnimation = GIF/video asset; Transition = inter-scene effect definition.
