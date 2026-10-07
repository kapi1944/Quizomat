# Architektura Quizomatu

**Quizomat jest silnikiem uniwersalnym, a konkretne quizy są danymi.**

Stan Etapu 2: działa shell i konfiguracja narzędzi / PWA, model domenowy ze schematami Zod oraz deterministyczna walidacja tekstu pliku JSON. Poniższe granice modułów opisują docelowy podział odpowiedzialności. Katalogi bez implementacji mają tylko opis zakresu; nie tworzymy pustych usług ani globalnych warstw. Nie implementujemy silnika, trwałego zapisu ani UI kolejnych etapów.

## Moduły

| Katalog          | Odpowiedzialność                                                   | Stan Etapu 2                                          |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| `src/aplikacja`  | Routing, składanie ekranów, styl powłoki                           | Shell                                                 |
| `src/komponenty` | Małe współdzielone elementy UI                                     | Placeholder, komunikat PWA                            |
| `src/domena`     | Wersjonowane modele quizu, decyzji, sesji i raportu                | Schematy quizu / sesji i typy; raport odłożony        |
| `src/silnik`     | Czyste obliczanie ścieżki, jawne reguły, przeliczenie decyzji      | Odłożony                                              |
| `src/import`     | Parsowanie, Zod, kontrola semantyczna, raport przed zatwierdzeniem | Walidator JSON i strukturalny raport, bez UI / zapisu |
| `src/dane`       | Lokalny zapis quizów, sesji, ustawień i migracje                   | Odłożony                                              |
| `src/eksport`    | Generowanie TXT / Markdown / JSON / PDF z raportu                  | Odłożony                                              |
| `src/ai`         | Opcjonalna analiza przez prywatnego pośrednika                     | Odłożony, bez integracji                              |
| `testy`          | Testy niezależne od kodu produkcyjnego                             | Shell / routing oraz schematy domenowe                |
| `public`         | Lokalne ikony i statyczne zasoby PWA                               | Gotowe                                                |
| `docs`           | Kontrakt, architektura, etapy i format                             | Gotowe                                                |

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
