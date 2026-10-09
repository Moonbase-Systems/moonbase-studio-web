# Architecture Diagrams — MoonBase Studio

## 1. Model relationships

Ownership (solid) vs ID references (dashed conceptually via labels).

```mermaid
erDiagram
  Project ||--|| ProjectSettings : settings
  Project ||--o{ Scene : scenes
  Project ||--o{ Source : sources
  Project ||--o{ Asset : assets
  Project ||--|| AudioMixer : audioMixer
  Project ||--o{ Transition : transitions
  Project ||--|| ProjectHistory : history

  Scene ||--o{ SceneElement : elements
  Scene ||--o{ SceneGroup : groups
  Scene ||--o| SceneAnimation : onEnter
  Scene ||--o| SceneAnimation : onExit

  SceneElement }o--o| Source : sourceId
  SceneElement }o--o| SceneGroup : parentGroupId
  SceneGroup ||--o{ SceneElement : elementIds

  SceneAnimation }o--|| Asset : assetId
  Source }o--o| Asset : assetId
  Scene }o--o| Transition : defaultTransitionId

  AudioMixer ||--|| AudioMaster : master
  AudioMixer ||--o{ AudioChannel : channels
  AudioChannel }o--o| Source : sourceId
  AudioChannel ||--o{ AudioFilter : filters
  AudioChannel ||--o{ AudioEffect : effects
```

## 2. Project structure (ownership hierarchy)

```mermaid
flowchart TB
  Project --> ProjectSettings
  Project --> Scenes["scenes[]"]
  Project --> Sources["sources[]"]
  Project --> Assets["assets[]"]
  Project --> AudioMixer
  Project --> Transitions["transitions[]"]
  Project --> History["history session"]

  Scenes --> Scene
  Scene --> Elements["elements[]"]
  Scene --> Groups["groups[]"]
  Scene --> SceneAnims["animations onEnter/onExit"]

  Elements --> SceneElement
  SceneElement --> OverlayVariant["type overlay"]
  SceneElement --> BrowserEl["type browser + sourceId"]
  SceneElement --> OtherEl["camera screen image …"]

  Sources --> BrowserSrc["type browser url/width/height"]
  Sources --> OtherSrc["camera screen image …"]

  Assets --> FileAsset["image video audio gif"]
  SceneAnims --> FileAsset
```

Sources and assets are siblings of scenes under Project — not nested under Scene. Elements only reference them by ID.

## 3. Store responsibilities and dependencies

```mermaid
flowchart LR
  UI["UI components"] --> EditorStore
  UI --> ProjectStore
  EditorStore -->|"undoable commands"| ProjectStore
  EditorStore -->|"reads graph"| ProjectStore
  ProjectStore -->|"serialize"| ProjectFile["ProjectFile formatVersion"]
  ProjectFile -->|"import validate"| ProjectStore
```

```mermaid
flowchart TB
  subgraph projectStore [ProjectStore]
    meta[projectsMeta]
    activeId[activeProjectId]
    active[activeProject]
    active --> hist[history past/future]
    active --> doc[scenes sources assets mixer transitions settings]
  end
  subgraph editorStore [EditorStore]
    sel[selection]
    tool[tool]
    view[viewport]
    panels[panels]
  end
  editorStore -.->|"depends on"| projectStore
```

## 4. Scene transition flow

```mermaid
sequenceDiagram
  participant User
  participant Editor as EditorStore
  participant Project as ProjectStore
  participant SceneA as Scene A
  participant Trans as Transition
  participant SceneB as Scene B

  User->>Editor: request switch to Scene B
  Editor->>Project: resolve defaultTransitionId or edge
  Project->>SceneA: play animations.onExit media if set
  Project->>Trans: run Transition type/duration/easing
  Project->>SceneB: play animations.onEnter media if set
  Editor->>Editor: activeSceneId = Scene B
```

Notes:

- `Transition` = inter-scene effect from `Project.transitions[]`.
- `SceneAnimation` = GIF/video asset on enter/exit — not the same model as `Transition`.

## 5. Undo / Redo flow

```mermaid
flowchart LR
  UI["Editor action"] --> Cmd["History command"]
  Cmd --> Apply["Apply forward patch to Project"]
  Apply --> Push["Push inverse to history.past"]
  Push --> Clear["Clear history.future"]

  Undo["undo"] --> Past["Pop history.past"]
  Past --> Inv["Apply inverse patch"]
  Inv --> Future["Push to history.future"]

  Redo["redo"] --> Fut["Pop history.future"]
  Fut --> Fwd["Apply forward patch"]
  Fwd --> Past2["Push to history.past"]
```

History is session-scoped on `Project.history` and omitted from `ProjectFile`.
