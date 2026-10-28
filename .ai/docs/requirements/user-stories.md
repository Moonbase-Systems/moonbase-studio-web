# User Stories — MoonBase Studio

Format: ID, title, story, acceptance (Given/When/Then), related models, priority, dependencies.

Priorities: **Must** / **Should** / **Could**.

---

## Projects

### US-PROJ-001 — Create project

**Jako** użytkownik **chcę** utworzyć nowy projekt z nazwą i typem, **aby** mieć izolowaną przestrzeń kompozycji.

**Acceptance**

- Given katalog projektów
- When tworzę projekt z nazwą i typem
- Then powstaje `Project` z domyślnymi `settings`, pustymi kolekcjami (lub jedną pustą sceną), pustą `history`, oraz wpis w `projectsMeta`

**Models:** `Project`, `ProjectSettings`, `ProjectHistory`  
**Priority:** Must  
**Depends on:** —

### US-PROJ-002 — Switch active project

**Jako** użytkownik **chcę** przełączyć aktywny projekt, **aby** edytować inny projekt bez mieszania stanu.

**Acceptance**

- Given dwa projekty A i B; A aktywny z zaznaczeniem i historią
- When otwieram B
- Then `activeProject` to B, historia B jest pusta (lub własna sesja B), zaznaczenie edytora zresetowane; stan A nie przenika do B

**Models:** `Project`, `ProjectHistory`, `studioSession.editor`  
**Priority:** Must  
**Depends on:** US-PROJ-001

### US-PROJ-003 — Rename and update project metadata

**Jako** użytkownik **chcę** zmienić nazwę i opis projektu, **aby** utrzymywać czytelny katalog.

**Acceptance**

- Given aktywny projekt
- When zmieniam `name` / metadata
- Then wartości są zapisane w agregacie i odbite w `projectsMeta`

**Models:** `Project`, `ProjectMetadata`  
**Priority:** Should  
**Depends on:** US-PROJ-001

---

## Scenes

### US-SCENE-001 — Add and name scenes

**Jako** użytkownik **chcę** dodać wiele nazwanych scen w projekcie, **aby** przygotować różne kompozycje (np. intro, rozmowa, outro).

**Acceptance**

- Given aktywny projekt
- When dodaję scenę z nazwą
- Then `scenes[]` zawiera nową `Scene` z pustymi `elements`/`groups` i `animations.onEnter/onExit = null`

**Models:** `Scene`  
**Priority:** Must  
**Depends on:** US-PROJ-001

### US-SCENE-002 — Configure scene background and settings

**Jako** użytkownik **chcę** ustawić tło i domyślne przejście sceny, **aby** kontrolować wygląd i zmianę scen.

**Acceptance**

- Given scena
- When ustawiam tło (kolor / obraz z assetu / brak) oraz `defaultTransitionId`
- Then `background` i `settings` odzwierciedlają wybór; `defaultTransitionId` wskazuje istniejący `Transition` lub null

**Models:** `Scene`, `SceneBackground`, `Transition`  
**Priority:** Must  
**Depends on:** US-SCENE-001, US-TRANS-001

### US-SCENE-003 — Duplicate or delete scene

**Jako** użytkownik **chcę** duplikować lub usunąć scenę, **aby** szybciej iterować kompozycje.

**Acceptance**

- Given ≥1 scena
- When duplikuję — powstaje kopia z nowymi ID elementów/grup
- When usuwam ostatnią dozwoloną scenę — system blokuje lub wymaga potwierdzenia zgodnie z regułą „min. 1 scena” (Must: nie zostawiać projektu bez sceny jeśli reguła obowiązuje)

**Models:** `Scene`, `SceneElement`, `SceneGroup`  
**Priority:** Should  
**Depends on:** US-SCENE-001

---

## Scene elements

### US-ELEM-001 — Place source-backed element on scene

**Jako** użytkownik **chcę** dodać element powiązany ze źródłem (kamera, obraz, wideo, …), **aby** zbudować kompozycję.

**Acceptance**

- Given scena i istniejące `Source`
- When dodaję element danego typu z `sourceId`
- Then element ma transform, visibility, `parentGroupId: null`, poprawny `type` i `sourceId`

**Models:** `SceneElement`, `Source`  
**Priority:** Must  
**Depends on:** US-SCENE-001, US-SRC-001

### US-ELEM-002 — Transform and visibility

**Jako** użytkownik **chcę** przesuwać, skalować, obracać i ukrywać elementy, **aby** układać kadry.

**Acceptance**

- Given element na scenie
- When zmieniam `transform` lub `visibility`
- Then model aktualizuje się i operacja trafia do historii (undoable)

**Models:** `SceneElement`, `Transform2D`, `ProjectHistory`  
**Priority:** Must  
**Depends on:** US-ELEM-001, US-HIST-001

### US-ELEM-003 — Reorder layers

**Jako** użytkownik **chcę** zmieniać kolejność warstw, **aby** kontrolować nakładanie.

**Acceptance**

- Given ≥2 elementy
- When zmieniam `zIndex` / kolejność
- Then render order wynika z zaktualizowanych wartości

**Models:** `SceneElement`  
**Priority:** Must  
**Depends on:** US-ELEM-001

---

## Groups

### US-GRP-001 — Group and ungroup elements

**Jako** użytkownik **chcę** grupować elementy (w tym overlaye i browser), **aby** wspólnie je przesuwać i organizować scenę.

**Acceptance**

- Given ≥2 elementy root
- When tworzę grupę
- Then powstaje `SceneGroup` z `elementIds`, a elementy mają `parentGroupId = group.id` (invariant spełniony)
- When rozgrupowuję — grupa znika, `parentGroupId = null`

**Models:** `SceneGroup`, `SceneElement`  
**Priority:** Must  
**Depends on:** US-ELEM-001

### US-GRP-002 — Transform group

**Jako** użytkownik **chcę** transformować grupę, **aby** przesuwać zestaw elementów naraz.

**Acceptance**

- Given grupa z członkami
- When zmieniam `transform` grupy
- Then zmiana jest zapisana na grupie i jest undoable

**Models:** `SceneGroup`, `ProjectHistory`  
**Priority:** Must  
**Depends on:** US-GRP-001

---

## Overlays

### US-OVL-001 — Add overlay element

**Jako** użytkownik **chcę** dodać overlay (np. lower-third) jako element sceny, **aby** pokazać UI/widget w kompozycji.

**Acceptance**

- Given scena
- When dodaję element `type: 'overlay'` z `overlayKind` i `content`
- Then element jest w `elements[]`, bez `sourceId`, możliwy do zaznaczenia i grupowania

**Models:** `SceneElement` (overlay)  
**Priority:** Must  
**Depends on:** US-SCENE-001

### US-OVL-002 — Overlay media animations

**Jako** użytkownik **chcę** przypisać do overlayu animacje oparte o GIF/wideo, **aby** wejście/ozdoba było medialne.

**Acceptance**

- Given overlay i asset gif/video
- When dodaję `SceneAnimation` do `animations[]` overlayu
- Then animacja referencjonuje `assetId` i `mediaKind`

**Models:** `SceneElement`, `SceneAnimation`, `Asset`  
**Priority:** Should  
**Depends on:** US-OVL-001, US-ASSET-001

---

## Sources

### US-SRC-001 — Create reusable source

**Jako** użytkownik **chcę** dodać źródło do projektu (kamera, ekran, obraz, …), **aby** używać go w wielu scenach.

**Acceptance**

- Given projekt
- When tworzę źródło danego typu
- Then pojawia się w `sources[]` z unikalnym `id`; elementy mogą wskazać `sourceId`

**Models:** `Source`  
**Priority:** Must  
**Depends on:** US-PROJ-001

### US-SRC-002 — Browser source

**Jako** użytkownik **chcę** utworzyć źródło przeglądarki z URL, rozmiarem viewportu i odświeżaniem, **aby** osadzić stronę WWW w kompozycji.

**Acceptance**

- Given projekt
- When tworzę `Source` `type: 'browser'` z `url`, `width`, `height`, `refreshSettings`
- Then źródło jest w `sources[]` (nie w `assets[]`)
- When dodaję element `type: 'browser'` z tym `sourceId`
- Then element można grupować i transformować; viewport pozostaje na Source

**Models:** `Source` (browser), `SceneElement` (browser)  
**Priority:** Must  
**Depends on:** US-SRC-001, US-ELEM-001

### US-SRC-003 — Reuse source across scenes

**Jako** użytkownik **chcę** użyć tego samego źródła w dwóch scenach, **aby** nie duplikować konfiguracji kamery/URL.

**Acceptance**

- Given jedno Source i dwie sceny
- When w obu scenach są elementy z tym samym `sourceId`
- Then zmiana ustawień Source wpływa na oba elementy bez kopiowania konfiguracji źródła

**Models:** `Source`, `SceneElement`  
**Priority:** Must  
**Depends on:** US-SRC-001, US-ELEM-001

---

## Audio mixer

### US-AUD-001 — Configure master and channels

**Jako** użytkownik **chcę** ustawić master oraz kanały (volume, mute, solo, pan), **aby** kontrolować miks projektu.

**Acceptance**

- Given projekt z `audioMixer`
- When zmieniam master lub kanał
- Then wartości są w modelu; kanał może mieć `sourceId` lub null

**Models:** `AudioMixer`, `AudioChannel`  
**Priority:** Must  
**Depends on:** US-PROJ-001

### US-AUD-002 — Channel filters and effects

**Jako** użytkownik **chcę** włączać filtry i efekty na kanale, **aby** przetwarzać dźwięk według typu efektu.

**Acceptance**

- Given kanał
- When dodaję filter/effect z `type`, `enabled`, `parameters`
- Then lista jest typowana (brak jednego „worka” pól dla wszystkich efektów); model nie zawiera węzłów Web Audio

**Models:** `AudioFilter`, `AudioEffect`  
**Priority:** Should  
**Depends on:** US-AUD-001

---

## Animations (scene media)

### US-ANIM-001 — Scene enter/exit media

**Jako** użytkownik **chcę** przypisać GIF lub wideo jako animację wejścia/wyjścia sceny, **aby** uatrakcyjnić zmianę sceny.

**Acceptance**

- Given scena i asset `gif` lub `video`
- When ustawiam `animations.onEnter` lub `onExit` jako `SceneAnimation`
- Then model ma `assetId` + `mediaKind`; brak keyframe’ów w v1

**Models:** `SceneAnimation`, `Asset`, `Scene`  
**Priority:** Must  
**Depends on:** US-SCENE-001, US-ASSET-001

---

## Transitions

### US-TRANS-001 — Transition library

**Jako** użytkownik **chcę** mieć w projekcie definicje przejść (cut/fade/slide/zoom), **aby** wielokrotnie je stosować.

**Acceptance**

- Given projekt
- When dodaję `Transition` z `type`, `durationMs`, `easing`, `settings`
- Then wpis jest w `transitions[]`

**Models:** `Transition`  
**Priority:** Must  
**Depends on:** US-PROJ-001

### US-TRANS-002 — Apply default transition between scenes

**Jako** użytkownik **chcę** przypisać domyślne przejście do sceny, **aby** zmiana na tę scenę używała wybranego efektu.

**Acceptance**

- Given transition w bibliotece i scena docelowa
- When ustawiam `settings.defaultTransitionId`
- Then przełączenie sceny rozwiązuje tę definicję (osobno od `SceneAnimation`)

**Models:** `Transition`, `Scene`  
**Priority:** Must  
**Depends on:** US-TRANS-001, US-SCENE-002

---

## Assets

### US-ASSET-001 — Register file asset

**Jako** użytkownik **chcę** dodać zasób plikowy z trwałym `location`, **aby** projekt dało się odtworzyć bez lokalnych ścieżek OS.

**Acceptance**

- Given projekt
- When rejestruję asset z `type`, `location` (`storageKey` lub `remoteUrl`), `availability`
- Then asset jest w `assets[]`; źródła/animacje mogą wskazać `assetId`

**Models:** `Asset`  
**Priority:** Must  
**Depends on:** US-PROJ-001

### US-ASSET-002 — Missing asset availability

**Jako** użytkownik **chcę** widzieć, gdy zasób jest niedostępny, **aby** naprawić brakujące pliki po wczytaniu projektu.

**Acceptance**

- Given projekt z `availability: 'missing'`
- When otwieram projekt
- Then model zachowuje referencje; UI może oznaczyć brak (poza zakresem implementacji UI w tej fazie — kryterium modelowe: pole istnieje i jest walidowane)

**Models:** `Asset`  
**Priority:** Should  
**Depends on:** US-ASSET-001

---

## Undo / Redo

### US-HIST-001 — Undo and redo edits

**Jako** użytkownik **chcę** cofać i ponawiać zmiany w projekcie, **aby** bezpiecznie eksperymentować z kompozycją.

**Acceptance**

- Given aktywny projekt i wykonana undoable operacja (np. move element)
- When undo — stan wraca, wpis ląduje w `future`
- When redo — stan wraca do po zmianie
- When nowa zmiana po undo — `future` jest czyszczone
- And `history` nie trafia do `ProjectFile`

**Models:** `ProjectHistory`, `HistoryEntry`  
**Priority:** Must  
**Depends on:** US-PROJ-001

### US-HIST-002 — History isolated per project

**Jako** użytkownik **chcę**, by historia nie przenikała między projektami, **aby** undo w B nie cofało zmian z A.

**Acceptance**

- Given projekt A z niepustą historią
- When przełączam na B
- Then undo w B nie stosuje wpisów z A

**Models:** `ProjectHistory`  
**Priority:** Must  
**Depends on:** US-HIST-001, US-PROJ-002

---

## Save / Load

### US-SAVE-001 — Save project file

**Jako** użytkownik **chcę** zapisać projekt w wersjonowanym formacie, **aby** odtworzyć go później.

**Acceptance**

- Given aktywny projekt (nawet z historią sesji)
- When serializuję
- Then powstaje `ProjectFile` z `formatVersion: 2` i projektem **bez** `history`

**Models:** `ProjectFile`, `Project`  
**Priority:** Must  
**Depends on:** US-PROJ-001

### US-SAVE-002 — Load and validate project file

**Jako** użytkownik **chcę** wczytać plik projektu z walidacją, **aby** odrzucić uszkodzone dane.

**Acceptance**

- Given poprawny `ProjectFile`
- When importuję — projekt jest aktywny, `history` puste, referencje spójne
- Given niepoprawny plik
- When importuję — walidacja Zod kończy się błędem i stan aktywnego projektu nie ulega częściowemu uszkodzeniu

**Models:** `ProjectFile`  
**Priority:** Must  
**Depends on:** US-SAVE-001

### US-SAVE-003 — Project settings vs editor UI state

**Jako** użytkownik **chcę**, by ustawienia projektu (wideo/audio/output/preferences) były zapisywane, a stan paneli edytora nie, **aby** plik projektu nie zawierał efemerycznego UI.

**Acceptance**

- Given zmienione `ProjectSettings` i otwarte panele edytora
- When zapisuję
- Then plik zawiera settings; nie zawiera selection/viewport/panels

**Models:** `ProjectSettings`, `studioSession.editor`  
**Priority:** Must  
**Depends on:** US-SAVE-001

---

## Coverage map

| Area        | Story IDs        |
| ----------- | ---------------- |
| Projects    | US-PROJ-001…003  |
| Scenes      | US-SCENE-001…003 |
| Elements    | US-ELEM-001…003  |
| Groups      | US-GRP-001…002   |
| Overlays    | US-OVL-001…002   |
| Sources     | US-SRC-001…003   |
| Browser     | US-SRC-002       |
| Audio       | US-AUD-001…002   |
| Animations  | US-ANIM-001      |
| Transitions | US-TRANS-001…002 |
| Assets      | US-ASSET-001…002 |
| History     | US-HIST-001…002  |
| Save/Load   | US-SAVE-001…003  |
