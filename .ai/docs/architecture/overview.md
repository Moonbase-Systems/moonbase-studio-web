# MoonBase Studio — Domain Architecture Overview

## Purpose

MoonBase Studio is a video scene composition application. Users manage multiple projects, build scenes from elements and groups, reuse image/audio sources, configure an audio mixer, and define enter/exit media plus transitions between scenes.

This document describes the **domain data architecture** that later implementation will follow. It does not implement the editor UI or render/audio runtimes.

## Layer placement

Studio domain code belongs in the Nuxt feature layer:

```
moonbase-core          → shared UI / tokens
layers/core            → app infrastructure ($api, STORE_KEYS)
layers/auth            → authentication
layers/studio          → studio domain models, schemas, (future stores/services)
app/                   → global shell
```

Domain models live under `layers/studio/app/models/`. Zod validation under `layers/studio/app/schemas/`. Documentation under `.ai/docs/architecture/` and `.ai/docs/requirements/`.

## Canonical ownership tree

```
ProjectStore
│
├── projectsMeta[]          # catalog entries (id, name, type, updatedAt, …)
├── activeProjectId
└── activeProject → Project
    ├── settings            → ProjectSettings
    ├── scenes[]            → Scene
    │   ├── elements[]      → SceneElement (incl. overlay, browser, …)
    │   ├── groups[]        → SceneGroup
    │   └── animations      → onEnter / onExit SceneAnimation
    ├── sources[]           → Source (incl. browser)
    ├── assets[]            → Asset (files only)
    ├── audioMixer          → AudioMixer
    ├── transitions[]       → Transition
    ├── history             → session only (stripped on save)
    └── metadata
```

**Ownership vs references**

| Owned by Project                             | Referenced by ID                                              |
| -------------------------------------------- | ------------------------------------------------------------- |
| Scene, Source, Asset, Transition, AudioMixer | `sourceId`, `assetId`, `parentGroupId`, `defaultTransitionId` |

Sources and assets are **not** children of a scene. Elements and animations only hold IDs.

## Core principles

1. Domain models do not depend on Vue, Pinia, PixiJS, Three.js, or GSAP.
2. The render engine is not the source of truth.
3. UI mutates models through store actions / history commands.
4. One source can be used by many scene elements.
5. Each project has isolated document state and undo/redo stacks.
6. Persistable data contains no DOM, Web Audio, or tween runtime instances.
7. New source/element/effect kinds extend via discriminated unions.
8. Relations are explicit IDs, validated on import.
9. Save/load uses `ProjectFile.formatVersion`.
10. No premature multi-user / cloud sync / Virtual Studio models.

## Related docs

- [data-models.md](./data-models.md) — field-level model spec
- [stores.md](./stores.md) — ProjectStore / EditorStore
- [diagrams.md](./diagrams.md) — Mermaid diagrams
- [decisions.md](./decisions.md) — ADRs
- [../requirements/user-stories.md](../requirements/user-stories.md) — user stories
