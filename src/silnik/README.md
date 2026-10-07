# Silnik quizu

Etap 4: `runtime.ts` wykonuje liniowy przebieg bazowych pytań w kolejności definicji. Przyjmuje poprawną definicję z istniejącej Biblioteki i tworzy jej osobną kopię. Czyste funkcje zwracają nowy stan, nie mutują wejścia i nie zależą od Reacta, magazynu, sieci ani AI. ID i czas zdarzenia dostarcza wywołujący; identyczne wejścia dają identyczny wynik.

Obsługiwane jest tekstowe pytanie z jednym sposobem `pojedynczyWybor`. Wybór tworzy kanoniczną `Decyzja`; semantyka sprawdza bieżące pytanie, sposób i rodzaj odpowiedzi, istniejący wariant, wymagane wartości oraz odwołania adnotacji. Zmiana wyboru przenosi poprzednią decyzję do roboczej historii. Dalej wymaga poprawnej decyzji, Wstecz zachowuje wybory, a indeks równy liczbie pytań oznacza zakończenie. Powrót z zakończenia umożliwia edycję ostatniego wyboru.

Wynik operacji jawnie rozróżnia `gotowy`, `blad` i `nieobslugiwane`. Pozostałe mechaniki, kompozycje sposobów oraz prezentacje z obrazami otrzymują odmowę wykonania. Definicja z regułami adaptacyjnymi nie uruchamia się: reguły nie są ignorowane. `innaOdpowiedz` nie blokuje standardowego wyboru, ale własna odpowiedź zawsze otrzymuje odmowę i nie staje się zwykłym wariantem.

Etap 5: `sesja.ts` wiąże stan runtime z istniejącym modelem domenowym `Sesja`. Czyste funkcje tworzą sesję, walidują jej wznowienie, odwzorowują zmiany runtime oraz obsługują odłożenie i powrót. Sesja przechowuje referencję do wersji definicji, decyzje, aktualne pytanie i odłożone ID. Odłożenie nie jest odpowiedzią; po dojściu do końca zestawu sesja z odłożonymi pytaniami nadal ma `stan: "wTrakcie"`. Powrót do pytania nie usuwa go z listy. Dopiero poprawny wybór rozstrzyga odłożone pytanie.

Silnik nadal nie zna IndexedDB ani Reacta. Zapis i autosave organizują warstwy danych oraz aplikacji. Pełna historia zmian / replay, adaptacja i przepływ szkic → analiza → potwierdzenie pozostają odłożone. Istniejące pola historii zachowują poprzednie decyzje, bez nowego systemu historii ani jego UI.
