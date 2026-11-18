# Output Frame

Jedna ramka projektu opisuje szerokość, wysokość i liczbę klatek. Edytor ją pokazuje. Przyszłe nagranie i transmisja mają brać ten sam kadr. Output Capture jest kontraktem. Nagrywanie i streaming nie są zaimplementowane.

## Stan wdrożenia

Wdrożone:

- `OutputProfile` w `project.settings.outputProfile` jest jedynym źródłem szerokości, wysokości i klatek.
- `OutputPreset` to cztery szablony w kodzie. Projekt zapisuje wartości profilu, nie definicję presetu.
- `outputFrame(project)` czyta aktywny profil.
- Plik projektu jest w `formatVersion: 4`. Migracja v3 nadaje `id` profilu jeden raz i zapisuje je w pliku.
- Ustawienia są w `StudioOptionsDialog`, sekcja Obraz, blok Format wyjścia.

Jeszcze nie: adaptacja scen (`preserve`, `scale-and-center`, `full-bleed`), rozdzielenie bitmapy Pixi od viewportu, benchmark, Output Capture i Recording Engine. Bitmapa renderera nadal wynika z rozmiaru panelu. Zmiana profilu nie przesuwa istniejących elementów.

## Pojęcia

- **Output Frame** — logiczna ramka: szerokość, wysokość, klatki. Czyta ją `outputFrame(project)`.
- **Output Profile** — zapisana konfiguracja tej ramki w projekcie. Jedna na projekt. Ma własne `id`.
- **Output Preset** — niemodyfikowalny szablon, z którego użytkownik wypełnia profil. Nie jest zapisywany jako profil.
- **Editor Viewport** — prostokąt CSS środkowej sekcji. Nie jest zapisaną rozdzielczością. Dopasowuje kadr i zachowuje proporcje.
- **Renderer Bitmap** — bufor Pixi. Dziś ma rozmiar hosta razy `devicePixelRatio`. To nie jest Output Profile. Polityka jakości czeka na benchmark. Drugi `Application` nie jest założeniem.
- **Output Capture** — przyszły odczyt gotowej klatki i istniejącego `getProgramStream()`. Bez implementacji, bez `MediaRecorder`.

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

Piksele programu widoczne w edytorze mają być tymi samymi pikselami przyszłego nagrania. Uchwyty i obrys zostają poza kadrem.

- `shape`, `text`, `image`, `screen` są w grafie Pixi.
- `browser` widać jako iframe i nie wchodzi do grafu. To jedyna luka treści, która blokuje pierwsze wydanie nagrywania.
- Żywa kamera, wideo, animacja, efekty i transitions nie blokują pierwszego wydania. Wolno je pokazać w podglądzie programu dopiero razem z tą samą treścią w klatce.

Dźwięk programu jest gotowy do podpięcia przez istniejące `getProgramStream()`, bez drugiego `AudioContext`.

## Dalsze etapy

1. Adaptacja scen: `preserve`, `scale-and-center`, osobny świadomy `full-bleed`.
2. Rozdzielenie bitmapy od viewportu bez zmiany dzisiejszego obrazu.
3. Benchmark 1080p, 1440p i 4K zanim wybierzemy politykę bufora.
4. Kontrakt Output Capture.
5. Recording Engine, poza tym dokumentem.
