# Wymagania funkcjonalne studia

## FR-02 Konfiguracja transmisji strumieniowej

System powinien umożliwiać konfigurację parametrów transmisji strumieniowej przed jej rozpoczęciem. Użytkownik musi mieć możliwość określenia docelowego miejsca wysyłania transmisji, skonfigurowania połączenia z serwerem odbierającym strumień oraz dostosowania parametrów jakościowych transmisji. Konfiguracja powinna obejmować:

- wybór docelowego miejsca wysyłania transmisji;
- określenie adresu serwera odbierającego strumień;
- konfigurację parametrów jakościowych transmisji;
- przygotowanie połączenia sieciowego z wykorzystaniem RTMP. Połączenie otwiera MoonBase Bridge, nie przeglądarka.

## FR-03 Zarządzanie transmisją na żywo

Aplikacja musi umożliwiać zarządzanie aktywną transmisją w czasie rzeczywistym. Użytkownik powinien mieć możliwość kontrolowania stanu transmisji bez konieczności ponownego konfigurowania połączenia. System musi obsługiwać następujące operacje:

- rozpoczęcie transmisji;
- zatrzymanie transmisji;
- tymczasowe wstrzymanie transmisji;
- wznowienie wcześniej wstrzymanej transmisji.

Zmiana stanu transmisji nie powinna powodować utraty bieżącej konfiguracji projektu ani wymagać ponownego przygotowania połączenia.

## FR-04 Zarządzanie źródłami wejściowymi audio i wideo

System powinien umożliwiać dodawanie i zarządzanie wieloma źródłami wejściowymi wykorzystywanymi podczas transmisji. Aplikacja musi obsługiwać różne rodzaje źródeł multimedialnych, w szczególności:

- kamery internetowe i urządzenia USB;
- udostępniony ekran komputera;
- lokalne pliki wideo;
- pliki graficzne;
- zewnętrzne źródła strumieniowe;
- inne dynamiczne źródła obrazu.

Każde dodane źródło powinno posiadać niezależną konfigurację oraz umożliwiać jego aktywację i dezaktywację podczas pracy systemu.

## FR-05 System warstwowego budowania sceny

Aplikacja powinna umożliwiać tworzenie scen transmisyjnych z wykorzystaniem systemu warstw, stosowanego w profesjonalnych narzędziach do realizacji transmisji. Użytkownik powinien mieć możliwość:

- dodawania elementów wizualnych i multimedialnych do sceny;
- rozmieszczania elementów w przestrzeni roboczej;
- zmiany kolejności warstw;
- określania sposobu nakładania poszczególnych elementów na obraz końcowy.

System powinien zapewniać możliwość budowania kompozycji składających się z wielu niezależnych elementów, które wspólnie tworzą obraz wykorzystywany podczas transmisji.

## FR-06 Zarządzanie wieloma scenami transmisyjnymi

System powinien umożliwiać tworzenie i przechowywanie wielu niezależnych scen wykorzystywanych podczas transmisji. Użytkownik musi mieć możliwość przełączania się pomiędzy przygotowanymi scenami w czasie rzeczywistym, bez konieczności zatrzymywania aktywnego strumienia. Każda scena powinna przechowywać własną konfigurację obejmującą:

- rozmieszczenie i właściwości elementów wizualnych;
- przypisane źródła multimedialne;
- konfigurację poszczególnych elementów sceny.

## FR-07 Edytor przestrzeni studia

System powinien zawierać moduł umożliwiający tworzenie uproszczonej reprezentacji przestrzeni roboczej studia transmisyjnego. Użytkownik powinien mieć możliwość przygotowania schematycznego układu pomieszczenia oraz rozmieszczania w nim wirtualnych kamer reprezentujących rzeczywiste urządzenia wykorzystywane podczas transmisji.

Edytor powinien umożliwiać przedstawienie rozmieszczenia kamer w obrębie zaprojektowanej przestrzeni studia.

## FR-08 Powiązanie kamer fizycznych z wirtualnymi

Aplikacja powinna umożliwiać przypisywanie rzeczywistych urządzeń przechwytujących obraz do wcześniej zdefiniowanych pozycji kamer w środowisku wirtualnego studia. Każda kamera fizyczna powinna posiadać odpowiadający jej logiczny odpowiednik w strukturze projektu. Powiązanie to powinno umożliwiać identyfikację urządzenia fizycznego na podstawie przypisanej mu pozycji kamery w środowisku studia.

## FR-09 Detekcja obecności obiektów w obrazie

System powinien integrować mechanizmy detekcji obiektów umożliwiające analizę obrazu pochodzącego z każdej aktywnej kamery. Mechanizm analizy powinien pozwalać na:

- wykrywanie obecności określonych obiektów znajdujących się w kadrze;
- określanie aktualnej widoczności wykrytych obiektów;
- przekazywanie informacji o stanie wykrytych obiektów do pozostałych mechanizmów systemu.

## FR-10 Analiza zachowania osoby obserwowanej

System powinien umożliwiać analizę zachowania osoby znajdującej się w obrazie rejestrowanym przez kamerę. Moduł analizy powinien wykorzystywać informacje uzyskane z obrazu do rozpoznawania wybranych zachowań i cech aktywności obserwowanej osoby. Funkcjonalność powinna obejmować:

- wykrywanie kierunku patrzenia osoby;
- identyfikowanie momentu wypowiadania się konkretnej osoby;
- analizę podstawowych gestów wykonywanych podczas transmisji.

## FR-11 Ocena jakości aktywnego kadru

Aplikacja powinna automatycznie analizować jakość obrazu aktualnie wykorzystywanego podczas transmisji. System powinien oceniać położenie obserwowanego obiektu względem kadru oraz określać, czy aktualne ujęcie spełnia wymagania związane z prawidłowym przedstawieniem obserwowanej osoby lub obiektu.

Wyniki przeprowadzanej analizy powinny umożliwiać ocenę przydatności aktualnego ujęcia do wykorzystania podczas transmisji.

## FR-12 Wykrywanie zasłonięcia kamery

System powinien posiadać mechanizm wykrywający sytuacje, w których kamera przestaje prawidłowo rejestrować obraz. Analiza powinna uwzględniać:

- częściowe zasłonięcie obiektywu kamery;
- całkowite zasłonięcie obiektywu kamery;
- utratę widoczności wcześniej wykrywanych obiektów;
- inne sytuacje wpływające na jakość rejestrowanego obrazu.

System powinien wykrywać wymienione nieprawidłowości i przekazywać informacje o ich wystąpieniu.

## FR-13 Automatyczny wybór najlepszego ujęcia

System powinien umożliwiać automatyczny wybór źródła obrazu zapewniającego najlepszy aktualnie dostępny kadr. W tym celu aplikacja powinna porównywać obraz pochodzący ze wszystkich aktywnych kamer oraz wykorzystywać wyniki analizy obrazu do oceny poszczególnych ujęć. Wybór aktywnego źródła powinien odbywać się automatycznie na podstawie aktualnych wyników przeprowadzanej analizy.

## FR-14 System priorytetów kamer

Aplikacja powinna umożliwiać użytkownikowi definiowanie priorytetów przypisanych do poszczególnych kamer wykorzystywanych podczas transmisji. Ustalona hierarchia ważności kamer powinna być uwzględniana przez mechanizm automatycznego wyboru ujęcia. Dzięki temu system powinien podejmować decyzje o wyborze aktywnej kamery z uwzględnieniem zarówno wyników analizy obrazu, jak i priorytetów określonych przez użytkownika.

## FR-15 Ręczne nadpisanie decyzji systemu automatycznego

Aplikacja musi umożliwiać operatorowi ręczne przejęcie kontroli nad wyborem aktywnej kamery. Funkcjonalność powinna pozwalać na wskazanie źródła obrazu, które ma być wykorzystywane podczas transmisji, niezależnie od decyzji podejmowanych przez mechanizm automatycznego wyboru ujęcia.

W przypadku aktywowania trybu ręcznego automatyczny mechanizm przełączania kamer powinien zostać tymczasowo wyłączony.

## FR-16 Panel przetwarzania dźwięku

System powinien umożliwiać niezależną konfigurację parametrów audio dla każdego źródła dźwięku wykorzystywanego podczas transmisji. Użytkownik powinien mieć możliwość dostosowywania właściwości poszczególnych kanałów audio z poziomu dedykowanego panelu przetwarzania dźwięku. Funkcjonalność powinna obejmować:

- regulację poziomu głośności;
- wyciszanie poszczególnych kanałów;
- konfigurację equalizera;
- zastosowanie limitera i kompresora;
- konfigurację bramki szumów (Noise Gate);
- regulację balansu stereo;
- wykorzystanie dodatkowych efektów audio.

## FR-17 Monitoring parametrów transmisji

Aplikacja powinna udostępniać panel monitorowania prezentujący aktualne parametry techniczne działania systemu oraz aktywnej transmisji. Użytkownik powinien mieć możliwość bieżącego kontrolowania następujących informacji:

- liczba klatek na sekundę (FPS);
- bitrate transmisji;
- opóźnienie transmisji;
- wykorzystanie zasobów sprzętowych;
- jakość połączenia sieciowego.

Prezentowane parametry powinny umożliwiać ocenę aktualnego stanu technicznego systemu podczas przygotowywania i realizowania transmisji.

## FR-18 Zapisywanie i odczyt konfiguracji projektu

System powinien umożliwiać trwałe zapisywanie konfiguracji projektu w celu jej późniejszego odtworzenia. Zapisywane dane powinny obejmować:

- utworzone sceny transmisyjne;
- ustawienia transmisji;
- skonfigurowane źródła obrazu;
- ustawienia audio;
- konfigurację kamer.

Aplikacja powinna umożliwiać ponowne wczytywanie wcześniej zapisanych konfiguracji, tak aby użytkownik mógł kontynuować pracę nad projektem bez konieczności ponownego ręcznego przygotowywania jego poszczególnych elementów.

## FR-19 Import i eksport konfiguracji

Aplikacja powinna umożliwiać eksportowanie kompletnej konfiguracji projektu do zewnętrznego pliku oraz ponowne importowanie zapisanych danych do systemu. Funkcjonalność powinna zapewniać:

- eksport całej konfiguracji projektu do pliku;
- import wcześniej wyeksportowanej konfiguracji;
- tworzenie kopii zapasowych projektów;
- przenoszenie projektów pomiędzy różnymi urządzeniami.

## FR-20 Elementy dodatkowe transmisji

System powinien umożliwiać wzbogacanie obrazu transmisji o dodatkowe elementy wizualne i interaktywne. Użytkownik powinien mieć możliwość dodawania do przygotowywanych scen elementów uzupełniających prezentowaną treść. Funkcjonalność może obejmować:

- nakładki graficzne;
- teksty ekranowe;
- liczniki czasu;
- alerty i powiadomienia;
- inne elementy interaktywne wykorzystywane podczas transmisji.
