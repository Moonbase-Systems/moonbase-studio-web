# Stores — MoonBase Studio

Pinia setup stores only. Keys registered in `layers/core/app/constants/store-keys.ts`.

Domain types stay in `*.domain.ts`. Stores hold state and expose actions; they do not redefine the domain shape.

---

## Store map

| Store key | Constant             | Persistable?                                  | Responsibility                                                   |
| --------- | -------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `project` | `STORE_KEYS.PROJECT` | Document via `ProjectFile` (not cookie Pinia) | Catalog + active `Project` aggregate including session `history` |
| `editor`  | `STORE_KEYS.EDITOR`  | No                                            | Selection, tools, viewport, panels                               |

**Not separate stores:** Scene, Source, Asset, AudioMixer, Transition, History — all fields of `Project` inside `ProjectStore`.

Cookie persistence (`pinia-plugin-persistedstate`) remains appropriate for auth session only. Large project graphs must use explicit save/load (`ProjectFile`), not cookies.

---

## ProjectStore

### State

| Field             | Type                | Notes                                                   |
| ----------------- | ------------------- | ------------------------------------------------------- |
| `projectsMeta`    | `ProjectMeta[]`     | Lightweight catalog (`id`, `name`, `type`, `updatedAt`) |
| `activeProjectId` | `ProjectId \| null` |                                                         |
| `activeProject`   | `Project \| null`   | Full aggregate when a project is open                   |

### Intended operations (spec — not implemented yet)

- `createProject(input)` → new Project + meta entry + set active
- `openProject(id | ProjectFile)` → load, `history` empty, clear editor selection
- `closeProject()` → clear active + history context
- `renameProject` / `updateSettings`
- Scene CRUD, element/group CRUD, source/asset CRUD
- Mixer channel CRUD and level updates
- Transition library CRUD
- `pushHistory(entry)` / `undo` / `redo`
- `serializeActiveProject(): ProjectFile` (omit history)
- `importProjectFile(file)` (Zod validate)

### Isolation rule

Switching `activeProjectId` replaces `activeProject` entirely. Editor selection and any project-scoped UI reset. History belongs to the loaded project instance and does not leak across projects.

### Persistence

| Data                        | Where                                               |
| --------------------------- | --------------------------------------------------- |
| `Project` without `history` | `ProjectFile` (API / download / future local draft) |
| `projectsMeta`              | May sync with backend list API later                |
| `history`                   | Memory only                                         |

---

## EditorStore

### State (all ephemeral)

| Field                | Type                    | Notes                               |
| -------------------- | ----------------------- | ----------------------------------- |
| `selectedElementIds` | `ElementId[]`           |                                     |
| `selectedGroupIds`   | `GroupId[]`             |                                     |
| `activeSceneId`      | `SceneId \| null`       | mirrors which scene is being edited |
| `tool`               | `EditorTool`            | e.g. select, pan                    |
| `viewport`           | `{ zoom, panX, panY }`  |                                     |
| `panels`             | panel open/closed flags |                                     |

### Operations

- selection setters, tool/viewport updates, panel toggles
- `reset()` on project switch

Must not duplicate scene graph data that already lives on `activeProject`.

---

## Collaboration between stores

```
EditorStore  --commands / intents-->  ProjectStore (mutates Project + history)
EditorStore  --reads-->               ProjectStore.activeProject
```

UI components call store actions (or thin composables). They never patch domain objects ad hoc without going through history when the change is undoable.

---

## Future note

When Pinia store files are added (`project.store.ts`, `editor.store.ts`), they will use `defineStore(STORE_KEYS.*, () => { ... })` setup style, matching `user-session.store.ts`. This architecture phase only registers keys and documents responsibilities.
