# Architectural Decisions — MoonBase Studio Domain

## ADR-001: Single studio session

**Decision:** Persistable project state and ephemeral editor state live in one Pinia store, `useStudioSessionStore` (`studioSession`). The document is `session.project`. Selection, tool, viewport, and panels are `session.editor`. There are no separate stores for scenes, sources, the mixer, or history. `STORE_KEYS.PROJECT` and `STORE_KEYS.EDITOR` stay unused.

**Why:** One session avoids a second copy of the project graph. Replacing `project` on open or create also resets history. Editor state stays out of `ProjectFile`.

---

## ADR-002: History is session-only

**Decision:** `Project.history` (`past[]`, `future[]`, `limit`) is part of the in-memory project aggregate but is **stripped on save** and empty after load.

**Why:** Undo stacks grow quickly, are device/session specific, and are not part of the authored document. Switching projects always starts with an empty history.

---

## ADR-003: Flat groups with membership invariant

**Decision:** Scene keeps separate `elements[]` and `groups[]`. Canonical membership is `SceneElement.parentGroupId`. `SceneGroup.elementIds[]` is the ordered member list and must stay consistent with `parentGroupId` (validated by Zod).

**Why:** Matches the product tree (elements + groups), supports ordered children, and avoids a second independent ownership graph.

**v1 constraint:** Groups are single-level (a group does not contain another group). Nested groups can be added later without changing the element/group split.

---

## ADR-004: Overlay is a SceneElement variant

**Decision:** Overlay is `SceneElement` with `type: 'overlay'`, stored in `scene.elements[]`. There is no `scene.overlays[]`.

**Why:** Overlays must be groupable, transformable, and ordered like any other element. A separate collection would duplicate membership and z-order.

---

## ADR-005: Browser is a Source, not an Asset

**Decision:** Browser configuration (`url`, `width`, `height`, `refreshSettings`) lives on `Source` with `type: 'browser'`. Placement on a scene is `SceneElement` with `type: 'browser'` and `sourceId`.

**Why:** Assets are stored files. A browser source is a live URL. Source reuse across scenes follows the same pattern as camera/screen.

**Sizing rule:** Source `width`/`height` define the browser viewport. On-canvas scale/position come from the element `transform`.

---

## ADR-006: SceneAnimation is a media asset (v1)

**Decision:** `SceneAnimation` references an `Asset` (`gif` or `video`). No keyframes, easing, or GSAP instances in the data model.

**Why:** v1 only needs enter/exit media clips. Procedural tweens can be added later via a discriminated union and `formatVersion` migration.

---

## ADR-007: Transitions are project-owned definitions

**Decision:** `Project.transitions[]` holds reusable transition definitions. A scene may reference a default via settings; optional from→to edges can be added without a second library.

**Why:** Separates inter-scene transitions from in-scene media animations (`SceneAnimation`).

---

## ADR-008: Versioned ProjectFile

**Decision:** Persistable payload is:

```ts
type ProjectFile = {
  formatVersion: 2;
  project: Omit<Project, 'history'>;
};
```

Validated with Zod on import and on every committed document change. A `formatVersion: 1` file is migrated to v2 by `migrateProjectFile` before validation. Unknown versions fail validation.

**Why:** Cookie Pinia is unsuitable for large scene graphs. Explicit versioning enables safe schema changes. The browser `SceneRepository` stores this file in IndexedDB; it is also the document a future runtime can load without editor state or history.

---

## ADR-009: Domain independence

**Decision:** Domain types in `layers/studio` must not import Vue, Pinia, PixiJS, Three.js, GSAP, DOM, or Web Audio runtime objects.

**Why:** The renderer and audio engine consume the model; they are not the source of truth.

---

## Out of scope (confirmed)

Virtual Studio, 3D / Three.js, AI features, full streaming transport, multi-user sync.
