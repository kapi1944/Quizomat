# Format quizu JSON — kontrakt 1.0.0

Status: Etap 6 — standard JSON i importer zachowują kontrakt 1.0.0. Model domenowy i schematy Zod są w `src/domena/quiz.ts` oraz `src/domena/sesja.ts`; typy pochodzą z `z.infer`. Walidator importu pozostaje czysty: zwraca raport, nie zapisuje ani automatycznie nie zatwierdza danych. `src/silnik/runtime.ts` waliduje odpowiedź względem konkretnego pytania i wykonuje tekstowy pojedynczy wybór. Pozostałe mechaniki oraz własna odpowiedź są nadal poprawnymi danymi formatu, lecz otrzymują jawną odmowę wykonania w runtime. Reguły adaptacyjne blokują uruchomienie zamiast być ignorowane. Kanoniczne sesje są trwale zapisywane w zbiorze `sesje` istniejącej bazy `quizomat`, wersja 3, obok niezmienionego zbioru `quizy`. Format importu i wersja schematu sesji nie zmieniają się.

## Przepływ pliku i akceptacja raportu — Etap 3

Wybór pliku JSON → odczyt UTF-8 → parsowanie i walidacja → raport → decyzja użytkownika. Ekran pokazuje liczbę poprawnych definicji względem deklaracji, rzeczywistą liczbę pytań i różnicę względem deklaracji, osobną pulę dodatkową, błędy krytyczne, ostrzeżenia, informacje i odrzucone pytania z przyczynami. Gdy deklaracja nie jest poprawna, nagłówek używa rzeczywistej liczby albo zaznacza brak znanej liczby. ID, ścieżki i kody znajdują się w rozwijanej diagnostyce. Poprawność poszczególnych pytań nie gwarantuje poprawności całej definicji.

„Anuluj” porzuca raport i wraca do biblioteki. „Popraw plik” wraca do wyboru poprawionej wersji; nie uruchamia edytora. „Kontynuuj mimo ostrzeżeń” wymaga kliknięcia i jest zablokowane przy błędach krytycznych. Dla raportu bez ostrzeżeń przycisk nosi nazwę „Zatwierdź import”. Nie importujemy częściowo poprawnych pytań z błędnego quizu.

Dopiero akceptacja uruchamia transakcję IndexedDB. Sukces oznacza zakończenie transakcji; awaria pozostawia raport i możliwość ponowienia. Magazyn `quizomat`, wersja 1, przechowuje w zbiorze `quizy` definicję oraz niezmienione dane źródłowe (również pola objęte ostrzeżeniami). Klucz to ID quizu. Powtórny import tego samego ID zgłasza błąd bez zastępowania danych. Zarządzanie wersjami / zastępowanie, sesje, ustawienia i pobieranie zasobów pozostają odłożone. Lista biblioteki pokazuje treści użytkowe; nie eksponuje ID ani kodów diagnostycznych.

Quiz zawiera treść i reguły. Sesja zawiera decyzje konkretnego użytkownika. Raport i eksport JSON mają osobne wersjonowane obwiednie; nie mieszamy ich z plikiem źródłowym quizu. Nie używamy nazw ani reguł zależnych od konkretnego zastosowania.

MVP importuje wyłącznie plik JSON zawierający obiekt quizu bez dodatkowej obwiedni `quiz`. Markdown jest formatem autorskim / eksportowym, nie formatem wejścia obecnego importera. Nie przyjmujemy swobodnego Markdownu, bloków kodu otaczających JSON, komentarzy ani końcowych przecinków. Brakujące pola nie są uzupełniane; `tytul` jest nazwą quizu, a nie aliasem zgadywanym z pól `nazwa` lub `title`.

## Wersje i pola główne

| Pole               | Typ                | Zasada                                                                         |
| ------------------ | ------------------ | ------------------------------------------------------------------------------ |
| `schemaVersion`    | string             | W tej wersji dokładnie `1.0.0`; wersja kontraktu, nie aplikacji                |
| `id`               | string             | Niepuste stabilne ID quizu                                                     |
| `wersjaQuizu`      | string             | Wersja treści w postaci `X.Y.Z`, np. `1.0.0`; zmiana treści tworzy nową wersję |
| `tytul`            | string             | Niepusty tytuł widoczny w bibliotece                                           |
| `opis`             | string, opcjonalny | Opis celu decyzji                                                              |
| `jezyk`            | string             | Np. `pl`; niepusta deklaracja języka                                           |
| `liczbaPytan`      | integer >= 1       | Deklarowana liczba pytań bazowych; musi równać się `pytania.length`            |
| `pytania`          | tablica pytań      | Bazowa kolejność, co najmniej jedno pytanie                                    |
| `pytaniaDodatkowe` | tablica pytań      | Pula pytań aktywowanych regułami; może być pusta                               |
| `reguly`           | tablica reguł      | Jawne operacje adaptacyjne; może być pusta                                     |

`liczbaPytan` nie obejmuje puli `pytaniaDodatkowe`. Raport importu pokazuje osobno deklarowaną / faktyczną liczbę bazową oraz liczbę pytań dodatkowych. Liczba pytań w sesji może się zmieniać wskutek reguł i nie jest stałą quizu.

ID mają format `[a-zA-Z0-9][a-zA-Z0-9._-]*`, są niepuste i nie zależą od indeksu tablicy, tekstu ani litery wariantu. ID pytań muszą być unikalne łącznie w obu pulach; ID reguł w quizie; ID wariantów i sposobów odpowiedzi w obrębie pytania. Zmieniona treść decyzji nie może udawać starego wariantu o tym samym znaczeniu. Identyfikatory obcych API, w szczególności `schemaVersion`, zachowują ustaloną nazwę.

## Pytanie i wariant

Pytanie zawiera wymagane `id`, `tresc` (niepusty tekst), `prezentacja`, `warianty` (tablica, również pusta dla samego tekstu / skali) oraz `sposobyOdpowiedzi` (niepusta tablica). Opcjonalne: `wyjasnienie`, `rekomendacja` i `innaOdpowiedz`.

`prezentacja` ma `rodzaj`: `tekstowa`, `wizualna` lub `mieszana`. Wizualna / mieszana wymaga co najmniej jednego obrazu przy pytaniu lub wariancie. `prezentacja.obrazy` to opcjonalna tablica zasobów. Prezentacja nie ustala sposobu odpowiedzi.

Wariant zawiera wymagane `id` i `etykieta`, opcjonalne `opis`, `zalety` (tablica tekstów), `wady` (tablica tekstów), `konsekwencje` (tablica tekstów), `wyjasnienie` i `obrazy` (tablica zasobów). `Konsekwencja` jest nazwanym typem niepustego tekstu, zgodnie z wersją 1.0.0; nie dodajemy niepotrzebnych ID ani nowego formatu opisów. Nie ma sztywnego maksimum trzech wariantów. Puste lub powtarzające się ID są błędem. Liczba wariantów jest sprawdzana względem sposobów odpowiedzi, nie według jednej globalnej liczby.

`rekomendacja` zawiera `wariantId` i niepuste `uzasadnienie`. Musi wskazywać istniejący wariant tego pytania. To informacja autora, nigdy domyślny wybór użytkownika. Ustawienie widoczności należy do aplikacji / sesji, nie zmienia rekomendacji w źródle quizu.

`innaOdpowiedz` zawiera `etykieta` (zwykle „Inne”) oraz `analiza`:

- `tryb: "autorska"`, `interpretacja` i `potencjalneSkutki` (tablica tekstów): jawnie opisana przez autora analiza lokalna; UI nie przedstawia jej jako indywidualnego wyniku modelu,
- albo `tryb: "ai"`: funkcja jawnie wymaga analizy AI; bez niej szkic nie jest zatwierdzany i użytkownik może zmienić odpowiedź lub wrócić później.

„Inne” nie jest wariantem automatycznie akceptowanym po wpisaniu tekstu. Sesja przechowuje osobno szkic, analizę, jej pochodzenie i dopiero potwierdzoną własną decyzję. Brak analizy nie może skutkować domyślnym zastosowaniem tekstu. Silnik nie wywołuje AI; otrzymuje już zatwierdzoną odpowiedź.

## Sposoby odpowiedzi — niezależne od prezentacji

Każdy element `sposobyOdpowiedzi` zawiera stabilne `id`, `rodzaj` oraz `wymagany` (boolean). Typ domenowy to `MechanikaOdpowiedzi`. Jest niezależny od `PrezentacjaPytania`, a pytanie zawiera tablicę mechanik, nie jedną wyłączną kategorię. Dopuszczalne konfiguracje:

| `rodzaj`              | Dodatkowe pola                                                                                                 | Wartość w sesji                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `pojedynczyWybor`     | Co najmniej dwa warianty                                                                                       | `wariantId`                                          |
| `wielokrotnyWybor`    | `minimum`, `maksimum`: całkowite, 0 <= minimum <= maksimum <= liczba wariantów                                 | `wariantyId`: tablica unikalnych ID                  |
| `takNie`              | Bez listy wariantów dla samego tego sposobu                                                                    | `wartosc`: boolean; etykiety TAK / NIE               |
| `prawdaFalsz`         | Bez listy wariantów dla samego tego sposobu                                                                    | `wartosc`: boolean; etykiety PRAWDA / FAŁSZ          |
| `otwarta`             | `maksymalnaDlugosc`: integer >= 1                                                                              | `tekst`; może też pełnić rolę komentarza / adnotacji |
| `skala`               | `minimum`, `maksimum`, `krok`: liczby skończone, minimum < maksimum, krok > 0; `cel`: `pytanie` lub `warianty` | Liczba albo oceny `{ wariantId, wartosc }`           |
| `ranking`             | `minimum`, `maksimum`: całkowite, 1 <= minimum <= maksimum <= liczba wariantów                                 | Uporządkowana tablica unikalnych `wariantyId`        |
| `kombinacjaWariantow` | Co najmniej dwa warianty; `minimumElementow`: integer >= 1                                                     | `elementy`: `{ wariantId, fragment, adnotacja? }`    |

Skala wymaga zgodności wartości z zakresem i krokiem; dla `cel: "warianty"` oceny wskazują istniejące warianty. Wartość skali w sesji również zawiera `cel`, aby odróżnić liczbę `wartosc` od tablicy `oceny`. Ranking nie jest wyborem zwycięzcy; przechowuje kolejność. Kombinacja wymaga niepustego opisu `fragment`, np. „układ”; nie musi wskazywać jednego zwycięskiego wariantu i może wskazywać różne fragmenty tego samego wariantu. Pole `adnotacja` zawiera własny komentarz.

Kilka sposobów może współistnieć, np. wielokrotny wybór + skala wariantów + kombinacja + opcjonalna odpowiedź otwarta. Walidator sprawdza każdy aktywny sposób osobno. `wymagany: false` oznacza, że można pominąć ten sposób w odpowiedzi; nie jest to reguła pominięcia całego pytania. Każde pytanie można odłożyć niezależnie od `wymagany`.

Nie jest dozwolona sprzeczna konfiguracja (np. skala wariantów bez wariantów, ranking z maksimum większym od ich liczby). Dla pytań z samym TAK / NIE, PRAWDA / FAŁSZ, tekstem lub skalą pytania `warianty` może być puste. Niepusta lista wariantów bez sposobu odnoszącego się do nich wymaga ostrzeżenia w raporcie.

## Zasoby wizualne i offline

Zasób zawiera `id`, `opisAlternatywny` (niepusty tekst) oraz jedno źródło:

- `dane`: data URL obrazu PNG / JPEG / WebP — zawartość trafia docelowo do lokalnego magazynu po zatwierdzeniu importu,
- albo `url`: absolutny adres HTTPS — import informuje o zależności sieciowej; obraz musi zostać zapisany lokalnie, aby był dostępny offline.

Nie przyjmujemy skryptów, aktywnego HTML, wykonywalnego SVG ani lokalnych ścieżek plików użytkownika. Schemat odrzuca jednoczesne `url` i `dane`, sprawdza HTTPS lub składnię niepustego base64 dla dozwolonego MIME oraz unikalność ID obrazów w pytaniu. Nie dekoduje pliku, nie potwierdza rzeczywistego MIME, nie pobiera URL i nie gwarantuje dostępności offline. Etap 2 jawnie raportuje te ograniczenia jako `ZASOB_ZDALNY` albo `ZASOB_NIEZDEKODOWANY`; taki wynik wymaga potwierdzenia ostrzeżeń. Kontrole dekodowania, dostępności i limity zasobów pozostają do wdrożenia przy obsłudze lokalnych zasobów. Teksty mają być renderowane jako tekst. Użytkownik nie otrzymuje deklaracji pełnej gotowości offline przy niezweryfikowanych zasobach.

## Reguły adaptacyjne

Reguła zawiera `id`, `powod`, `warunek` i `operacja`. Kolejność w `reguly` określa kolejność stosowania. `powod` jest niepustym wyjaśnieniem dla użytkownika.

Warunek wskazuje `pytanieId` i `sposobId` wcześniejszej zatwierdzonej odpowiedzi, a następnie `operator` i `wartosc`:

- `rowne`: porównanie ID pojedynczego wyboru, booleanu lub tekstu,
- `zawieraWariant`: ID występuje w wielokrotnym wyborze, rankingu lub kombinacji,
- `coNajmniej`: liczba na skali z celem `pytanie` jest >= wartości.

Format 1.0.0 nie zawiera dowolnych wyrażeń kodu ani wykonywalnych funkcji. Brak zatwierdzonej odpowiedzi nie spełnia warunku; odłożenie lub szkic również go nie spełniają.

Operacje:

- `rodzaj: "dodaj"`, `pytanieId`, `poPytaniuId`: aktywacja pytania z puli dodatkowej w oznaczonym miejscu; to samo ID nie może zostać aktywowane dwukrotnie,
- `rodzaj: "pomin"`, `pytanieId`: jawne pominięcie późniejszego pytania,
- `rodzaj: "modyfikuj"`, `pytanieId`, `zmiany`: deklaratywna zmiana `tresc`, `wyjasnienie` lub `rekomendacja`; bez zmiany ID, wariantów i sposobów odpowiedzi w wersji 1.0.0.

Wskazane pytania, sposoby i warianty muszą istnieć, a warunek musi odnosić się do decyzji wcześniejszej niż zmieniany fragment ścieżki. Schemat sprawdza typ operatora względem mechaniki, odwołania i brak cykli / zależności od późniejszej odpowiedzi, z uwzględnieniem miejsca dodania. Pytanie dodatkowe użyte jako źródło lub kotwica musi mieć regułę dodania. Pula może zawierać niewykorzystane pytania. W wersji 1.0.0 więcej niż jedna operacja na tym samym pytaniu jest odrzucana jako niejednoznaczna, również gdy autor zakłada rozłączność warunków. Nie rozwiązujemy konfliktu przez ciche nadpisanie. Modyfikacja musi być niepusta i może zmienić tylko trzy wskazane pola; inne pola w `zmiany` są błędem. Szersze operatory i zmiany modelu odpowiedzi wymagają jawnego rozszerzenia kontraktu.

Każde wykonanie reguły tworzy wpis zmiany: `rodzaj`, `powod`, `regulaId`, kopię reguły, `pytanieZrodlowe` (ID i treść), `odpowiedzZrodlowa` (pełna zatwierdzona wartość, nie sama litera), `pytanieDoceloweId`, stan `przed` / `po` i kolejność wykonania. UI pokazuje te informacje. Po zmianie wcześniejszej decyzji silnik przelicza wynik z niezmiennego źródła quizu; przestarzałe wpisy i decyzje pozostają historią, nie aktualną specyfikacją.

## Przykład neutralnego quizu

Przykład pokazuje osobne prezentacje i sposoby odpowiedzi oraz dodanie pytania. Nie zawiera obrazu, dlatego prezentacja jest tekstowa. Dodanie zasobów i ustawienie `wizualna` nie zmienia kontraktu sposobów odpowiedzi.

```json
{
  "schemaVersion": "1.0.0",
  "id": "organizacja-pracy",
  "wersjaQuizu": "1.0.0",
  "tytul": "Wybierz organizację pracy",
  "opis": "Porównaj kierunki i połącz ich elementy.",
  "jezyk": "pl",
  "liczbaPytan": 1,
  "pytania": [
    {
      "id": "kierunki",
      "tresc": "Które elementy odpowiadają Twoim potrzebom?",
      "prezentacja": { "rodzaj": "tekstowa" },
      "warianty": [
        {
          "id": "prostota",
          "etykieta": "Prosty podział",
          "opis": "Niewiele kategorii.",
          "zalety": ["Szybkie rozpoczęcie"],
          "wady": ["Mniej szczegółów"],
          "konsekwencje": ["Więcej decyzji przy porządkowaniu"]
        },
        {
          "id": "szczegoly",
          "etykieta": "Szczegółowy podział",
          "opis": "Więcej kategorii i opisów.",
          "zalety": ["Precyzyjna organizacja"],
          "wady": ["Dłuższe przygotowanie"],
          "konsekwencje": ["Potrzeba ustalenia nazw kategorii"]
        }
      ],
      "rekomendacja": {
        "wariantId": "prostota",
        "uzasadnienie": "Ułatwia rozpoczęcie pracy."
      },
      "sposobyOdpowiedzi": [
        {
          "id": "wybor",
          "rodzaj": "wielokrotnyWybor",
          "wymagany": true,
          "minimum": 1,
          "maksimum": 2
        },
        {
          "id": "ocena",
          "rodzaj": "skala",
          "wymagany": false,
          "minimum": 1,
          "maksimum": 5,
          "krok": 1,
          "cel": "warianty"
        },
        {
          "id": "polaczenie",
          "rodzaj": "kombinacjaWariantow",
          "wymagany": false,
          "minimumElementow": 1
        },
        {
          "id": "komentarz",
          "rodzaj": "otwarta",
          "wymagany": false,
          "maksymalnaDlugosc": 2000
        }
      ]
    }
  ],
  "pytaniaDodatkowe": [
    {
      "id": "nazwy-kategorii",
      "tresc": "Jak nazwiesz najważniejsze kategorie?",
      "prezentacja": { "rodzaj": "tekstowa" },
      "warianty": [],
      "sposobyOdpowiedzi": [
        {
          "id": "nazwy",
          "rodzaj": "otwarta",
          "wymagany": true,
          "maksymalnaDlugosc": 2000
        }
      ]
    }
  ],
  "reguly": [
    {
      "id": "doprecyzuj-kategorie",
      "powod": "Wybrano szczegółowy podział, więc potrzebne są nazwy kategorii.",
      "warunek": {
        "pytanieId": "kierunki",
        "sposobId": "wybor",
        "operator": "zawieraWariant",
        "wartosc": "szczegoly"
      },
      "operacja": {
        "rodzaj": "dodaj",
        "pytanieId": "nazwy-kategorii",
        "poPytaniuId": "kierunki"
      }
    }
  ]
}
```

## Raport importu i zgodność

Najpierw odczyt i raport, następnie decyzja. Walidator `walidujImportQuizu(tekst: string)` zwraca `WynikImportu` z `stan`, `raport`, `quiz` i `daneZrodlowe`. Żaden z wyników nie oznacza wykonania zapisu:

- `zablokowany`: co najmniej jeden błąd krytyczny; `quiz: null`,
- `wymagaPotwierdzeniaOstrzezen`: poprawny kandydat, lecz wymagane świadome potwierdzenie ostrzeżeń,
- `gotowyDoZatwierdzenia`: poprawny kandydat bez ostrzeżeń, nadal czekający na decyzję użytkownika.

`daneZrodlowe` zachowuje odczytany obiekt wraz z rozszerzeniami; przy błędzie składni wynosi null. `quiz` jest typowanym wynikiem kanonicznego schematu Zod i jest dostępny tylko bez błędów krytycznych. Raport i kandydat mają zostać pokazani / użyci przez przyszłe UI importu, nie przez normalny ekran quizu. Trwały zapis, transakcja i zatwierdzanie w bibliotece należą do dalszego etapu.

Struktura `RaportImportu`:

| Pole                                                 | Znaczenie                                                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `quizId`, `nazwaQuizu`              | Odczytane tekstowe metadane, null jeśli brakuje wartości lub typ jest inny; nie są dowodem poprawności                             |
| `deklarowanePytania`                                 | Dodatnia bezpieczna liczba całkowita z `liczbaPytan`; inaczej null, bez konwersji                                                  |
| `faktycznePytania`                                   | Długość bazowej tablicy; obejmuje też błędne wpisy; null, jeśli nie ma tablicy                                                     |
| `poprawnePytania`                                    | Bazowe pytania poprawne lokalnie według schematu, bez powtórzonego ID między pytaniami ani powtórzonego pola JSON wewnątrz pytania |
| `liczbaPytanDodatkowych`, `poprawnePytaniaDodatkowe` | Analogiczne liczniki puli dodatkowej; nie są doliczane do deklaracji bazowej                                                       |
| `pytania`                                            | Lista `{ pula, indeks, id, liczbaWariantow, poprawne }`; pula `bazowa` / `dodatkowa`, indeks od 0                                  |
| `bledy`                                              | Problemy o poziomie `bladKrytyczny`, blokujące kandydata                                                                           |
| `ostrzezenia`                                        | Problemy o poziomie `ostrzezenie`, wymagające świadomego potwierdzenia                                                             |
| `informacje`                                         | Komunikaty o poziomie `informacja`, bez blokowania                                                                                 |

Każdy `ProblemImportu` ma `poziom`, stabilny `kod`, `sciezka` jako tablicę kluczy / indeksów (np. `["pytania", 0, "rekomendacja", "wariantId"]`) i polski `opis`. Pusta ścieżka oznacza cały dokument. Błędy i ostrzeżenia są deduplikowane po ścieżce i kodzie oraz uporządkowane leksykograficznie według ich zapisu JSON, bez zależności od czasu, losowości i ustawień regionalnych. Kolejność pytań i reguł pozostaje kolejnością danych.

Przykładowe kody: `NIEPOPRAWNY_JSON`, `NIEOBSLUGIWANA_WERSJA`, `NIEZGODNA_LICZBA_PYTAN`, `POWTORZONE_ID`, `POWTORZONE_POLE_JSON`, `NIEPRAWIDLOWY_TYP`, `NIEZGODNOSC_DOMENOWA`, `NIEDOZWOLONE_POLE`. Pozostałe błędy strukturalne mają kod `SCHEMAT_` i kod Zod wielkimi literami. Ostrzeżenia: `NIEZNANE_POLE`, `NIEWYKORZYSTANE_WARIANTY`, `NIEWYKORZYSTANE_PYTANIE_DODATKOWE`, `ZASOB_ZDALNY`, `ZASOB_NIEZDEKODOWANY`. Informacja `PODSUMOWANIE_KONTROLI` wskazuje brak zapisu / wykonania reguł; `DEFINICJA_NIEPOTWIERDZONA` wyjaśnia, że przy błędach strukturalnych nie da się potwierdzić całego zestawu relacji.

Licznik poprawnych pytań nie oznacza poprawności quizu: np. deklaracja 20 przy 18 poprawnych pytaniach nadal blokuje import. Również błędna reguła może blokować definicję przy lokalnie poprawnych pytaniach. Każda zmiana pliku wymaga ponownej walidacji, a nie naprawy na podstawie raportu.

`JSON.parse` sprawdza składnię. Dodatkowa kontrola blokuje powtórzone pola obiektu JSON (również nazwy zapisane różnymi escape'ami), ponieważ standardowy parser wybrałby ostatnią wartość. Nie zmieniamy pliku ani nie wybieramy wersji pola. Nieznane pola są rozpoznawane na podstawie samych schematów Zod, z uwzględnieniem jawnego dyskryminatora konfiguracji; nie tworzymy drugiej ręcznej definicji formatu.

Kontrole obejmują strukturę / typy Zod i semantykę: zgodność wersji, ID i unikalność, liczby, odwołania, rekomendacje, konfiguracje sposobów odpowiedzi, reguły / konflikty i zasoby. Nie dokonujemy automatycznej konwersji typów, np. `"3"` na liczbę. Nieznane pola raportujemy jako ostrzeżenia i zachowujemy w źródle po potwierdzeniu; nie uruchamiamy ich znaczenia. Nieznana `schemaVersion` blokuje import do czasu jawnej obsługi lub migracji. Migracja ma raport zmian i wymaga zatwierdzenia.

## Odpowiedź, decyzja i adnotacja

`Odpowiedz` jest kompozycyjna i ma jedną z dwóch postaci:

- `rodzaj: "standardowa"`, `wartosci`: niepusta tablica wartości. Każda ma `sposobId`, `rodzaj` zgodny z mechaniką oraz pola wartości z powyższej tabeli. Jedno `sposobId` może wystąpić raz. Ranking zachowuje kolejność; skala wariantów nie może oceniać dwa razy tego samego ID. Kombinacja może wskazywać kilka fragmentów tego samego wariantu.
- `rodzaj: "wlasna"`, `tekst` i `analiza`: wynik analizy z `tryb` (`autorska` / `ai`), `interpretacja` i tablicą `potencjalneSkutki`. Sam tekst bez analizy nie jest zatwierdzoną własną odpowiedzią.

`Decyzja` zawiera `id`, `pytanieId`, `odpowiedz`, `zatwierdzono` (czas ISO UTC), `adnotacje` (tablica) oraz opcjonalną `notatka` (tekst użytkownika, również pusty po wyczyszczeniu). To model zatwierdzonego stanu, nie akcja zatwierdzania.

`Adnotacja` ma `id`, `pytanieId`, niepusty `tekst` i opcjonalny `wariantId`. Adnotacje decyzji mają unikalne ID i dotyczą jej pytania. Komentarz jako mechanika `otwarta`, swobodna notatka decyzji i adnotacja konkretnego wariantu pozostają odrębnymi, opcjonalnymi możliwościami.

Przykład odpowiedzi bez jednego zwycięzcy:

```json
{
  "rodzaj": "standardowa",
  "wartosci": [
    {
      "sposobId": "wybor",
      "rodzaj": "wielokrotnyWybor",
      "wariantyId": ["a", "c"]
    },
    {
      "sposobId": "ocena",
      "rodzaj": "skala",
      "cel": "warianty",
      "oceny": [
        { "wariantId": "a", "wartosc": 4 },
        { "wariantId": "c", "wartosc": 5 }
      ]
    },
    {
      "sposobId": "komentarz",
      "rodzaj": "otwarta",
      "tekst": "Łączę dwa rozwiązania."
    },
    {
      "sposobId": "polaczenie",
      "rodzaj": "kombinacjaWariantow",
      "elementy": [
        { "wariantId": "a", "fragment": "układ" },
        { "wariantId": "c", "fragment": "kolorystyka" }
      ]
    }
  ]
}
```

## Sesja i zmiana adaptacyjna — odrębny kontrakt 1.0.0

Etap 6 rozszerza sesję o `dziennikSesji` (`wersja: 1`, `baza`, `zdarzenia`). Pole jest opcjonalne w schemacie dla zgodności z Etapem 5; nowe i zmigrowane sesje je posiadają. Wersja IndexedDB wynosi teraz 3, a format importowanej definicji pozostaje bez zmian. `baza` zachowuje decyzje, archiwum, odłożone ID, miejsce, stan i ostatnią modyfikację sprzed dziennika. Zdarzenia przechowują ciągłe `kolejnosc` od 1 i `czas`; rodzaje: `decyzja` (pytanie, pełna poprzednia / nowa decyzja), `odlozenie` (pytanie i poprzednia decyzja), `nawigacja` (poprzednie / nowe miejsce). Aktualne pola sesji są projekcją replayu, nie zamiennikiem audytu. Migrowana baza zachowuje historyczne informacje bez wymyślania brakujących zdarzeń. Szczegóły kontraktu wykonania opisuje ARCHITEKTURA.md.

`Sesja` ma własne `schemaVersion: "1.0.0"`, `id`, `quizId`, `wersjaQuizu`, `utworzono`, `zmieniono` (czasy ISO UTC), `stan` (`wTrakcie` / `zakonczona`) i `biezacePytanieId` (ID lub null). Wersja formatu sesji i wersja formatu quizu są osobnymi kontraktami, mimo tej samej początkowej wartości.

Etap 5 wykonuje sesje liniowe. `biezacePytanieId: null` wraz z `stan: "wTrakcie"` oznacza przegląd odłożonych pytań po dojściu do końca zestawu, bez utraty listy. `stan: "zakonczona"` wymaga odpowiedzi na wszystkie pytania i pustej listy odłożonych. Sesja wskazuje istniejącą wersję definicji, bez duplikowania treści quizu; brak lub niezgodna wersja blokuje wznowienie. Etap 6 odtwarza ten stan przez replay dziennika zdarzeń.

Wymagane tablice (również puste):

- `decyzje`: aktualne decyzje, najwyżej jedna na `pytanieId`,
- `historiaDecyzji`: poprzednie decyzje; mogą dotyczyć tego samego pytania, ale każde zdarzenie ma inne ID niż aktywne i historyczne decyzje,
- `odlozonePytaniaId`: unikalne ID; odłożone pytanie nie ma aktualnej decyzji,
- `szkiceWlasnychOdpowiedzi`: najwyżej jeden szkic na pytanie,
- `zmianyAdaptacyjne`: aktualny dziennik, unikalne ID i `kolejnosc`,
- `historiaZmianAdaptacyjnych`: poprzednie zmiany, z odrębnymi ID zdarzeń.

Szkic ma `pytanieId`, `tekst` i `stan`: `szkic` (tekst może być pusty), `oczekujeAnalizy` (niepusty tekst) lub `przeanalizowana` (niepusty tekst oraz pełna `analiza`). Żaden stan szkicu nie jest `Odpowiedz` ani `Decyzja`. Edycja może przechowywać szkic obok starej zatwierdzonej decyzji; nowy tekst nie zastępuje jej samoczynnie.

`ZmianaAdaptacyjna` ma `id`, `kolejnosc` (integer >= 0), `rodzaj`, `powod`, `regulaId`, pełną `regula`, `pytanieDoceloweId` oraz `zrodlo` zawierające pełne `pytanie` i zatwierdzoną `decyzja`. Migawki:

- `dodaj`: `przed: null`, `po`: pytanie,
- `pomin`: `przed`: pytanie, `po: null`,
- `modyfikuj`: `przed` i `po`: pytania z tym samym stabilnym ID.

Schemat sprawdza zgodność ID, rodzaju i powodu z kopią reguły, obecność zatwierdzonej wartości wskazanej w warunku oraz ID migawek. Sesja sprawdza unikalność zdarzeń, relację czasu utworzenia / zmiany i daty aktualnych decyzji.

## Granice walidacji Etapu 1

Schemat definicji quizu sprawdza strukturę i opisane wyżej statyczne relacje danych. Samodzielne schematy odpowiedzi / sesji sprawdzają ich strukturę i wewnętrzne relacje, lecz nie mają definicji wskazanego quizu. Nie potwierdzają więc istnienia wszystkich ID w obcym quizie, zgodności odpowiedzi z jego wymaganymi mechanikami, liczby wybranych wariantów, zakresu / kroku oceny, długości tekstu względem konfiguracji ani prawdziwości warunku konkretnej zmiany. Te kontrole wymagają kontekstu quizu i zostaną wykorzystane przy wdrożeniu silnika / sesji. Obecny model nie oblicza ścieżki, nie wykonuje reguł, nie zatwierdza ani nie zapisuje decyzji.

Schematy zachowują nieznane pola przez `z.looseObject` (wyjątek: zamknięta lista pól modyfikacji). Samo zachowanie rozszerzenia nie oznacza obsługi jego znaczenia. Walidator Etapu 2 raportuje ostrzeżenia o takich polach i zachowuje cały odczytany obiekt w `daneZrodlowe`. Nie ma cichej konwersji typów, automatycznej migracji ani domyślnych wartości uzupełniających brakujące dane. Teksty nie są przycinane ani nadpisywane. Sposób komponowania schematów odpowiada [API Zod](https://zod.dev/api).

Neutralne fixture'y w `testy/domena/przyklady.ts`: minimalny quiz tekstowy, pytanie wizualne, pytanie wielokrotnego wyboru + skala wariantów + komentarz + kombinacja, pełna decyzja z adnotacją, quiz adaptacyjny i sesja. Nie są zawartością produkcyjnej biblioteki.

Pliki fixture'ów standardu importu w `testy/import/pliki`: `poprawny.json`, `brak-id.json`, `duplikat-id.json`, `zla-liczba-pytan.json`, `bledna-rekomendacja.json`, `nieistniejace-odwolanie.json`, `nieprawidlowy-typ-pytania.json`, `uszkodzona-skala.json`. Są danymi testowymi; błędne pliki nie są przeznaczone do biblioteki.

Raport będzie mieć osobną wersję oraz referencję do sesji / quizu. Zawierać będzie komplet decyzji, ich opisowe znaczenie, konsekwencje, rekomendacje autora, jawne zmiany, wybrane fragmenty i nierozstrzygnięte kwestie. Specyfikacja wynikowa użyje tylko aktualnych zatwierdzonych decyzji. Schemat raportu i eksport są odłożone; nie traktujemy pliku quizu jako zamiennika eksportu sesji.
