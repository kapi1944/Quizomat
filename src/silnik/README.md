# Silnik quizu

Etap 4: `runtime.ts` wykonuje liniowy przebieg bazowych pytań w kolejności definicji. Przyjmuje poprawną definicję z istniejącej Biblioteki i tworzy jej osobną kopię. Czyste funkcje zwracają nowy stan, nie mutują wejścia i nie zależą od Reacta, magazynu, sieci ani AI. ID i czas zdarzenia dostarcza wywołujący; identyczne wejścia dają identyczny wynik.

Obsługiwane jest tekstowe pytanie z jednym sposobem `pojedynczyWybor`. Wybór tworzy kanoniczną `Decyzja`; semantyka sprawdza bieżące pytanie, sposób i rodzaj odpowiedzi, istniejący wariant, wymagane wartości oraz odwołania adnotacji. Zmiana wyboru przenosi poprzednią decyzję do roboczej historii. Dalej wymaga poprawnej decyzji, Wstecz zachowuje wybory, a indeks równy liczbie pytań oznacza zakończenie. Powrót z zakończenia umożliwia edycję ostatniego wyboru.

Wynik operacji jawnie rozróżnia `gotowy`, `blad` i `nieobslugiwane`. Pozostałe mechaniki, kompozycje sposobów oraz prezentacje z obrazami otrzymują odmowę wykonania. Etap 7 wykonuje reguły adaptacyjne na aktywnej ścieżce. `innaOdpowiedz` nie blokuje standardowego wyboru, ale własna odpowiedź zawsze otrzymuje odmowę i nie staje się zwykłym wariantem.

Etap 5: `sesja.ts` wiąże stan runtime z istniejącym modelem domenowym `Sesja`. Czyste funkcje tworzą sesję, walidują jej wznowienie, odwzorowują zmiany runtime oraz obsługują odłożenie i powrót. Sesja przechowuje referencję do wersji definicji, decyzje, aktualne pytanie i odłożone ID. Odłożenie nie jest odpowiedzią; po dojściu do końca zestawu sesja z odłożonymi pytaniami nadal ma `stan: "wTrakcie"`. Powrót do pytania nie usuwa go z listy. Dopiero poprawny wybór rozstrzyga odłożone pytanie.

Etap 6: `replay.ts` odtwarza projekcję sesji z bazy i uporządkowanych zdarzeń domenowych. `sesja.ts` zamienia operację runtime na zdarzenie i wykorzystuje replay, zamiast zapisywać dowolnie zmieniony stan. Zdarzenia decyzji zachowują pełną poprzednią / nową decyzję, pytanie, czas i kolejność. Odczyt jest czysty; nie dopisuje zdarzeń. Wznowienie odrzuca rozbieżność projekcji i dziennika. `historiaDecyzji` jest archiwum poprzednich decyzji, a dziennik przechowuje kolejność operacji. Migracja dawnych sesji zachowuje dokładną bazę, bez zgadywania historii. Etap 7 podłącza do tego samego replayu adaptację.

Silnik nadal nie zna IndexedDB ani Reacta. Zapis i autosave organizują warstwy danych oraz aplikacji. Przepływ szkic → analiza → potwierdzenie pozostaje odłożony. Decyzje późniejszych, niezależnych pytań liniowych pozostają ważne i są ponownie walidowane przy przeliczeniu.

## Etap 7 — deterministyczna adaptacja

`adaptacja.ts` oblicza aktywne pytania od niezmiennej definicji quizu i aktualnych zatwierdzonych decyzji. Nie tworzy formatu reguł ani nowego magazynu. `pytania` w runtime to projekcja ścieżki; `quiz` pozostaje oryginalną definicją. Dalej, Wstecz, odłożenie, zakończenie i wznowienie używają aktywnych pytań.

Kolejność i konflikty:

1. Pytania bazowe odwiedzamy w kolejności definicji, wstawione w miejscu wskazanym przez `poPytaniuId`. Oceniane są wyłącznie decyzje odwiedzonych pytań aktywnej ścieżki.
2. Po każdym pytaniu przeglądamy tablicę `reguly` od początku. Reguła wymaga zatwierdzonej wartości wskazanego sposobu odpowiedzi, spełnionego warunku i obecnego celu / kotwicy. Brak odpowiedzi nie spełnia warunku. Obsługiwane operatory modelu: `rowne`, `zawieraWariant`, `coNajmniej`; runtime odpowiedzi nadal obsługuje pojedynczy wybór.
3. Każda reguła wykonuje się najwyżej raz w jednym przeliczeniu. Po wykonaniu operacji powtarzamy przegląd tablicy, aż żadne oczekujące dodanie / modyfikacja / pominięcie nie może się wykonać. Pozwala to obsłużyć zależne kotwice dodatkowe umieszczone później w tablicy reguł. Liczba wykonanych reguł ogranicza liczbę powtórzeń.
4. Kilka dodatków do jednej kotwicy zachowuje kolejność wykonania. Kolejny dodatek trafia za ostatni dodatek tej kotwicy. Pominięty cel / kotwica nie jest dostępny dla oczekującej operacji; niewykonana operacja nie tworzy zmiany.
5. Konflikt kilku operacji na tym samym pytaniu odrzuca istniejący walidator 1.0.0, również przed startem runtime. Nie wybieramy zwycięzcy. Cykle i niedozwolone zależności od późniejszych odpowiedzi również odrzuca istniejący model.
6. Po przeliczeniu usuwamy z aktualnych decyzji odpowiedzi pytań spoza ścieżki, archiwizujemy je i ponawiamy przeliczenie bez tych źródeł aż do stabilizacji. Każde powtórzenie usuwa co najmniej jedną decyzję. Historyczna odpowiedź nie wraca samoczynnie po ponownym dodaniu pytania. Niezależne aktualne odpowiedzi pozostają ważne.

Każda wykonana operacja tworzy istniejącą `ZmianaAdaptacyjna`: rodzaj, cel, regułę z ID i powodem, źródłowe pytanie i pełną decyzję oraz migawki przed / po. Kolejność jest liczona od 0; ID wynika jednoznacznie z ID reguły (z długością jako separatorem) i źródłowej decyzji. Nie używamy zegara ani losowania podczas przeliczenia. Modyfikacja obejmuje istniejące pola: treść, wyjaśnienie i rekomendację wariantu; nie zmienia definicji wariantów ani mechaniki odpowiedzi.

Replay Etapu 6 odtwarza adaptację po każdym zdarzeniu. Zmiana wcześniejszej odpowiedzi przelicza całą ścieżkę wraz z zależnymi regułami. Wycofane zmiany trafiają do `historiaZmianAdaptacyjnych`; pełny audyt decyzji pozostaje w dzienniku. Po odłożeniu źródła znikają jego konsekwencje; jeżeli znika następne pytanie, wybieramy pierwsze dalsze zachowane pytanie albo koniec zestawu. Wznowienie weryfikuje także zgodność obu tablic adaptacji z replayem. Zapis korzysta z dotychczasowej transakcji IndexedDB, bez migracji i bez zmiany wersji formatu.

UI pokazuje wszystkie aktualne operacje, także pominięcia, jako „Pytanie dodane”, „Pytanie zmodyfikowane” lub „Pytanie pominięte”. „Dlaczego?” ujawnia powód, regułę i źródłowe pytanie / odpowiedź. Historyczna odpowiedź jest oznaczona jako nieaktualna decyzja. Testy obejmują operacje, konflikty, zależności, cofanie, wielokrotną zmianę, osierocenie, serializację oraz ponowne otwarcie ekranu z IndexedDB.
