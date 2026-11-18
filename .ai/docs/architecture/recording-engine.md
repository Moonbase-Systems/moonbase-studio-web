# Recording Engine

`RecordingEngine` w `infrastructure/recording/` dostaje tylko `MediaStream`. Nie zna scen. Blob i `MediaRecorder` nie wchodzą do `Project`.

## Stany

`idle`, `preparing`, `recording`, `paused`, `finalizing`, `completed`, `error`.

Drugi start w trakcie nagrania jest odrzucany. `stop()` czeka na ostatnie `dataavailable`. Czas liczy `performance.now()` i stoi w pauzie.

## MIME i bitrate

`MediaRecorder.isTypeSupported` w kolejności: WebM VP9+Opus, WebM VP8+Opus, MP4 AVC+AAC. Rozszerzenie wynika z wybranego typu.

Wideo przy 1080p: Low 4, Standard 8, High 12, Very High 20 Mb/s. Inny rozmiar kadru skaluje bitrate liczbą pikseli względem 1920×1080. Audio jest osobno, 128 kb/s. FPS bierzemy z profilu. Lista 24, 25, 29.97, 30, 50, 59.94 i 60 jest dopuszczalna bez zaokrąglania; profil może nieść też inną dodatnią liczbę.

## Plik

Gdy przeglądarka ma `showSaveFilePicker`, fragmenty idą do strumienia pliku. W przeciwnym razie powstaje Blob i pobranie, a adres obiektu jest zwalniany. Anulowanie wyboru pliku nie jest zapisem.

Nazwa: oczyszczona nazwa projektu, data `RRRRMMDD-ggmmss` i rozszerzenie MIME.

Metadane (`id`, `projectId`, `fileName`, `mimeType`, `sizeBytes`, `durationMs`, `width`, `height`, `frameRate`, `createdAt`) idą do store IndexedDB `recordings` w bazie `moonbase-studio` (wersja 2). Nie ma ich w `ProjectFile` i nie ma ich w PostgreSQL. `FileSystemFileHandle` zostaje tylko tam, gdzie przeglądarka umie go odtworzyć. Brak uchwytu oznacza wpis, którego nie da się otworzyć ponownie. UI mówi to wprost.

## UI

Przycisk Record w górnym pasku uruchamia ten silnik. Stream zostaje wyłączony, dopóki nie ma Bridge. Sekcja Recording w opcjach pokazuje stan, czas, wymiary profilu, FPS żądane i zmierzone, MIME oraz bitrate. Nie ma procentu zapisu.

Usunięcie warstwy aktywnej sceny w trakcie nagrania pyta, czy zatrzymać nagranie. Reszta edytora działa.

Prawdziwe odtworzenie pliku 720p/1080p jest ręczne. Cisza `MediaRecorder` nie jest zaliczana jako sukces.
