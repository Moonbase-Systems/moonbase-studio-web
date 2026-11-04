# Plan prac

Studio jest edytorem dokumentu projektu. Bridge, osobna aplikacja Windows, rysuje jeden Program Output i publikuje go przez RTMP (FFmpeg). AI czyta klatki kamer i nie zapisuje dokumentu. Termin zakresu FR-02–FR-20 to 18 grudnia 2026. Zadania są w Linearze, w projektach MoonBase Studio Web, MoonBase Bridge i MoonBase AI.

W tym repozytorium działa model, komendy, undo/redo, lista scen i inspektor. Zapis JSON schodzi do IndexedDB. Podgląd w `ScenePreviewFrame` jest placeholderem edytora, nie Program Output. Porty `CompositionEngine` i `SourceProvider` nie mają implementacji. `layers/core` i pakiet `moonbase-core` to wspólna warstwa UI Nuxt, nie silnik mediów.

Testy: 78/78. Typecheck i build przechodzą. Stylelint: pusta linia przed regułą w `InspectorCardHeader.vue` i `InspectorMarqueeLabel.vue`. Prettier: `.code-workspace`, `app/constants/page-title.ts`, `layers/auth/app/models/auth-api.domain.ts`.

## Ścieżka krytyczna

- [x] Model projektu: `Source` i element sceny osobno, kolejność to indeks `scene.elements` (0 na spodzie), grupy biorą kolejność z tej tablicy (`moveLayer`, `syncGroupMemberOrder`). Historia sesji nie wchodzi do pliku. Format v2, Zod, migracja v1→v2. Model i komendy nie trzymają `MediaStream` ani DOM.
- [x] `StudioService`: sceny, warstwy, grupy, źródła, assety, undo/redo snapshotem dokumentu. UI idzie przez store. Skróty undo/redo są podpięte w studio.
- [x] Lista scen i warstw: wiele scen, przełączenie edytowanej sceny, kolejność, widoczność, blokada, grupy, transform w inspektorze (FR-05, FR-06 jako dokument).
- [~] Zapis i odczyt konfiguracji w IndexedDB: nowy, otwórz, zapisz, `markSaved`, znacznik brudnego dokumentu (FR-18). Po odczycie zostaje JSON. Bajty obrazu i animacji są `blob:` w pamięci (`holdImagePreviewUrl`, `holdAnimationPreviewUrl`), w projekcie jest samo `storageKey`.
- [ ] Tryb Standalone i Connected. Edycja, undo i zapis działają bez Bridge. Transmisja, klatka programu, monitoring i reżyser włączają się przy gotowej sesji Bridge.
- [ ] Ustawienia transmisji w dokumencie: cel, adres RTMP, klucz, rozdzielczość, klatki, bitrate (FR-02). Jeszcze bez połączenia. Dziś `ProjectOutputSettings` to opcjonalne `profile`.
- [ ] Podgląd warstw w edytorze (FR-05): `ScenePreviewFrame` maluje aktywną scenę. To podgląd Standalone, nie Program Output.
- [ ] Źródła w dokumencie (FR-04): kamera, ekran, plik wideo, obraz, źródło strumieniowe. Włączenie i wyłączenie bez kasowania definicji. Urządzenie na Programie otwiera Bridge.
- [ ] Bridge: kontrakt localhost, proces bez okna, jeden Program Output w kolejności `scene.elements`, źródła, miks, RTMP. Pauza rozłącza publikację i zostawia proces oraz projekt.
- [ ] Start, stop, pauza i wznowienie z Studio (FR-03). Studio pokazuje stan, który Bridge raportuje. Projekt zostaje.
- [ ] Przełączenie sceny na żywo (FR-06). Strumień RTMP zostaje.

## Równolegle

- [ ] Magazyn bajtów pod `storageKey`, żeby zapisany projekt otwierał obraz, wideo i animację (domknięcie FR-18).
- [ ] Import i eksport pliku projektu. `serializeProjectFile` już zwraca JSON, UI nie pobiera ani nie wczytuje pliku (FR-19).
- [~] Odtwarzacz animacji poza inspektorem: GIF, WebP, APNG, WebM i MP4 są rozpoznawane, konfiguracja once/loop, tempo, trigger i koniec jest w źródle i w pliku. Odtwarzacz obrazu nie pauzuje, nie zmienia tempa i nie zgłasza końca. Odtwarzacz wideo ma tempo, seek i koniec, głośność jest wyzerowana. Sterowanie działa, gdy otwarty jest podgląd inspektora.
- [~] Overlay, tekst, licznik, alert (FR-20). Tekst, kształt i obraz dodają się z panelu. `OverlayElement` (`lower-third`, `alert`, `counter`) jest w modelu i w schemacie, panel go nie tworzy i nie ma komend treści. Rysunek na Programie robi Bridge.
- [ ] Schemat studia: pozycje kamer w projekcie, potem `deviceId` urządzenia z Bridge (FR-07, FR-08).
- [ ] Panel dźwięku: głośność, mute, balans, equalizer, kompresor, limiter, bramka (FR-16). Przetworzenie robi miks Bridge.
- [ ] Stylelint i Prettier z listy wyżej. Nie ruszają modelu.
- [x] Testy modelu, komend, serializacji, skrótów i wykrywania pliku animacji. Nie pokrywają urządzeń, klatki programu ani transmisji.

## Później w tym samym terminie

- [ ] Monitoring FPS, bitrate, opóźnienia, zasobów i jakości łącza (FR-17). Liczby przychodzą z Bridge. Puste pole zostaje puste.
- [ ] AI: detekcja, wzrok, mowa, gest, jakość kadru, zasłonięcie, priorytet, automat i ręka operatora (FR-09–FR-15). Awaria modułu nie gasi RTMP.
- [ ] Przejścia między scenami na programie. Typy cut, fade, dissolve, slide i zoom są w modelu, nic ich nie wykonuje.
- [ ] Efekty wizualne na pikselach. Typy są (chroma, korekcja, blur, maska, cień, obrys). `InspectorCardEffects` nie dodaje efektu.
- [ ] Własny silnik animacji, klatki kluczowe, timeline, Lottie, Rive, SVG i CSS jako system animacji. Poza zakresem do 18 grudnia.

## Bramki

- Kolejność warstw zostaje indeksem `scene.elements`. Program Output nie dostaje drugiej listy.
- Undo zostaje snapshotem dokumentu. Nie wchodzi do transportu.
- Bridge dostaje cały projekt przy starcie sesji. Przyrosty schodzą później.
- Kamera i miks są na tym samym Program Output, zanim jest start RTMP.
- Zapis niesie sceny, transmisję, źródła, audio i kamery, zanim import uznajemy za przeniesienie projektu.
- Studio dostaje rzeczywisty stan RTMP, zanim panel pokazuje FPS i bitrate.
- Klatki kamer są, zanim jest detekcja. Oceny są, zanim jest automat. Ręka operatora jest, zanim zamykamy FR-15.
