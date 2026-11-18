# Output Capture

Jeden `Pixi Application` rysuje podgląd i kadr wyjścia. Dźwięk bierze się z istniejącego `getProgramStream()` tego samego `AudioContext`. Drugi renderer i drugi kontekst audio nie powstają.

## Kanwa

Podgląd dalej letterboxuje kadr w panelu. Bitmapa podglądu ma rozmiar viewportu razy `devicePixelRatio`.

Osobna kanwa wyjścia ma szerokość i wysokość `outputFrame`. Nie jest w layoucie edytora. Uchwyty, obrys projektu i podgląd cropu zostają poza nią: obrys jest rodzeństwem klatki, crop jest ukrywany na czas kopii.

Gdy nagranie jest włączone, silnik renderuje `rt.frame` w skali 1 do `RenderTexture` o wymiarach profilu i kopiuje teksturę na kanwę wyjścia. `captureStream` jest podpięty tylko pod tę kanwę. Żądane FPS to `outputFrame.frameRate` bez zaokrąglania. Zmierzone FPS liczą klatki skopiowane na kanwę, nie klatki enkodera.

Koszt drugiej przepustki mierzy harness `pages/dev/output-frame-benchmark`. Wynik z tego środowiska jest w [output-frame.md](./output-frame.md).

## Strumień

`OutputCapture` w `infrastructure/output/output-capture.ts` składa jeden `MediaStream`:

- ścieżka wideo z `outputCanvas.captureStream(frameRate)`,
- klon ścieżki audio z Program Mix, jeśli mikser ją ma.

Klon nie idzie na głośniki. Mikser, mute, solo, efekty i monitor zostają.

Stany: `idle`, `initializing`, `ready`, `capturing`, `stopping`, `disposed`. Zmiana sceny nie zatrzymuje capture, bo graf przebudowuje się pod spodem. `dispose` woła `stop()` tylko na ścieżce wideo capture i na klonie audio. Nie zatrzymuje urządzeń używanych przez edytor.

Brak gwarancji próbka-w-próbkę. Rozjazd jest widoczny jako różnica żądanego i zmierzonego FPS.
