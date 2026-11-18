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

| Field         | Type                    | Required | Notes                                       |
| ------------- | ----------------------- | -------- | ------------------------------------------- |
| `video`       | `ProjectVideoSettings`  | yes      | resolution, fps, colorSpace                 |
| `audio`       | `ProjectAudioSettings`  | yes      | sampleRate, channels                        |
| `output`      | `ProjectOutputSettings` | yes      | output profile; not an open RTMP connection |
| `preferences` | `ProjectPreferences`    | yes      | editor defaults for this project            |

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
| `locked`        | `boolean`          | yes      |                                 |

Layer order is the index in `scene.elements`. Index 0 is the back. There is no `zIndex` field.

### Source-backed variants

`type`: `'camera' | 'screen' | 'image' | 'video' | 'text' | 'shape' | 'browser' | 'audioVisual'` (extensible)

| Field      | Type       | Required                                                                            |
| ---------- | ---------- | ----------------------------------------------------------------------------------- |
| `sourceId` | `SourceId` | yes — must match a Source of compatible type. `audioVisual` has `channelId` instead |

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

| Field             | Type                     | Required | Notes                                                                                                                                                             |
| ----------------- | ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`             | `string`                 | yes      | empty, an http(s) address, or a same-origin path. A new layer starts empty.                                                                                       |
| `width`           | `number`                 | yes      | page viewport width. A new layer uses 500. An external http(s) page still at that default is shown at the project frame, so overlay widgets keep their positions. |
| `height`          | `number`                 | yes      | page viewport height. A new layer uses 500. An external page still at that default uses the project frame.                                                        |
| `zoom`            | `number`                 | no       | page scale inside the layer, 1–4, default 1                                                                                                                       |
| `audio`           | `boolean`                | no       | default false. When true, this page contributes the tab mix to one global channel                                                                                 |
| `refreshSettings` | `BrowserRefreshSettings` | yes      |                                                                                                                                                                   |

```ts
type BrowserRefreshSettings = {
  intervalMs: number | null;
  refreshOnActivate: boolean;
  bypassCache: boolean;
};
```

Not an Asset — live URL, not a stored file. The preview draws the page as an iframe. Layout, crop, and the tab-audio switch are specified in [browser-layer.md](./browser-layer.md).

### Other source kinds (extensible)

| Type     | Key settings                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `camera` | `deviceId?`, constraints                                                                                                                                     |
| `screen` | `displayId?` / capture hints                                                                                                                                 |
| `image`  | `assetId`                                                                                                                                                    |
| `video`  | `assetId`, loop?                                                                                                                                             |
| `text`   | text content, typography                                                                                                                                     |
| `shape`  | shapeKind, fill, stroke                                                                                                                                      |
| `audio`  | `assetId`, or `deviceId`. `'system'` is one shared system-or-app capture. `'moonbase:browser-tab'` is the one tab mix for browser sources with `audio: true` |

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

The browser graph that reads this model is [audio-engine.md](./audio-engine.md).

| Field      | Type                | Required | Notes                                                         |
| ---------- | ------------------- | -------- | ------------------------------------------------------------- |
| `master`   | `AudioMaster`       | yes      | volume, mute, and `effects`                                   |
| `channels` | `AudioChannel[]`    | yes      |                                                               |
| `presets`  | `AudioUserPreset[]` | yes      | user library for this project, format 1                       |
| `overlay`  | `OverlayBus`        | yes      | project bus for overlay sounds; missing files get the default |

### AudioMaster

| Field     | Type            | Required | Notes                                       |
| --------- | --------------- | -------- | ------------------------------------------- |
| `volume`  | `number`        | yes      | 0–1                                         |
| `muted`   | `boolean`       | yes      |                                             |
| `effects` | `AudioEffect[]` | yes      | after the program sum, before master volume |

### AudioChannel

| Field          | Type                                         | Required | Notes                                                 |
| -------------- | -------------------------------------------- | -------- | ----------------------------------------------------- |
| `id`           | `ChannelId`                                  | yes      |                                                       |
| `name`         | `string`                                     | yes      |                                                       |
| `sourceIds`    | `SourceId[]`                                 | yes      | one source belongs to one channel; summed before trim |
| `trimDb`       | `number`                                     | yes      | −24…+24                                               |
| `faderDb`      | `number`                                     | yes      | −60…+12, unity 0                                      |
| `pan`          | `number`                                     | yes      | −1…1                                                  |
| `muted`        | `boolean`                                    | yes      |                                                       |
| `solo`         | `boolean`                                    | yes      | AFL on the monitor bus only                           |
| `monitoring`   | `'off' \| 'monitor' \| 'monitor-and-output'` | yes      |                                                       |
| `syncOffsetMs` | `number`                                     | yes      | −1000…1000 ms, stored, not applied yet                |
| `global`       | `boolean`                                    | yes      | heard on every scene; a scene layer reuses this strip |
| `filters`      | `AudioFilter[]`                              | yes      | kept for older files; the engine does not read them   |
| `effects`      | `AudioEffect[]`                              | yes      | after trim, before the fader; disabled effects bypass |

### AudioFilter

Loose stored record: `id`, `type`, `enabled`, `parameters`. Not part of the browser chain.

### AudioEffect

`id`, `type`, `name`, `enabled`, and parameters for that type. Types: `eq-band`, `high-pass`, `compressor`, `noise-gate`, `limiter`. No Web Audio nodes in the model. A channel preset copies trim, fader, pan, mute, and the chain. It does not copy `sourceIds`, solo, or monitoring, and it does not change the overlay bus.

### OverlayBus

One bus for the whole project. Format 3. A file that omits `overlay` gets this default. The bus does not store voices, buffers, or queues.

| Field               | Type                                                             | Required | Notes                                          |
| ------------------- | ---------------------------------------------------------------- | -------- | ---------------------------------------------- |
| `faderDb`           | `number`                                                         | yes      | −60…+12, unity 0                               |
| `muted`             | `boolean`                                                        | yes      | in front of the program and headphone split    |
| `solo`              | `boolean`                                                        | yes      | headphones only; it does not solo the channels |
| `monitoring`        | `'off' \| 'monitor' \| 'monitor-and-output'`                     | yes      | same three positions as a channel              |
| `effects`           | `AudioEffect[]`                                                  | yes      | after the overlay sum, before the fader        |
| `maxInstances`      | `number`                                                         | yes      | 1…64, default 16                               |
| `sceneChangePolicy` | `'continue' \| 'stop-scene-sounds' \| 'stop-all-overlay-sounds'` | yes      | default `continue`                             |
| `sounds`            | `OverlaySound[]`                                                 | yes      |                                                |
| `triggers`          | `OverlayTrigger[]`                                               | yes      |                                                |

### OverlaySound

| Field           | Type                                          | Required | Notes                           |
| --------------- | --------------------------------------------- | -------- | ------------------------------- |
| `id`            | `OverlaySoundId`                              | yes      |                                 |
| `name`          | `string`                                      | yes      |                                 |
| `assetId`       | `AssetId`                                     | yes      | must be an audio asset          |
| `volumeDb`      | `number`                                      | yes      | −24…+12, default 0              |
| `muted`         | `boolean`                                     | yes      |                                 |
| `enabled`       | `boolean`                                     | yes      | a disabled sound does not start |
| `loop`          | `boolean`                                     | yes      |                                 |
| `startTimeSec`  | `number`                                      | yes      | ≥ 0                             |
| `endTimeSec`    | `number`                                      | no       | after `startTimeSec`            |
| `playbackRate`  | `number`                                      | yes      | 0.25…4                          |
| `maxInstances`  | `number`                                      | yes      | 1…32, default 4                 |
| `cooldownMs`    | `number`                                      | yes      | 0…60000                         |
| `restartPolicy` | `'allow' \| 'restart' \| 'ignore' \| 'queue'` | yes      | default `allow`                 |

### OverlayTrigger

| Field       | Type                                                                                                                                                         | Required | Notes                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------- |
| `id`        | `OverlayTriggerId`                                                                                                                                           | yes      |                                          |
| `soundId`   | `OverlaySoundId`                                                                                                                                             | yes      |                                          |
| `event`     | cue name: `shown`, `hidden`, `animation-start`, `animation-complete`, `interaction`, `custom`, `follow`, `subscription`, `donation`, `raid`, `cheer`, `chat` | yes      | alert names are cue events               |
| `enabled`   | `boolean`                                                                                                                                                    | yes      |                                          |
| `sceneId`   | `SceneId`                                                                                                                                                    | no       | when set, the cue must name that scene   |
| `elementId` | `ElementId`                                                                                                                                                  | no       | when set, the cue must name that element |

Deleting a sound does not delete its asset. Deleting an asset fails while a sound still points at it.

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
  formatVersion: 3;
  project: Omit<Project, 'history'>;
};
```

On load: migrate `formatVersion: 1` to v2, then v2 to v3 (project audio channels). A conflicting strip becomes a neutral channel and a session report; the file is not written until the user saves. Validate with Zod, attach empty `history: { past: [], future: [], limit }`. Unknown versions fail validation.

An `audioVisual` layer stores `channelId` and enables that project channel in the scene. The strip lives on the channel.

---

## Architectural notes

1. **Source vs element:** Source = reusable input config; Element = placement in a scene.
2. **Asset vs source:** Asset = file; Source may reference an asset or describe a live device/URL (browser).
3. **Overlay vs browser:** Overlay is an element variant with inline content; browser is source + element with `sourceId`.
4. **Animations vs transitions:** SceneAnimation = GIF/video asset; Transition = inter-scene effect definition.
