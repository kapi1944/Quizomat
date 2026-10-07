# Format quizu JSON — kontrakt 1.0.0

Status: kontrakt danych do implementacji w Etapie 1. Etap 0 nie udostępnia parsera, walidatora Zod, importu ani silnika. Ten dokument określa wspólny format autora quizu i przyszłej aplikacji; nie potwierdza działającej obsługi poniższych pól.

Quiz zawiera treść i reguły. Sesja zawiera decyzje konkretnego użytkownika. Raport i eksport JSON mają osobne wersjonowane obwiednie; nie mieszamy ich z plikiem źródłowym quizu. Nie używamy nazw ani reguł zależnych od konkretnego zastosowania.

## Wersje i pola główne

| Pole               | Typ                | Zasada                                                              |
| ------------------ | ------------------ | ------------------------------------------------------------------- |
| `schemaVersion`    | string             | W tej wersji dokładnie `1.0.0`; wersja kontraktu, nie aplikacji     |
| `id`               | string             | Niepuste stabilne ID quizu                                          |
| `wersjaQuizu`      | string             | Wersja treści, np. `1.0.0`; zmiana treści tworzy nową wersję        |
| `tytul`            | string             | Niepusty tytuł widoczny w bibliotece                                |
| `opis`             | string, opcjonalny | Opis celu decyzji                                                   |
| `jezyk`            | string             | Np. `pl`; niepusta deklaracja języka                                |
| `liczbaPytan`      | integer >= 1       | Deklarowana liczba pytań bazowych; musi równać się `pytania.length` |
| `pytania`          | tablica pytań      | Bazowa kolejność, co najmniej jedno pytanie                         |
| `pytaniaDodatkowe` | tablica pytań      | Pula pytań aktywowanych regułami; może być pusta                    |
| `reguly`           | tablica reguł      | Jawne operacje adaptacyjne; może być pusta                          |

`liczbaPytan` nie obejmuje puli `pytaniaDodatkowe`. Raport importu pokazuje osobno deklarowaną / faktyczną liczbę bazową oraz liczbę pytań dodatkowych. Liczba pytań w sesji może się zmieniać wskutek reguł i nie jest stałą quizu.

ID mają format `[a-zA-Z0-9][a-zA-Z0-9._-]*`, są niepuste i nie zależą od indeksu tablicy, tekstu ani litery wariantu. ID pytań muszą być unikalne łącznie w obu pulach; ID reguł w quizie; ID wariantów i sposobów odpowiedzi w obrębie pytania. Zmieniona treść decyzji nie może udawać starego wariantu o tym samym znaczeniu. Identyfikatory obcych API, w szczególności `schemaVersion`, zachowują ustaloną nazwę.

## Pytanie i wariant

Pytanie zawiera wymagane `id`, `tresc` (niepusty tekst), `prezentacja`, `warianty` (tablica, również pusta dla samego tekstu / skali) oraz `sposobyOdpowiedzi` (niepusta tablica). Opcjonalne: `wyjasnienie`, `rekomendacja` i `innaOdpowiedz`.

`prezentacja` ma `rodzaj`: `tekstowa`, `wizualna` lub `mieszana`. Wizualna / mieszana wymaga co najmniej jednego obrazu przy pytaniu lub wariancie. `prezentacja.obrazy` to opcjonalna tablica zasobów. Prezentacja nie ustala sposobu odpowiedzi.

Wariant zawiera wymagane `id` i `etykieta`, opcjonalne `opis`, `zalety` (tablica tekstów), `wady` (tablica tekstów), `konsekwencje` (tablica tekstów), `wyjasnienie` i `obrazy` (tablica zasobów). Nie ma sztywnego maksimum trzech wariantów. Puste lub powtarzające się ID są błędem. Liczba wariantów jest sprawdzana względem sposobów odpowiedzi, nie według jednej globalnej liczby.

`rekomendacja` zawiera `wariantId` i niepuste `uzasadnienie`. Musi wskazywać istniejący wariant tego pytania. To informacja autora, nigdy domyślny wybór użytkownika. Ustawienie widoczności należy do aplikacji / sesji, nie zmienia rekomendacji w źródle quizu.

`innaOdpowiedz` zawiera `etykieta` (zwykle „Inne”) oraz `analiza`:

- `tryb: "autorska"`, `interpretacja` i `potencjalneSkutki` (tablica tekstów): jawnie opisana przez autora analiza lokalna; UI nie przedstawia jej jako indywidualnego wyniku modelu,
- albo `tryb: "ai"`: funkcja jawnie wymaga analizy AI; bez niej szkic nie jest zatwierdzany i użytkownik może zmienić odpowiedź lub wrócić później.

„Inne” nie jest wariantem automatycznie akceptowanym po wpisaniu tekstu. Sesja przechowuje osobno szkic, analizę, jej pochodzenie i dopiero potwierdzoną własną decyzję. Brak analizy nie może skutkować domyślnym zastosowaniem tekstu. Silnik nie wywołuje AI; otrzymuje już zatwierdzoną odpowiedź.

## Sposoby odpowiedzi — niezależne od prezentacji

Każdy element `sposobyOdpowiedzi` zawiera stabilne `id`, `rodzaj` oraz `wymagany` (boolean). Dopuszczalne konfiguracje:

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

Skala wymaga zgodności wartości z zakresem i krokiem; dla `cel: "warianty"` oceny wskazują istniejące warianty. Ranking nie jest wyborem zwycięzcy; przechowuje kolejność. Kombinacja wymaga niepustego opisu `fragment`, np. „układ”; nie musi wskazywać jednego zwycięskiego wariantu i może wskazywać różne fragmenty tego samego wariantu. Pole `adnotacja` zawiera własny komentarz.

Kilka sposobów może współistnieć, np. wielokrotny wybór + skala wariantów + kombinacja + opcjonalna odpowiedź otwarta. Walidator sprawdza każdy aktywny sposób osobno. `wymagany: false` oznacza, że można pominąć ten sposób w odpowiedzi; nie jest to reguła pominięcia całego pytania. Każde pytanie można odłożyć niezależnie od `wymagany`.

Nie jest dozwolona sprzeczna konfiguracja (np. skala wariantów bez wariantów, ranking z maksimum większym od ich liczby). Dla pytań z samym TAK / NIE, PRAWDA / FAŁSZ, tekstem lub skalą pytania `warianty` może być puste. Niepusta lista wariantów bez sposobu odnoszącego się do nich wymaga ostrzeżenia w raporcie.

## Zasoby wizualne i offline

Zasób zawiera `id`, `opisAlternatywny` (niepusty tekst) oraz jedno źródło:

- `dane`: data URL obrazu PNG / JPEG / WebP — zawartość trafia docelowo do lokalnego magazynu po zatwierdzeniu importu,
- albo `url`: absolutny adres HTTPS — import informuje o zależności sieciowej; obraz musi zostać zapisany lokalnie, aby był dostępny offline.

Nie przyjmujemy skryptów, aktywnego HTML, wykonywalnego SVG ani lokalnych ścieżek plików użytkownika. Teksty są renderowane jako tekst. Brak możliwości pobrania obrazu daje jawne ostrzeżenie lub błąd, jeśli bez niego pytanie wizualne nie jest użyteczne. Użytkownik nie może otrzymać deklaracji pełnej gotowości offline przy brakujących zasobach. Limity rozmiaru pliku i zasobów trzeba ustalić i przetestować podczas implementacji importu; nie udajemy, że istnieją w Etapie 0.

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

Wskazane pytania, sposoby i warianty muszą istnieć, a warunek musi odnosić się do decyzji wcześniejszej niż zmieniany fragment ścieżki. Cykl zależności, sprzeczne operacje na tym samym pytaniu lub niejednoznaczne miejsce dodania to błąd importu. Nie rozwiązujemy konfliktu przez ciche nadpisanie. Szersze operatory i zmiany modelu odpowiedzi wymagają jawnego rozszerzenia kontraktu.

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

Najpierw odczyt i raport, następnie decyzja. Raport przedstawia rozpoznaną wersję, ID quizu, liczby pytań, dodatkowe pytania, liczbę wariantów dla każdego pytania oraz listy błędów i ostrzeżeń. Każda pozycja ma ścieżkę pola (np. `pytania[0].rekomendacja.wariantId`), kod problemu i opis po polsku. Zatwierdzenie bez błędów zapisuje całość transakcyjnie; anulowanie nie zmienia biblioteki.

Kontrole obejmują strukturę / typy Zod i semantykę: zgodność wersji, ID i unikalność, liczby, odwołania, rekomendacje, konfiguracje sposobów odpowiedzi, reguły / konflikty i zasoby. Nie dokonujemy automatycznej konwersji typów, np. `"3"` na liczbę. Nieznane pola raportujemy jako ostrzeżenia i zachowujemy w źródle po potwierdzeniu; nie uruchamiamy ich znaczenia. Nieznana `schemaVersion` blokuje import do czasu jawnej obsługi lub migracji. Migracja ma raport zmian i wymaga zatwierdzenia.

## Sesja i wynik — odrębny kontrakt

Docelowa sesja ma własną `schemaVersion`, ID, referencję do quizu i jego wersji, stan postępu, decyzje indeksowane stabilnymi ID, szkice / analizy, odłożenia, aktualny dziennik zmian i historię. Odpowiedź przechowuje wartości dla każdego `sposobId`; tekst, ocenę, ranking i kombinację zachowuje bez redukcji do liter. Własna odpowiedź zachowuje tekst, interpretację, skutki i potwierdzenie.

Raport ma osobną wersję oraz referencję do sesji / quizu. Zawiera komplet decyzji, ich opisowe znaczenie, konsekwencje, rekomendacje autora, jawne zmiany, wybrane fragmenty i nierozstrzygnięte kwestie. Specyfikacja wynikowa używa tylko aktualnych zatwierdzonych decyzji. Szczegółowe schematy sesji i raportu powstaną w ich etapach; nie traktujemy pliku quizu jako zamiennika eksportu sesji.
