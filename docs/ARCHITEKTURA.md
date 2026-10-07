# Architektura Quizomatu

**Quizomat jest silnikiem uniwersalnym, a konkretne quizy są danymi.**

Stan Etapu 5: działa shell / PWA, model domenowy, deterministyczny importer i liniowy runtime pojedynczego wyboru. Istniejąca baza IndexedDB `quizomat` w wersji 2 przechowuje osobno definicje (`quizy`) oraz kanoniczne sesje (`sesje`). Biblioteka tworzy niezależne sesje i pozwala kontynuować niedokończone. Autosave obejmuje wybór, Dalej / Wstecz, odkładanie i powrót do odłożonego pytania. Ustawienie „Pokazuj rekomendacje” pozostaje w localStorage; zasoby i adaptacja są odłożone.

Zakres Etapu 4 objął również podstawowy ekran decyzji i rozróżnienie rekomendacji / wyboru, pierwotnie przypisane do Etapów 6–7. Szczegóły i jawne granice wykonania opisuje `src/silnik/README.md`. Etap 5 rozszerza istniejący magazyn; importer oraz zbiór definicji pozostają bez zmian.

## Trwałe sesje — decyzje Etapu 5

Migracja 1 → 2 dodaje zbiór `sesje` z kluczem `id` i indeksem `quizId`; nie usuwa ani nie przepisuje zbioru `quizy`. Świeża instalacja tworzy oba zbiory w tej samej bazie. Wersja IndexedDB jest niezależna od `Sesja.schemaVersion: "1.0.0"`.

Nie zapisujemy kopii definicji w każdej sesji. `quizId` i `wersjaQuizu` identyfikują istniejącą, niezmienną definicję: importer używa `add`, a ponowny import tego samego ID jest blokowany. Wznowienie i zapis sprawdzają zgodność wersji i semantykę decyzji. Brak definicji lub niezgodna wersja oznacza jawny błąd, bez podmiany danych. Przyszłe zastępowanie / usuwanie definicji musi najpierw zapewnić zachowanie wersji używanych przez sesje.

Adres `/sesja/:sesjaId` wskazuje konkretną sesję. Nowa sesja powstaje wyłącznie po kliknięciu „Rozpocznij nową” i zostaje zapisana przed przejściem na jej ekran. Wczytanie adresu, również w React StrictMode, nie tworzy sesji. Biblioteka pokazuje proste odnośniki „Kontynuuj” dla niedokończonych sesji; pełna historia nie powstaje.

Każda zmiana sesji jest zapisywana jedną transakcją obejmującą `quizy` i `sesje`. Porównanie z poprzednim zapisanym stanem w tej samej transakcji blokuje nadpisanie zmian innej karty. Ekran aktualizuje potwierdzony stan dopiero po `oncomplete`, blokuje kolejne operacje podczas zapisu, a po błędzie zachowuje poprzedni stan i kandydata do ponowienia. Niezapisany kandydat nie jest trwały; zamknięcie / odświeżenie podczas zapisu lub błędu uruchamia ostrzeżenie `beforeunload`. Potwierdzony zapis można wznowić po restarcie. Fizyczne przerwanie procesu przed zakończeniem transakcji nie daje gwarancji zapisania rozpoczętej zmiany.

„Wróć później” usuwa bieżącą decyzję odłożonego pytania i przechodzi dalej. Dotychczasowa decyzja, jeśli istniała, pozostaje w istniejącym polu historii. Odłożone ID pozostaje na liście również po powrocie do pytania; usuwa je dopiero poprawna odpowiedź. `biezacePytanieId: null` i `stan: "wTrakcie"` oznaczają koniec zestawu z odłożonymi pytaniami. Sesja może być `zakonczona` dopiero przy odpowiedziach na cały zestaw, pustej liście odłożonych i zakończeniu nawigacji. Pełna historia zmian / replay pozostaje zakresem Etapu 6 zgodnie z aktualnym poleceniem.

## Moduły

| Katalog          | Odpowiedzialność                                                   | Stan Etapu 3                                            |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `src/aplikacja`  | Routing, składanie ekranów, styl powłoki                           | Shell, import i biblioteka                              |
| `src/komponenty` | Małe współdzielone elementy UI                                     | Placeholder, komunikat PWA                              |
| `src/domena`     | Wersjonowane modele quizu, decyzji, sesji i raportu                | Schematy quizu / sesji i typy; raport odłożony          |
| `src/silnik`     | Czyste obliczanie ścieżki, jawne reguły, przeliczenie decyzji      | Odłożony                                                |
| `src/import`     | Parsowanie, Zod, kontrola semantyczna, raport przed zatwierdzeniem | Walidator i odczyt pliku; ekran w `src/aplikacja`       |
| `src/dane`       | Lokalny zapis quizów, sesji, ustawień i migracje                   | Minimalny zapis zaakceptowanych quizów; reszta odłożona |
| `src/eksport`    | Generowanie TXT / Markdown / JSON / PDF z raportu                  | Odłożony                                                |
| `src/ai`         | Opcjonalna analiza przez prywatnego pośrednika                     | Odłożony, bez integracji                                |
| `testy`          | Testy niezależne od kodu produkcyjnego                             | Shell, domena, walidator i przepływ importu             |
| `public`         | Lokalne ikony i statyczne zasoby PWA                               | Gotowe                                                  |
| `docs`           | Kontrakt, architektura, etapy i format                             | Gotowe                                                  |

## Kierunek zależności

UI wywołuje moduły aplikacyjne. Import, silnik, zapis i eksport używają modeli domenowych. Domena nie zależy od Reacta, magazynu, service workera ani AI. Silnik nie zna UI, sieci, AI ani treści specyficznej dla zastosowania; przyjmuje dane i zatwierdzone decyzje, zwraca ścieżkę oraz wyjaśnienia.

Import waliduje dane przy użyciu Zod i dodatkowych kontroli odwołań. Dopiero zaakceptowany raport pozwala przekazać quiz do biblioteki. Kod nie interpretuje JSON jako JavaScript, nie używa `eval`, nie importuje wykonywalnych wtyczek z quizu. Reguły będą ograniczonym, deklaratywnym formatem opisanym w FORMAT_QUIZU.md.

Eksport przyjmuje jeden kanoniczny raport decyzji. Każdy format odwzorowuje tę samą treść; generatory nie tworzą własnego silnika rekomendacji ani ścieżki. AI nie jest wymaganą zależnością żadnego z tych modułów.

## Dane źródłowe i sesja

Quiz źródłowy jest niezmienny i ma `schemaVersion`, stabilne `id` i `wersjaQuizu`. Sesja wskazuje konkretną wersję quizu i przechowuje własne decyzje. Aktualizacja quizu nie może automatycznie podmienić danych trwającej sesji.

Docelowo: IndexedDB dla quizów, zasobów, sesji i ustawień. Wersja magazynu jest niezależna od `schemaVersion`. Transakcja zapisuje decyzję wraz z konsekwencjami przeliczenia. UI pokazuje błąd zapisu i umożliwia ponowienie; nie oznacza niezapisanego stanu jako utrwalonego. Przywracanie sesji i migracje wymagają testów. W Etapie 0 nie istnieje jeszcze magazyn danych użytkownika.

„Wróć później”, szkic odpowiedzi „Inne”, oczekująca analiza i zatwierdzona decyzja to różne stany. Tylko zatwierdzona decyzja może zmienić dalszą ścieżkę. Cofnięcie i edycja odpowiedzi przeliczają ścieżkę deterministycznie. Nieaktualne decyzje zachowuje historia, a aktywny raport uwzględnia tylko aktualne. Wszystkie zmiany ścieżki mają jawny ślad przyczyny, reguły i wcześniejszej odpowiedzi.

## Prezentacja i odpowiedź

Prezentacja (`tekstowa`, `wizualna`, `mieszana`) nie determinuje sposobu odpowiedzi. Pytanie zawiera tablicę konfiguracji sposobów odpowiedzi: wybór, skala, ranking, tekst lub kombinacja. UI jest projekcją tych danych. Rekomendacja autora i zatwierdzony wybór mają osobne pola, osobne znaczenie i osobne oznaczenia.

Normalny ekran skupia się na decyzji; techniczne ID, wersje i reguły są dostępne w szczegółach wyjaśnień / diagnostyce. Nie usuwamy ich z danych sesji i eksportu.

## PWA i offline

Manifest i ikony PNG 192 / 512 oraz maskable wspierają instalację. Vite PWA generuje service worker precache'ujący własne zasoby powłoki. Brak zdalnych fontów i zależności runtime od CDN. Routing fragmentem URL pozwala otwierać podstrony na statycznym hostingu bez dodatkowego backendu.

Pierwsze pobranie wymaga sieci. Dostępność offline wymaga zakończenia instalacji i aktywacji service workera. Cache powłoki jest oddzielony od trwałego magazynu użytkownika; aktualizacja cache nie jest migracją danych ani kopią zapasową. Aktualizacje używają `prompt`: użytkownik klika „Zaktualizuj” lub „Później”. Przy wdrożeniu sesji trzeba przed przeładowaniem zapewnić utrwalenie bieżącego stanu.

Docelowy import obrazów musi ustalić ich lokalną dostępność. Sam URL obrazu nie zapewnia offline. Reguły zasobów opisuje FORMAT_QUIZU.md. Cache nie obejmuje przyszłych żądań do AI. HTTPS jest wymagany poza localhost; publikacja i fizyczna instalacja nie należą do zamknięcia Etapu 0.

## AI i prywatność

Brak kluczy API, backendu, kont, telemetrii i połączeń AI w Etapie 0. Przyszły moduł AI ma wysyłać wyłącznie jawnie zatwierdzony zakres danych do osobnej prywatnej warstwy pośredniej. Klucze i dostęp do modelu należą do tej warstwy. Wymagane będą osobne decyzje o jej uruchomieniu i zabezpieczeniu, bez narzucania systemu kont w PWA.

Wynik analizy jest propozycją do zatwierdzenia. Nie zmienia automatycznie decyzji, quizu ani historii. Funkcje jawnie wymagające AI komunikują ten warunek i brak połączenia; zwykły silnik pozostaje dostępny offline.

## Kontrola i ograniczenia dowodu

Ścisły TypeScript, ESLint, Prettier, Vitest / Testing Library i build produkcyjny. Testy Etapu 0 sprawdzają shell i nawigację, a testy komunikatu aktualizacji korzystają z atrapy rejestracji service workera. Build potwierdza generowanie artefaktów PWA. Dowód instalacji, działania offline i aktualizacji na fizycznym telefonie wymaga osobnego sprawdzenia; jednostkowe testy DOM go nie zastępują.
