# Ustawienia poza edytorem

Katalog pól, których nie da się zmienić w edytorze warstw. Porównanie: OBS Studio (Stream, Output, Audio, Video, Hotkeys, Advanced) i vMix (Streaming Quality, szyny audio, opóźnienie wyjścia). Z OBS i vMix dochodzą propozycje oznaczone **Propozycja**. Reszta jest w issue Linear FR-02–FR-20.

Z katalogu wypadły kontrolki, które edytor już ma: nazwa projektu i sceny, kolejność, widoczność, blokada i grupa warstw, transformacja i kadr, tekst, kształt, obraz, dopasowanie ekranu i kamery, odtwarzanie wideo i animacji, przeglądarka (adres, zoom, odświeżanie, dźwięk karty) oraz miks kanału (głośność, wzmocnienie, mute, solo, balans, monitoring, przesunięcie, equalizer, kompresor, limiter, bramka, presety, mikrofony z przeglądarki, szyna nakładek).

Kolejność idzie od tego, co operator ustawia przed startem, do pól, które zwykle zostają na wartościach domyślnych.

1. Transmisja
2. Obraz
3. Urządzenia
4. Sterowanie
5. Odczyt
6. Dźwięk
7. Nagranie
8. Tło sceny
9. Skróty
10. Połączenie

**Dostęp** mówi, kiedy pole da się ustawić.

- `Od razu` — zapis w dokumencie, bez sesji Bridge.
- `Po Bridge` — lista urządzeń albo stan wykonania przychodzi z sesji Bridge. [STU-7](https://linear.app/moonbase-systems/issue/STU-7/tryb-standalone-i-connected).

Zerwanie Bridge zostawia wartości w pliku i chowa pola `Po Bridge`.

**Wdrożenie** mówi, czy skutek da się uzyskać na kodzie studia z tego repozytorium. To osobna oś od **Dostępu**: pole może być „od razu” w dokumencie i jednocześnie czekać na przebudowę potoku.

- `Działa` — mechanizm już chodzi. Zostaje wystawić go w oknie albo pod skrót.
- `Od razu` — skutek da się dopiąć do podglądu, dokumentu albo istniejącej komendy, bez potoku Bridge.
- `Przebudowa` — skutek wymaga nowego potoku. Sam zapis w pliku go nie uruchamia.

Podgląd czyta wymiary kanwy i rysuje `SceneBackground`. Ekran ma żywy strumień `getDisplayMedia`, mikrofon przeglądarki jest w inspektorze. `updateProject` zapisuje ustawienia wideo i audio. Pasek trzyma `bridgeOnline` na `false`. Nie ma klienta RTMP, kodera, nagrywania programu ani odczytu procesu. `AudioContext` startuje bez częstotliwości z projektu. `syncOffsetMs` jest w mikserze i graf go nie stosuje. Kamera w Pixi jest placeholderem, żywy obraz ma tylko ekran.

## 1. Transmisja

Pola z [STU-8](https://linear.app/moonbase-systems/issue/STU-8/fr-02-ustawienia-transmisji-w-dokumencie), uzupełnione o koder z OBS i vMix. Zapis nie otwiera połączenia. Start jest w sterowaniu.

### Cel

| Właściwość  | Typ   | Zakres                                    | Domyślnie | Dostęp  | Wdrożenie                                                             |
| ----------- | ----- | ----------------------------------------- | --------- | ------- | --------------------------------------------------------------------- |
| `target`    | enum  | `custom`, `twitch`, `youtube`, `kick`     | `custom`  | Od razu | Przebudowa. Nie ma modelu celu ani listy ingestów.                    |
| `serverUrl` | tekst | adres RTMP, na przykład `rtmp://host/app` | pusty     | Od razu | Przebudowa. Brak klienta RTMP, który by ten adres otworzył.           |
| `streamKey` | tekst | klucz z panelu platformy                  | pusty     | Od razu | Przebudowa. Brak klienta RTMP. Klucz zostaje poza podglądem i logiem. |

`custom` to własny serwer RTMP. Dla platformy z listy `serverUrl` można wypełnić z wybranego ingestu, a operator i tak może go nadpisać. Klucz nie wchodzi do podglądu ani do logu sesji.

### Jakość

| Właściwość             | Typ          | Zakres                     | Domyślnie | Dostęp  | Wdrożenie                                                                              |
| ---------------------- | ------------ | -------------------------- | --------- | ------- | -------------------------------------------------------------------------------------- |
| `videoBitrateKbps`     | liczba, kb/s | 1…20000                    | 6000      | Od razu | Przebudowa. Nic w studiu nie koduje obrazu.                                            |
| `frameRate`            | liczba, kl/s | zgodne z kanwą albo niższe | 30        | Od razu | Przebudowa. To klatki strumienia. Sufit przechwycenia ekranu jest osobno, przy kanwie. |
| `enforceServiceLimits` | bool         | tak / nie                  | tak       | Od razu | Przebudowa. Nie ma sufitów platform ani kodera, który by je zastosował.                |
| `rateControl`          | enum         | `cbr`                      | `cbr`     | Od razu | Przebudowa. Wartość jest jedna i nie ma kodera, który trzymałby CBR.                   |
| `keyframeIntervalSec`  | liczba, s    | 1–4                        | 2         | Od razu | Przebudowa. Interwał należy do kodera.                                                 |

`cbr` trzyma stały bitrate, którego wymagają Twitch, YouTube i Kick. Interwał klatek kluczowych 2 s jest wspólnym wymaganiem tych platform. `enforceServiceLimits` obcina bitrate do sufitu wybranego `target`.

### Koder

| Właściwość      | Typ  | Zakres                                                  | Domyślnie                        | Dostęp    | Wdrożenie                                          |
| --------------- | ---- | ------------------------------------------------------- | -------------------------------- | --------- | -------------------------------------------------- |
| `encoder`       | enum | `auto`, `x264`, `nvenc`, `amf`, `qsv`, `videotoolbox`   | `auto`                           | Po Bridge | Przebudowa. Lista koderów jest na maszynie Bridge. |
| `encoderPreset` | enum | `ultrafast`…`slow` dla x264; preset jakości dla sprzętu | `veryfast` / odpowiednik jakości | Po Bridge | Przebudowa. Preset idzie razem z koderem Bridge.   |

`auto` bierze pierwszy koder sprzętowy, a w razie braku schodzi na x264. Lista koderów zależy od maszyny, na której stoi Bridge, dlatego wybór czeka na sesję.

## 2. Obraz

### Kanwa

Źródło: model `ProjectVideoSettings`. Podgląd czyta te liczby, edytor ich nie wystawia. Kanwa jest ramką kompozycji. Warstwy układają się w tych wymiarach.

| Właściwość  | Typ          | Zakres | Domyślnie | Dostęp  | Wdrożenie                                                                                                                                                                                   |
| ----------- | ------------ | ------ | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`     | liczba, px   | > 0    | 1920      | Od razu | Od razu. `updateProject` zapisuje szerokość, ramka podglądu liczy z niej proporcje. Render Pixi trzeba odpalić także przy zmianie `settings.video`, bo dziś idzie tylko przy zmianie sceny. |
| `height`    | liczba, px   | > 0    | 1080      | Od razu | Od razu. Tak samo jak `width`.                                                                                                                                                              |
| `frameRate` | liczba, kl/s | > 0    | 30        | Od razu | Od razu jako sufit klatek `getDisplayMedia`. Kompozycja rysuje się w takt przeglądarki.                                                                                                     |

### Rozdzielczość wyjścia

**Propozycja** z OBS (Output / Scaled Resolution) i vMix (Encode Size). Osobna od kanwy, żeby 1080p w edytorze mogło zejść do 720p na strumieniu. Skutek na obrazie programu jest po Bridge. Wartość zapisuje się wcześniej.

| Właściwość     | Typ        | Zakres               | Domyślnie      | Dostęp  | Wdrożenie                                                               |
| -------------- | ---------- | -------------------- | -------------- | ------- | ----------------------------------------------------------------------- |
| `outputWidth`  | liczba, px | > 0, proporcje kanwy | równe `width`  | Od razu | Przebudowa. Podgląd zna tylko kanwę. Skala wyjścia jest krokiem kodera. |
| `outputHeight` | liczba, px | > 0, proporcje kanwy | równe `height` | Od razu | Przebudowa. Tak samo jak `outputWidth`.                                 |

### Kolor

`colorSpace` jest w modelu projektu. Format i zakres to **propozycja** z OBS Advanced. Dotyczą kodera RTMP, nie podglądu w przeglądarce. `partial` to zakres ograniczony, którego oczekują Twitch, YouTube i Kick. `full` rozjaśnia czerń i biel, gdy odbiorca też czyta pełny zakres.

| Właściwość    | Typ   | Zakres                 | Domyślnie | Dostęp  | Wdrożenie                                                                                  |
| ------------- | ----- | ---------------------- | --------- | ------- | ------------------------------------------------------------------------------------------ |
| `colorSpace`  | tekst | dowolny identyfikator  | puste     | Od razu | Pole jest w pliku i podgląd go nie czyta. Skutek na obrazie programu to przebudowa kodera. |
| `colorFormat` | enum  | `NV12`, `I420`, `I444` | `NV12`    | Od razu | Przebudowa. Format należy do ramki kodera.                                                 |
| `colorRange`  | enum  | `partial`, `full`      | `partial` | Od razu | Przebudowa. Zakres należy do ramki kodera.                                                 |

## 3. Urządzenia

Lista pochodzi z Bridge. Definicja źródła (nazwa, typ, włączenie) zostaje w dokumencie. Wybór fizycznego urządzenia czeka na sesję.

### Mikrofon programu

[STU-29](https://linear.app/moonbase-systems/issue/STU-29/fr-16-miks-programu). Inspektor już wybiera mikrofon przeglądarki do podglądu. To pole jest wejściem miksu programu w Bridge. Utrata mikrofonu nie zatrzymuje obrazu.

| Właściwość           | Typ   | Zakres                       | Domyślnie | Dostęp    | Wdrożenie                                                                                                        |
| -------------------- | ----- | ---------------------------- | --------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| `programMicDeviceId` | tekst | wejście audio z listy Bridge | puste     | Po Bridge | Przebudowa. Mikrofon podglądu już działa przez `getUserMedia` w inspektorze. To pole jest wejściem miksu Bridge. |

### Kamera

[STU-26](https://linear.app/moonbase-systems/issue/STU-26/fr-04-zrodla-na-programie), [STU-65](https://linear.app/moonbase-systems/issue/STU-65/linux-kamera-v4l2). Źródło kamery na scenie 2D. Lista urządzeń przychodzi z Bridge. Na Linuxie `deviceId` to ścieżka `/dev/v4l/by-id/...`. Brak urządzenia jest błędem źródła, program jedzie dalej.

| Właściwość           | Typ   | Zakres                                        | Domyślnie | Dostęp    | Wdrożenie                                                                              |
| -------------------- | ----- | --------------------------------------------- | --------- | --------- | -------------------------------------------------------------------------------------- |
| `deviceId`           | tekst | pozycja z listy kamer Bridge                  | puste     | Po Bridge | Przebudowa. Model ma `deviceId`, Pixi rysuje placeholder. Żywego obrazu kamery nie ma. |
| `audioInputDeviceId` | tekst | wejście audio tej kamery albo osobny mikrofon | puste     | Po Bridge | Przebudowa. To dźwięk kamery z Bridge. Mikrofon przeglądarki jest osobną ścieżką.      |

### Ekran

[STU-26](https://linear.app/moonbase-systems/issue/STU-26/fr-04-zrodla-na-programie), [STU-66](https://linear.app/moonbase-systems/issue/STU-66/linux-ekran-przez-portal-screencast-i-pipewire). `captureTarget` jest wskazówką w dokumencie. Konkretny ekran wybiera się z listy. `restoreToken` pomija dialog zgody przy kolejnej sesji na Linuxie.

| Właściwość      | Typ   | Zakres                         | Domyślnie | Dostęp    | Wdrożenie                                                                                            |
| --------------- | ----- | ------------------------------ | --------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `captureTarget` | enum  | `display`, `window`            | `display` | Od razu   | Od razu jako zapis w `ScreenSourceSettings`. `getDisplayMedia` i tak otwiera własny wybór operatora. |
| `displayId`     | tekst | ekran albo okno z listy Bridge | puste     | Po Bridge | Przebudowa. Żywy ekran w studiu to strumień trzymany przy inspektorze, nie `displayId`.              |
| `restoreToken`  | tekst | token portalu, tylko Linux     | pusty     | Po Bridge | Przebudowa. Token portalu należy do Bridge na Linuxie.                                               |

## 4. Sterowanie

Akcje, nie pola dokumentu. [STU-19](https://linear.app/moonbase-systems/issue/STU-19/fr-03-sterowanie-transmisja). Wszystkie `Po Bridge`. Przycisk pokazuje stan zgłoszony przez Bridge (`connected` albo `error`), nie samo kliknięcie.

| Akcja              | Skutek                                                           | Wdrożenie                                                                                                 |
| ------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Start              | Publikuje Program Output i miks na `serverUrl` oraz `streamKey`. | Przebudowa. Przycisk Stream jest na pasku, `bridgeOnline` stoi na `false`, wywołania publikacji nie ma.   |
| Pauza              | Rozłącza publikację, zostawia proces i projekt.                  | Przebudowa. Nie ma sesji publikacji, którą da się rozłączyć.                                              |
| Wznowienie         | Łączy się tym samym adresem i kluczem.                           | Przebudowa. Wraz ze startem.                                                                              |
| Stop               | Zostawia proces i dokument. Adres i klucz zostają.               | Przebudowa. Wraz ze startem.                                                                              |
| Przełączenie sceny | Zmienia kompozycję programu bez zrywania RTMP.                   | Zmiana sceny w edytorze działa (`setActiveScene`). Przełączenie programu bez zrywania RTMP to przebudowa. |

## 5. Odczyt

[STU-18](https://linear.app/moonbase-systems/issue/STU-18/fr-17-panel-monitorowania), [STU-31](https://linear.app/moonbase-systems/issue/STU-31/fr-17-liczby-z-wykonania). Studio ich nie wpisuje. Brak pomiaru zostaje pustym polem. Dostęp: `Po Bridge`.

| Odczyt            | Jednostka                    | Źródło        | Wdrożenie                                                          |
| ----------------- | ---------------------------- | ------------- | ------------------------------------------------------------------ |
| Jakość połączenia | skala zgłoszona przez Bridge | stan RTMP     | Przebudowa. Nie ma sesji RTMP, z której da się wziąć skalę.        |
| Bitrate           | kb/s                         | postęp FFmpeg | Przebudowa. Nie ma postępu FFmpeg.                                 |
| FPS renderu       | kl/s                         | proces Bridge | Przebudowa. Podgląd w przeglądarce ma własny takt, to inna liczba. |
| Opóźnienie        | ms                           | postęp FFmpeg | Przebudowa. Nie ma postępu FFmpeg.                                 |
| CPU               | procent                      | proces        | Przebudowa. Studio nie czyta procesu Bridge.                       |
| Pamięć            | MB                           | proces        | Przebudowa. Studio nie czyta procesu Bridge.                       |

## 6. Dźwięk

### Bitrate strumienia

**Propozycja** z OBS (Audio Bitrate) i vMix (Audio Bit Rate). Linear mówi o jednym bitrate transmisji. To pole jest osobno od wideo. 160 kb/s to sufit Twitcha dla AAC. vMix przyjmuje od 64 kb/s.

| Właściwość         | Typ          | Zakres | Domyślnie | Dostęp  | Wdrożenie                                                          |
| ------------------ | ------------ | ------ | --------- | ------- | ------------------------------------------------------------------ |
| `audioBitrateKbps` | liczba, kb/s | 64–320 | 160       | Od razu | Przebudowa. Bitrate AAC należy do kodera, graf podglądu go nie ma. |
| `audioCodec`       | enum         | `aac`  | `aac`     | Od razu | Przebudowa. Kodek należy do kodera.                                |

### Format sygnału

Źródło: model `ProjectAudioSettings`. Brak kontrolki w edytorze.

| Właściwość   | Typ        | Zakres           | Domyślnie | Dostęp  | Wdrożenie                                                                                                                                                                                                           |
| ------------ | ---------- | ---------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sampleRate` | liczba, Hz | 44100 albo 48000 | 48000     | Od razu | Liczba jest w `ProjectAudioSettings` i da się ją zapisać przez `updateProject`. `AudioContext` startuje bez niej, więc przeglądarka zostawia własną częstotliwość. Pewny skutek na strumieniu to przebudowa kodera. |
| `channels`   | liczba     | 1 albo 2         | 2         | Od razu | Liczba jest w modelu. Graf nie ustawia `channelCount`. Mono na wyjściu to przebudowa grafu.                                                                                                                         |

### Wyjście odsłuchu

**Propozycja** z OBS (Audio Monitoring Device). Monitoring kanału jest już w inspektorze. Tu wybiera się urządzenie, na które ten odsłuch idzie.

| Właściwość        | Typ                      | Zakres                     | Domyślnie         | Dostęp    | Wdrożenie                                                     |
| ----------------- | ------------------------ | -------------------------- | ----------------- | --------- | ------------------------------------------------------------- |
| `monitorDeviceId` | identyfikator urządzenia | lista wyjść audio z Bridge | wyjście systemowe | Po Bridge | Przebudowa. Odsłuch idzie na domyślne wyjście `AudioContext`. |

### Opóźnienie względem obrazu

**Propozycja** z vMix (External Output → Audio Delay). Przesunięcie kanału jest już w inspektorze. To pole przesuwa cały miks względem obrazu programu. Dodatnia wartość opóźnia dźwięk, gdy głos wyprzedza usta.

| Właściwość            | Typ        | Zakres     | Domyślnie | Dostęp  | Wdrożenie                                                                                                                             |
| --------------------- | ---------- | ---------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `programAudioDelayMs` | liczba, ms | −1000…1000 | 0         | Od razu | Przebudowa grafu. `syncOffsetMs` kanału jest zapisany, a silnik go pomija. Opóźnienie całego miksu to osobny stopień, którego nie ma. |

## 7. Nagranie

**Propozycja.** Przycisk nagrywania jest na pasku i jest wyłączony. OBS i vMix nagrywają ten sam Program Output osobnym koderem, bez zrywania RTMP. `mkv` przeżywa przerwanie procesu. `mp4` jest wygodniejszy do odtworzenia i psuje się, gdy zapis urwie się w połowie pliku.

| Właściwość             | Typ          | Zakres                                                  | Domyślnie                | Dostęp    | Wdrożenie                                                             |
| ---------------------- | ------------ | ------------------------------------------------------- | ------------------------ | --------- | --------------------------------------------------------------------- |
| `quality`              | enum         | `same-as-stream`, `high`, `indistinguishable`           | `same-as-stream`         | Od razu   | Przebudowa. Nie ma kodera pliku, któremu da się podać jakość.         |
| `recordingPath`        | ścieżka      | katalog zapisu na maszynie Bridge                       | katalog domowy operatora | Po Bridge | Przebudowa. Ścieżka jest na maszynie Bridge, studio jej nie zapisuje. |
| `container`            | enum         | `mp4`, `mkv`, `mov`                                     | `mkv`                    | Od razu   | Przebudowa. Wybór kontenera należy do kodera pliku.                   |
| `filenamePattern`      | tekst        | wzorzec z datą, na przykład `%CCYY-%MM-%DD_%hh-%mm-%ss` | data i godzina           | Od razu   | Przebudowa. Wzorzec nazywa plik, którego zapis jeszcze nie istnieje.  |
| `overwrite`            | bool         | tak / nie                                               | nie                      | Od razu   | Przebudowa. Wraz z zapisem pliku.                                     |
| `recordingBitrateKbps` | liczba, kb/s | używane, gdy `quality` nie jest `same-as-stream`        | 15000                    | Od razu   | Przebudowa. Bitrate należy do kodera pliku.                           |
| `recordingEncoder`     | enum         | te same kodery co transmisja                            | `auto`                   | Po Bridge | Przebudowa. Ta sama lista koderów co transmisja, na maszynie Bridge.  |

## 8. Tło sceny

Model `SceneBackground`. Renderer je rysuje, panelu nie ma.

| Właściwość | Typ                         | Zakres                   | Domyślnie | Dostęp  | Wdrożenie                                                                                       |
| ---------- | --------------------------- | ------------------------ | --------- | ------- | ----------------------------------------------------------------------------------------------- |
| `kind`     | enum                        | `none`, `color`, `image` | `none`    | Od razu | Od razu. Pixi rysuje `SceneBackground` przy renderze sceny. Brakuje komendy, która zapisze tło. |
| `color`    | kolor                       | gdy `kind` = `color`     | —         | Od razu | Od razu. Wraz z `kind`.                                                                         |
| `assetId`  | identyfikator assetu obrazu | gdy `kind` = `image`     | —         | Od razu | Od razu. Renderer bierze adres assetu tą samą ścieżką co obraz warstwy.                         |

## 9. Skróty

`mod` to Ctrl na Windows i Linux oraz Cmd na macOS. Jeden skrót należy do jednej akcji. Push-to-talk i push-to-mute wykluczają się na tym samym kanale. Shift+strzałki są zajęte przez kolejność warstw, więc przesuwanie o większy krok idzie na Alt+strzałki.

### Już w edytorze

Wiązania z `layers/studio/app/config/keyboard-shortcuts.ts` oraz gesty płótna.

| Akcja                              | Skrót                        | Dostęp  | Wdrożenie                                    |
| ---------------------------------- | ---------------------------- | ------- | -------------------------------------------- |
| Cofnij                             | `mod`+Z                      | Od razu | Działa                                       |
| Ponów                              | `mod`+Y                      | Od razu | Działa                                       |
| Zmień nazwę sceny lub warstwy      | F2                           | Od razu | Działa                                       |
| Zatwierdź nazwę                    | Enter                        | Od razu | Działa                                       |
| Anuluj nazwę                       | Escape                       | Od razu | Działa                                       |
| Dodaj do zaznaczenia               | `mod`+klik                   | Od razu | Działa                                       |
| Zaznacz zakres                     | Shift+klik                   | Od razu | Działa                                       |
| Warstwa wyżej                      | Shift+↑ oraz `mod`+]         | Od razu | Działa                                       |
| Warstwa niżej                      | Shift+↓ oraz `mod`+[         | Od razu | Działa                                       |
| Anuluj gest na płótnie             | Escape                       | Od razu | Działa. Gest jest w `SceneTransformOverlay`. |
| Obrót                              | Alt+przeciągnięcie narożnika | Od razu | Działa. Gest jest w `SceneTransformOverlay`. |
| Kadr                               | Alt+przeciągnięcie boku      | Od razu | Działa. Gest jest w `SceneTransformOverlay`. |
| Krok obrotu                        | Shift w trakcie obrotu       | Od razu | Działa. Gest jest w `SceneTransformOverlay`. |
| Zachowaj proporcje przy skalowaniu | Shift w trakcie skalowania   | Od razu | Działa. Gest jest w `SceneTransformOverlay`. |
| Wyłącz przyciąganie                | Ctrl w trakcie przeciągania  | Od razu | Działa. Gest jest w `SceneTransformOverlay`. |

### Brakuje w edytorze

Akcja jest w menu, na liście albo na pasku. Klawisza nie ma. Proponowany skrót da się później podmienić w tym samym pliku wiązań.

| Akcja                           | Proponowany skrót                   | Dostęp  | Wdrożenie                                                   |
| ------------------------------- | ----------------------------------- | ------- | ----------------------------------------------------------- |
| Zapisz projekt                  | `mod`+S                             | Od razu | Od razu. `saveProject` już jest.                            |
| Otwórz projekt                  | `mod`+O                             | Od razu | Od razu. `requestOpen` już jest.                            |
| Usuń zaznaczoną warstwę         | Delete                              | Od razu | Od razu. `removeLayer` już jest.                            |
| Duplikuj warstwę                | `mod`+D                             | Od razu | Od razu. `duplicateLayer` już jest.                         |
| Nowa scena                      | `mod`+Shift+N                       | Od razu | Od razu. `createScene` już jest.                            |
| Wycisz / włącz kanał audio      | `mod`+Shift+M                       | Od razu | Od razu. `updateAudioChannel` przyjmuje `muted`.            |
| Pokaż / ukryj warstwę           | `mod`+Shift+H                       | Od razu | Od razu. `setLayerVisibility` już jest.                     |
| Zablokuj / odblokuj warstwę     | `mod`+Shift+L                       | Od razu | Od razu. `setLayerLocked` już jest.                         |
| Zaznacz wszystkie warstwy sceny | `mod`+A                             | Od razu | Od razu. `setSelectedLayers` już jest.                      |
| Przesuń o 1 px                  | strzałki, gdy fokus jest na płótnie | Od razu | Od razu. `updateLayer` zmienia transform. Brakuje klawisza. |
| Przesuń o 10 px                 | Alt+strzałki                        | Od razu | Od razu. Wraz z przesunięciem o 1 px.                       |
| Na wierzch                      | `mod`+Shift+]                       | Od razu | Od razu. `moveLayerRelative` ma kierunek `top`.             |
| Pod spód                        | `mod`+Shift+[                       | Od razu | Od razu. `moveLayerRelative` ma kierunek `bottom`.          |
| Grupuj                          | `mod`+G                             | Od razu | Od razu. `createGroupFromElements` już jest.                |
| Rozgrupuj                       | `mod`+Shift+G                       | Od razu | Od razu. `dissolveGroup` już jest.                          |

### Transmisja

Tych akcji nie ma w edytorze. Działają po sesji Bridge.

| Akcja                            | Proponowany skrót                   | Dostęp    | Wdrożenie                                                                                                   |
| -------------------------------- | ----------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| Start transmisji                 | `mod`+Shift+Enter                   | Po Bridge | Przebudowa. Nie ma akcji publikacji, do której da się podpiąć klawisz.                                      |
| Stop transmisji                  | `mod`+Shift+Backspace               | Po Bridge | Przebudowa. Wraz ze startem.                                                                                |
| Pauza / wznowienie               | `mod`+Shift+P                       | Po Bridge | Przebudowa. Wraz ze startem.                                                                                |
| Przełączenie na następną scenę   | `mod`+→                             | Po Bridge | Skrót edytora jest od razu (`setActiveScene` i lista scen). Scena programu bez zrywania RTMP to przebudowa. |
| Przełączenie na poprzednią scenę | `mod`+←                             | Po Bridge | Tak samo jak następna scena.                                                                                |
| Start / stop nagrania            | `mod`+Shift+R                       | Po Bridge | Przebudowa. Nie ma nagrywania, do którego da się podpiąć klawisz.                                           |
| Push-to-talk zaznaczonego kanału | przytrzymanie przypisanego klawisza | Po Bridge | Od razu na kanale podglądu, bo `muted` już jest. Tor programu Bridge to przebudowa.                         |
| Push-to-mute zaznaczonego kanału | przytrzymanie przypisanego klawisza | Po Bridge | Od razu na kanale podglądu, tak samo jak push-to-talk.                                                      |

## 10. Połączenie

**Propozycja** z OBS Advanced. Działa w trakcie sesji RTMP. Tu trafiają pola, których domyślne wartości wystarczają, dopóki strumień nie zrywa albo obraz nie wychodzi za wcześnie.

### Ponowne łączenie

Błąd serwera zostaje osobnym stanem. Kolejne próby nie zamieniają się w potwierdzenie, że strumień żyje.

| Właściwość         | Typ       | Zakres                     | Domyślnie | Dostęp  | Wdrożenie                                                        |
| ------------------ | --------- | -------------------------- | --------- | ------- | ---------------------------------------------------------------- |
| `reconnectEnabled` | bool      | tak / nie                  | tak       | Od razu | Przebudowa. Nie ma sesji RTMP, która by wznawiała połączenie.    |
| `retryDelaySec`    | liczba, s | 1–60                       | 2         | Od razu | Przebudowa. Wraz ze wznawianiem.                                 |
| `maxRetries`       | liczba    | 0–100, 0 znaczy bez limitu | 20        | Od razu | Przebudowa. Wraz ze wznawianiem.                                 |
| `dynamicBitrate`   | bool      | tak / nie                  | nie       | Od razu | Przebudowa. Schodzenie z bitrate wymaga kodera i pomiaru zatoru. |

`dynamicBitrate` schodzi z `videoBitrateKbps` przy zatorze zamiast gubić klatki i wraca do ustawionej wartości, gdy łącze nadąża.

### Opóźnienie emisji

0 wyłącza opóźnienie. Wartość powyżej 0 trzyma obraz i dźwięk w pamięci Bridge, zanim wyjdą na RTMP. `preserveDelayOnReconnect` nie skraca opóźnienia po powrocie połączenia. Zmiana wymaga nowego startu.

| Właściwość                 | Typ       | Zakres    | Domyślnie | Dostęp  | Wdrożenie                                                         |
| -------------------------- | --------- | --------- | --------- | ------- | ----------------------------------------------------------------- |
| `streamDelaySec`           | liczba, s | 0–1800    | 0         | Od razu | Przebudowa. Bufor emisji jest w pamięci Bridge, studio go nie ma. |
| `preserveDelayOnReconnect` | bool      | tak / nie | tak       | Od razu | Przebudowa. Wraz z buforem emisji.                                |

### Interfejs sieciowy

Puste `bindAddress` zostawia wybór interfejsu systemowi. Lista adresów przychodzi z Bridge.

| Właściwość    | Typ   | Zakres                                | Domyślnie | Dostęp    | Wdrożenie                                                              |
| ------------- | ----- | ------------------------------------- | --------- | --------- | ---------------------------------------------------------------------- |
| `bindAddress` | tekst | adres lokalnego interfejsu albo puste | puste     | Po Bridge | Przebudowa. Lista interfejsów i wiązanie gniazda są po stronie Bridge. |
