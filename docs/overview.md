# Architektura Systemu MoonBase Studio

**MoonBase Studio** to webowa aplikacja przeznaczona do kompleksowego przygotowywania, zarządzania i realizowania transmisji audiowizualnych na żywo. System został zaprojektowany jako modularne środowisko pracy, łączące funkcjonalności klasycznych narzędzi do realizacji transmisji z mechanizmami automatyzacji oraz analizy obrazu i dźwięku z wykorzystaniem algorytmów sztucznej inteligencji.

Głównym założeniem projektu jest stworzenie zintegrowanej przestrzeni roboczej, w której użytkownik może zarządzać źródłami multimedialnymi, budować kompozycje wizualne, konfigurować parametry dźwięku, przygotowywać wiele scen transmisyjnych oraz kontrolować przebieg transmisji z jednego interfejsu. System ma również umożliwiać automatyczne wspomaganie operatora w wyborze odpowiedniego ujęcia na podstawie analizy obrazu pochodzącego z podłączonych kamer.

Architektura aplikacji opiera się na rozdzieleniu warstwy prezentacji, logiki aplikacyjnej, modelu projektu oraz mechanizmów odpowiedzialnych za przetwarzanie i renderowanie mediów. Takie podejście pozwala na niezależny rozwój poszczególnych części systemu oraz ułatwia jego dalszą rozbudowę.

## 1. Główne moduły systemu

System MoonBase Studio składa się z kilku współpracujących ze sobą modułów funkcjonalnych. Każdy z nich odpowiada za określony obszar działania aplikacji, a ich integracja umożliwia przygotowanie i realizację kompletnej transmisji.

### 1.1. Interfejs użytkownika — `moonbase-studio-ui`

Jest to główna warstwa aplikacji, z którą bezpośrednio pracuje operator transmisji. Odpowiada za prezentację dostępnych funkcjonalności, obsługę interakcji użytkownika oraz wizualizację aktualnego stanu projektu.

Interfejs powinien zapewniać dostęp do najważniejszych obszarów roboczych:

- **Edytor scen:** przestrzeń umożliwiająca rozmieszczanie, skalowanie i konfigurowanie elementów wizualnych oraz multimedialnych.
- **Panel warstw:** prezentacja elementów należących do aktualnie edytowanej sceny wraz z możliwością zmiany ich kolejności.
- **Panel źródeł:** zarządzanie urządzeniami wejściowymi, plikami multimedialnymi oraz innymi źródłami wykorzystywanymi w projekcie.
- **Panel scen:** tworzenie, organizowanie i przełączanie przygotowanych scen transmisyjnych.
- **Mikser audio:** kontrolowanie poziomów głośności, wyciszania oraz parametrów przetwarzania poszczególnych kanałów dźwiękowych.
- **Panel monitorowania:** prezentacja aktualnych parametrów technicznych transmisji i działania aplikacji.

Interfejs powinien umożliwiać wykonywanie operacji na projekcie bez konieczności bezpośredniego zarządzania wewnętrznymi mechanizmami przetwarzania mediów.

### 1.2. Warstwa logiki aplikacyjnej — `moonbase-application`

Warstwa logiki aplikacyjnej odpowiada za realizację operacji wykonywanych przez użytkownika oraz zarządzanie przepływem danych pomiędzy interfejsem, modelem projektu i pozostałymi modułami systemu.

Jej zadaniem jest centralizacja operacji modyfikujących konfigurację studia. Zamiast bezpośredniego zmieniania danych przez poszczególne elementy interfejsu, aplikacja wykorzystuje dedykowane operacje i komendy.

Do podstawowych odpowiedzialności tej warstwy należą:

- zarządzanie scenami i ich elementami;
- dodawanie, usuwanie i konfigurowanie źródeł multimedialnych;
- zmiana właściwości elementów wizualnych;
- zarządzanie ustawieniami transmisji i audio;
- obsługa zapisywania oraz odczytywania projektów;
- zarządzanie historią zmian z wykorzystaniem mechanizmów Undo/Redo;
- przekazywanie odpowiednich operacji do warstwy wykonawczej systemu.

Rozdzielenie logiki aplikacyjnej od interfejsu pozwala na zachowanie spójności danych oraz ogranicza bezpośrednie zależności pomiędzy poszczególnymi modułami.

### 1.3. Model projektu — `moonbase-project-model`

Model projektu stanowi strukturę danych opisującą kompletną konfigurację przygotowanego studia transmisyjnego. Przechowuje informacje niezbędne do odtworzenia układu pracy aplikacji po jej ponownym uruchomieniu.

W jego skład wchodzą między innymi:

- **Project:** główny obiekt reprezentujący projekt transmisyjny.
- **Scenes:** zbiór scen wraz z ich indywidualnymi konfiguracjami.
- **Layers:** elementy wizualne i multimedialne umieszczone w poszczególnych scenach.
- **Sources:** definicje źródeł obrazu, dźwięku i innych zasobów wykorzystywanych przez elementy scen.
- **Audio Configuration:** ustawienia kanałów audio oraz parametrów ich przetwarzania.
- **Stream Settings:** konfiguracja parametrów transmisji strumieniowej.
- **Camera Configuration:** logiczne przypisania kamer i ich ustawienia.
- **Project Settings:** pozostałe ustawienia związane z funkcjonowaniem projektu.

Model projektu powinien być niezależny od bieżącego stanu wykonawczego aplikacji. Oznacza to, że przechowywane dane opisują konfigurację studia, natomiast obiekty wykorzystywane bezpośrednio do przechwytywania i renderowania mediów są zarządzane przez odpowiednie mechanizmy wykonawcze.

### 1.4. Silnik wykonawczy — MoonBase Bridge

MoonBase Bridge jest osobną aplikacją na Windows, którą operator pobiera i uruchamia. Nie ma okna operatora. Realizuje konfigurację przygotowaną w edytorze oraz komunikuje się z urządzeniami i źródłami multimedialnymi. Jeden Program Output zasila klatkę programu w Studio i publikację RTMP.

Pakiet `moonbase-core` w tym repozytorium to wspólna warstwa UI Nuxt. Nie jest silnikiem mediów.

Do podstawowych obszarów odpowiedzialności silnika należą:

- obsługa źródeł obrazu i dźwięku;
- przechwytywanie obrazu z urządzeń wejściowych;
- obsługa plików multimedialnych;
- zarządzanie odtwarzaniem zasobów animowanych;
- renderowanie elementów składających się na scenę;
- generowanie końcowego obrazu transmisji;
- obsługa przełączania pomiędzy scenami;
- współpraca z mechanizmami odpowiedzialnymi za przesyłanie strumienia.

Silnik powinien pozostawać oddzielony od warstwy interfejsu i logiki aplikacyjnej. Komunikacja pomiędzy nimi powinna odbywać się poprzez zdefiniowane interfejsy, co umożliwia niezależny rozwój obu części systemu.

### 1.5. Moduł analizy obrazu i automatyzacji — `moonbase-ai`

Moduł sztucznej inteligencji odpowiada za analizę obrazu pochodzącego z aktywnych kamer oraz dostarczanie informacji wykorzystywanych przez mechanizmy automatycznego sterowania transmisją.

Jego zadaniem jest wspomaganie operatora w podejmowaniu decyzji dotyczących wyboru odpowiedniego ujęcia. Analiza może obejmować:

- wykrywanie obecności określonych obiektów w kadrze;
- analizę zachowania obserwowanych osób;
- wykrywanie kierunku patrzenia;
- identyfikowanie momentu wypowiadania się konkretnej osoby;
- analizę podstawowych gestów;
- ocenę jakości aktualnego kadru;
- wykrywanie zasłonięcia lub nieprawidłowego działania kamery.

Na podstawie uzyskanych informacji system może porównywać dostępne ujęcia i wskazywać kamerę zapewniającą najlepszy aktualnie obraz. Mechanizm automatycznego wyboru powinien uwzględniać również priorytety kamer zdefiniowane przez użytkownika oraz umożliwiać ręczne przejęcie kontroli nad wyborem ujęcia. Moduł nie zapisuje dokumentu projektu i nie otwiera urządzeń. Rekomendacja idzie poleceniem do Bridge.

### 1.6. Moduł transmisji strumieniowej — `moonbase-streaming`

Moduł transmisji odpowiada za przygotowanie i obsługę połączenia sieciowego wykorzystywanego do przesyłania końcowego obrazu i dźwięku do wybranego miejsca docelowego.

Jego podstawowe zadania obejmują:

- konfigurację docelowego miejsca transmisji;
- obsługę adresu serwera odbierającego strumień;
- konfigurację parametrów jakościowych transmisji;
- przygotowanie połączenia RTMP przez FFmpeg w Bridge;
- rozpoczynanie i zatrzymywanie transmisji;
- obsługę tymczasowego wstrzymywania i wznawiania transmisji;
- przekazywanie informacji o aktualnym stanie połączenia.

Moduł powinien współpracować z silnikiem wykonawczym, który dostarcza przygotowany materiał audiowizualny, a także z mechanizmami monitorowania parametrów transmisji.

### 1.7. Moduł przetwarzania dźwięku — `moonbase-audio`

Moduł audio odpowiada za zarządzanie źródłami dźwięku oraz ich przetwarzanie przed wykorzystaniem w końcowym strumieniu transmisji.

Każde źródło audio powinno być obsługiwane jako niezależny kanał, posiadający własne parametry konfiguracji. Moduł powinien umożliwiać:

- regulację poziomu głośności;
- wyciszanie poszczególnych kanałów;
- konfigurację balansu stereo;
- stosowanie korekcji equalizerem;
- wykorzystanie kompresora i limitera;
- redukcję szumów z wykorzystaniem bramki szumów;
- stosowanie dodatkowych efektów audio.

Moduł powinien również dostarczać informacji o poziomach sygnału, umożliwiając operatorowi kontrolowanie poprawności przetwarzanego dźwięku.

### 1.8. Moduł zarządzania projektami — `moonbase-project-manager`

Moduł odpowiada za trwałe przechowywanie konfiguracji przygotowanych projektów oraz umożliwienie ich ponownego odtworzenia.

Powinien zapewniać:

- zapisywanie aktualnej konfiguracji projektu;
- odczytywanie wcześniej zapisanych projektów;
- importowanie konfiguracji z zewnętrznych plików;
- eksportowanie całego projektu do pliku;
- tworzenie kopii zapasowych;
- przenoszenie projektów pomiędzy urządzeniami.

Dane zapisywane w projekcie powinny obejmować konfigurację scen, źródeł, warstw, ustawień audio, transmisji oraz kamer. Dzięki temu użytkownik może przygotować konfigurację studia wcześniej i wykorzystać ją podczas kolejnych sesji transmisyjnych.

### 1.9. Moduł monitorowania — `moonbase-monitoring`

Moduł monitorowania odpowiada za zbieranie i prezentowanie informacji dotyczących aktualnego działania aplikacji, silnika wykonawczego oraz aktywnej transmisji.

Użytkownik powinien mieć dostęp do najważniejszych parametrów technicznych, takich jak:

- liczba klatek na sekundę;
- bitrate przesyłanego strumienia;
- opóźnienie transmisji;
- wykorzystanie zasobów sprzętowych;
- jakość połączenia sieciowego.

Dane prezentowane przez moduł powinny umożliwiać bieżącą ocenę wydajności systemu i wykrywanie problemów mogących wpływać na jakość realizowanej transmisji.

## 2. Architektura komunikacji pomiędzy modułami

Architektura MoonBase Studio zakłada rozdzielenie odpowiedzialności pomiędzy poszczególne warstwy systemu. Interfejs użytkownika nie powinien bezpośrednio zarządzać mechanizmami przechwytywania, przetwarzania ani renderowania mediów. Operacje wykonywane przez użytkownika są najpierw przekazywane do warstwy logiki aplikacyjnej, która odpowiada za aktualizację modelu projektu oraz koordynację dalszych działań.

Ogólny przepływ komunikacji można przedstawić następująco:

1. **Interfejs użytkownika:** operator wykonuje operację, np. dodaje źródło obrazu, zmienia położenie warstwy lub przełącza scenę.
2. **Logika aplikacyjna:** odpowiednia operacja zostaje obsłużona przez warstwę komend i usług aplikacyjnych.
3. **Model projektu:** konfiguracja projektu zostaje zaktualizowana zgodnie z wykonaną operacją.
4. **Warstwa integracyjna:** zmiana wymagająca aktualizacji stanu wykonawczego zostaje przekazana do odpowiedniego adaptera.
5. **MoonBase Bridge:** silnik wykonawczy realizuje otrzymaną konfigurację, aktualizując stan źródeł, scen i renderowania. Utrata Studio nie gasi programu, który już działa. Utrata Bridge nie gasi edycji ani zapisu.

W przypadku uruchamiania projektu lub ponownej synchronizacji silnika może zostać przekazana pełna konfiguracja projektu. Podczas normalnej pracy systemu aktualizacje mogą być przekazywane jako pojedyncze operacje zmieniające wybrane właściwości.

Moduły AI, audio, transmisji i monitorowania współpracują z pozostałymi częściami systemu poprzez określone interfejsy, dostarczając wyników analizy, przetworzonych danych lub informacji o aktualnym stanie działania aplikacji.

## 3. Zarządzanie stanem projektu i stanem wykonawczym

W systemie MoonBase Studio rozdzielono dwa podstawowe rodzaje danych: konfigurację projektu oraz bieżący stan wykonawczy aplikacji.

**Stan projektu** obejmuje informacje, które powinny zostać zachowane podczas zapisywania konfiguracji. Należą do nich między innymi:

- struktura scen;
- rozmieszczenie i właściwości warstw;
- definicje źródeł multimedialnych;
- ustawienia kanałów audio;
- parametry transmisji;
- konfiguracja kamer.

**Stan wykonawczy** obejmuje informacje związane z aktualnym działaniem systemu, takie jak:

- aktywne strumienie multimedialne;
- przechwytywane obrazy z kamer;
- obiekty wykorzystywane podczas renderowania;
- aktualny stan odtwarzania zasobów;
- bieżące parametry połączenia;
- wyniki monitorowania i analizy obrazu.

Rozdzielenie tych obszarów pozwala uniknąć zapisywania w pliku projektu obiektów zależnych od środowiska wykonawczego, takich jak strumienie mediów, elementy interfejsów przeglądarki czy obiekty silnika renderującego.

## 4. Rozszerzalność systemu

MoonBase Studio został zaprojektowany z myślą o możliwości dalszego rozwijania funkcjonalności bez konieczności przebudowy całej architektury. Modularny podział odpowiedzialności umożliwia niezależne rozszerzanie poszczególnych obszarów aplikacji.

W przyszłości system może zostać rozbudowany między innymi o dodatkowe mechanizmy analizy obrazu, kolejne formaty multimedialne, nowe efekty przetwarzania dźwięku, dodatkowe źródła wejściowe oraz integracje z zewnętrznymi urządzeniami sterującymi.

Takie podejście pozwala traktować MoonBase Studio jako rozwijalne środowisko realizacji transmisji audiowizualnych, w którym kolejne funkcjonalności mogą być dodawane bez naruszania podstawowego podziału odpowiedzialności pomiędzy interfejsem, logiką aplikacyjną, modelem projektu i silnikiem wykonawczym.
