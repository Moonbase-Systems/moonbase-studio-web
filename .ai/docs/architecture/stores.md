# Stores — MoonBase Studio

Pinia setup stores only. Keys registered in `layers/core/app/constants/store-keys.ts`.

Domain types stay in `*.domain.ts`. Stores hold state and expose actions; they do not redefine the domain shape.

The live editor store is `useStudioSessionStore` (`STORE_KEYS.STUDIO_SESSION`). It keeps one `StudioSession`: the open `Project` (including session-only `history`) and ephemeral `EditorState`. `STORE_KEYS.PROJECT` and `STORE_KEYS.EDITOR` are reserved and have no stores. Do not add a second project or editor store beside `studioSession`.

---

## Store map

| Store key       | Constant                    | Persistable?                                                             | Responsibility                                                          |
| --------------- | --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `studioSession` | `STORE_KEYS.STUDIO_SESSION` | No. The document is saved as `ProjectFile` v2 through `SceneRepository`. | Open project, editor selection and viewport, dirty flag, initialization |
| `userSession`   | `STORE_KEYS.USER_SESSION`   | Cookie Pinia                                                             | Auth only                                                               |
| `shortcuts`     | `STORE_KEYS.SHORTCUTS`      | No                                                                       | Keyboard bindings                                                       |

`Project`, scenes, sources, assets, the mixer, transitions, and `history` are fields of the open project. They are not separate stores.

Cookie persistence stays limited to the auth session. Project graphs use explicit save/load (`ProjectFile`), not cookies.

---

## Studio session

### State

| Field           | Type              | Notes                                                                       |
| --------------- | ----------------- | --------------------------------------------------------------------------- |
| `project`       | `Project \| null` | Aggregate including `history`. History is omitted from `ProjectFile`.       |
| `editor`        | `EditorState`     | Selection, active scene, tool, viewport, panels. Not part of `ProjectFile`. |
| `isDirty`       | `boolean`         | Cleared by `markSaved` and by `openProject` / `createProject`.              |
| `isInitialized` | `boolean`         | Set by `initialize`.                                                        |

The store does not export the session ref. Actions delegate to `createStudioService`. The committed session is frozen so UI code reads it and changes it only through those actions.

### Operations

Implemented on the service and the store:

- `initialize`, `createProject`, `openProject`, `closeProject`, `markSaved`
- `updateProject` for name, type, description, and settings
- scene CRUD, including `setSceneDefaultTransition`
- element, group, and source CRUD
- `addAsset` / `updateAsset` / `removeAsset`
- mixer master and channel CRUD
- transition library CRUD
- `undo` / `redo`, `runTransaction`
- selection and active scene (`recordHistory: false`)

Save and load go through `createSceneRepository`. The browser adapter stores `ProjectFile` v2 in IndexedDB. `openProject` validates the file, drops history, and resets editor selection.

### Isolation

`createProject` and `openProject` replace the open project and start with an empty history. Editor selection is normalized against the loaded scenes. History does not leak across projects.

### Persistence

| Data                        | Where                                                    |
| --------------------------- | -------------------------------------------------------- |
| `Project` without `history` | `ProjectFile` (`formatVersion: 2`) via `SceneRepository` |
| `history`                   | Memory only                                              |
| catalog                     | `listProjects()` over saved files                        |

---

## Editor state

`EditorState` lives on the session, not in its own store.

| Field                | Type                   | Notes                                   |
| -------------------- | ---------------------- | --------------------------------------- |
| `selectedElementIds` | `ElementId[]`          |                                         |
| `selectedGroupIds`   | `GroupId[]`            | Cleared when the document is normalized |
| `activeSceneId`      | `SceneId \| null`      |                                         |
| `tool`               | `EditorTool`           |                                         |
| `viewport`           | `{ zoom, panX, panY }` |                                         |
| `panels`             | panel flags            |                                         |

Selection changes do not mark the project dirty and are not undo steps, except that an undo snapshot also restores the active scene and selection from the moment of the edit.

UI components call store actions or thin composables. They do not patch domain objects in place.
