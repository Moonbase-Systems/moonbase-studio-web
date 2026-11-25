# Output Frame

Jedna ramka projektu opisuje szerokość, wysokość i liczbę klatek. Edytor ją pokazuje. Lokalne nagranie bierze ten sam kadr. Transmisja RTMP nie jest zaimplementowana.

## Stan wdrożenia

Wdrożone:

- `OutputProfile` w `project.settings.outputProfile` jest jedynym źródłem szerokości, wysokości i klatek.
- `OutputPreset` to cztery szablony w kodzie. Projekt zapisuje wartości profilu, nie definicję presetu.
- `outputFrame(project)` czyta aktywny profil.
- Plik projektu jest w `formatVersion: 4`. Migracja v3 nadaje `id` profilu jeden raz i zapisuje je w pliku.
- Ustawienia są w `StudioOptionsDialog`, sekcja Obraz, blok Format wyjścia.
- Podgląd zostaje bitmapą viewportu. Kanwa wyjścia ma wymiary profilu i nie leży w layoucie edytora. Szczegóły: [output-capture.md](./output-capture.md).
- Graf rysuje shape, text, image, screen, camera, video, animation, overlay, słupki audio, cut i fade. Browser jest jawną planszą. Blur i prosta maska alfa są nakładane. Reszta efektów jest w inspektorze oznaczona jako nieaktywna.
- Lokalny zapis opisuje [recording-engine.md](./recording-engine.md).

Jeszcze nie: adaptacja scen (`preserve`, `scale-and-center`, `full-bleed`). Zmiana profilu nie przesuwa istniejących elementów. Slide, zoom i dissolve nie mają odtwarzacza. Strona browser nie jest czytana.

## Pomiar RenderTexture

Harness: `layers/studio/app/pages/dev/output-frame-benchmark.vue`. Mierzy czas przepustki `RenderTexture` plus `extract.canvas` dla 720p, 1080p, 1440p i 4K, małej sceny, 200 sprite’ów i jednego filtra, przy małym i dużym viewportcie. Pamięć GPU jest wpisywana tylko wtedy, gdy przeglądarka ją poda.

W tym środowisku pomiar nie został wykonany: brak działającego WebGL w teście jednostkowym. Nie ma tu wymyślonych czasów klatek. Po uruchomieniu strony wynik trzeba wpisać poniżej.

| Przypadek     | Mediana ms | Pamięć GPU |
| ------------- | ---------- | ---------- |
| nie zmierzono | —          | —          |

## Pojęcia

- **Output Frame** — logiczna ramka: szerokość, wysokość, klatki. Czyta ją `outputFrame(project)`.
- **Output Profile** — zapisana konfiguracja tej ramki w projekcie. Jedna na projekt. Ma własne `id`.
- **Output Preset** — niemodyfikowalny szablon, z którego użytkownik wypełnia profil. Nie jest zapisywany jako profil.
- **Editor Viewport** — prostokąt CSS środkowej sekcji. Nie jest zapisaną rozdzielczością. Dopasowuje kadr i zachowuje proporcje.
- **Renderer Bitmap** — bufor podglądu. Ma rozmiar hosta razy `devicePixelRatio`. To nie jest Output Profile. Drugi `Application` nie jest używany.
- **Output Canvas** — kanwa nagrania o wymiarach profilu, poza layoutem edytora. Wypełnia ją kopia `RenderTexture`.
- **Output Capture** — `captureStream` tej kanwy plus klon `getProgramStream()`. Opis: [output-capture.md](./output-capture.md).

`settings.output.profile` zostaje slotem transmisji. `colorSpace` zostaje w `settings.video`.

## Model

```ts
type OutputPreset = {
  id: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
};

type OutputProfile = {
  id: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
  originPresetId: string | null;
};
```

Presety: `youtube-1080p` 1920×1080, `shorts-1080` 1080×1920, `square-1080` 1080×1080, `portrait-4x5` 1080×1350, wszystkie przy 30 fps. Zastosowanie presetu kopiuje pola i `originPresetId`, a `profile.id` zostaje. Ręczna zmiana wymiarów nie czyści `originPresetId`. Zgodność z presetem liczy `matchingOutputPreset` po dokładnym `width`, `height` i `frameRate`, bez zaokrąglania. Proporcje są wyliczane.

Nowy projekt dostaje `createDefaultOutputProfile` z presetu YouTube 1080p i z nowym `id`. Każde wywołanie zwraca nowy obiekt.

## Migracja v3 → v4

Krok rusza tylko przy `formatVersion === 3`. Kopiuje `settings.video.width`, `height` i `frameRate` bez przeliczania, także 29.97. `colorSpace` zostaje. Transformy scen zostają. Gdy trójka równa się presetowi, `originPresetId` wskazuje ten preset. W przeciwnym razie jest `null`. Brak poprawnych liczb daje domyślny profil YouTube, bez ruszania reszty dokumentu. Zapisany plik v4 przy kolejnym odczycie nie generuje nowego `id`.

## Podgląd i nagranie

Piksele programu w grafie są pikselami nagrania. Uchwyty i obrys zostają poza kanwą wyjścia.

- `shape`, `text`, `image`, `screen`, `camera`, `video`, `animation` i `overlay` są w grafie. Kamera i plik wideo dzielą jeden `HTMLVideoElement` na źródło. Element wideo w grafie jest wyciszony; dźwięk nagrania to Program Mix.
- `audioVisual` nie wchodzi do grafu. Włącza kanał miksera i nie ma obrazu na podglądzie ani w nagraniu.
- `browser` widać jako iframe w edytorze. W kadrze, w prostokącie warstwy, jest plansza „Browser nie wchodzi do nagrania”. Pikseli obcej strony nie czytamy.
- Blur i maska alfa bez odwrócenia są filtrami Pixi. Pozostałe efekty inspektor oznacza jako nieaktywne.
- Cut i fade idą zegarem kompozycji. Slide, zoom i dissolve zgłaszają brak odtwarzacza i scena zmienia się od razu.

Dźwięk nagrania to istniejące `getProgramStream()`, bez drugiego `AudioContext`.

## Dalsze etapy

1. Adaptacja scen: `preserve`, `scale-and-center`, osobny świadomy `full-bleed`.
2. Odtwarzacz slide i zoom, bez dodawania GSAP, jeśli ma zostać w produkcie.
3. Lokalne strony browser same-origin. Cross-origin zostaje planszą.
4. RTMP i streaming, poza tym dokumentem.
