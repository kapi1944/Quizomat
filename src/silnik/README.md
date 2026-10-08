# Silnik quizu

Etap 4: `runtime.ts` wykonuje liniowy przebieg bazowych pytań w kolejności definicji. Przyjmuje poprawną definicję z istniejącej Biblioteki i tworzy jej osobną kopię. Czyste funkcje zwracają nowy stan, nie mutują wejścia i nie zależą od Reacta, magazynu, sieci ani AI. ID i czas zdarzenia dostarcza wywołujący; identyczne wejścia dają identyczny wynik.

Runtime obsługuje wszystkie mechaniki modelu 1.0.0, również kilka sposobów równocześnie: pojedynczy i wielokrotny wybór, TAK/NIE, PRAWDA/FAŁSZ, tekst otwarty, skalę pytania i wariantów, ranking oraz kombinację fragmentów wariantów. Wartości mają niezależne `sposobId`. Walidacja sprawdza wymagane sposoby, granice wyboru, długość tekstu, zakres i krok skali, pełność wymaganej oceny wariantów, kolejność bez powtórzeń oraz fragmenty kombinacji. Wybór tworzy kanoniczną `Decyzja`; zmiana przenosi poprzednią decyzję do historii. Dalej wymaga poprawnej decyzji, Wstecz zachowuje wybory. Powrót z zakończenia umożliwia edycję.

Wynik operacji zachowuje dotychczasowy kontrakt `gotowy`, `blad` i `nieobslugiwane`. Ekran pokazuje obrazy pytania i wariantów z opisami alternatywnymi. Etap 7 wykonuje reguły adaptacyjne na aktywnej ścieżce. `innaOdpowiedz` nie blokuje standardowego wyboru, a Etap 8 zachowuje osobny przepływ analizy i świadomego zatwierdzenia własnego tekstu.

Etap 5: `sesja.ts` wiąże stan runtime z istniejącym modelem domenowym `Sesja`. Czyste funkcje tworzą sesję, walidują jej wznowienie, odwzorowują zmiany runtime oraz obsługują odłożenie i powrót. Sesja przechowuje referencję do wersji definicji, decyzje, aktualne pytanie i odłożone ID. Odłożenie nie jest odpowiedzią; po dojściu do końca zestawu sesja z odłożonymi pytaniami nadal ma `stan: "wTrakcie"`. Powrót do pytania nie usuwa go z listy. Dopiero poprawny wybór rozstrzyga odłożone pytanie.

Etap 6: `replay.ts` odtwarza projekcję sesji z bazy i uporządkowanych zdarzeń domenowych. `sesja.ts` zamienia operację runtime na zdarzenie i wykorzystuje replay, zamiast zapisywać dowolnie zmieniony stan. Zdarzenia decyzji zachowują pełną poprzednią / nową decyzję, pytanie, czas i kolejność. Odczyt jest czysty; nie dopisuje zdarzeń. Wznowienie odrzuca rozbieżność projekcji i dziennika. `historiaDecyzji` jest archiwum poprzednich decyzji, a dziennik przechowuje kolejność operacji. Migracja dawnych sesji zachowuje dokładną bazę, bez zgadywania historii. Etap 7 podłącza do tego samego replayu adaptację.

Silnik nadal nie zna IndexedDB ani Reacta. Zapis i autosave organizują warstwy danych oraz aplikacji. Etap 8 wykonuje przepływ szkic → analiza → potwierdzenie. Decyzje późniejszych, niezależnych pytań liniowych pozostają ważne i są ponownie walidowane przy przeliczeniu.

## Etap 7 — deterministyczna adaptacja

`adaptacja.ts` oblicza aktywne pytania od niezmiennej definicji quizu i aktualnych zatwierdzonych decyzji. Nie tworzy formatu reguł ani nowego magazynu. `pytania` w runtime to projekcja ścieżki; `quiz` pozostaje oryginalną definicją. Dalej, Wstecz, odłożenie, zakończenie i wznowienie używają aktywnych pytań.

Kolejność i konflikty:

1. Pytania bazowe odwiedzamy w kolejności definicji, wstawione w miejscu wskazanym przez `poPytaniuId`. Oceniane są wyłącznie decyzje odwiedzonych pytań aktywnej ścieżki.
2. Po każdym pytaniu przeglądamy tablicę `reguly` od początku. Reguła wymaga zatwierdzonej wartości wskazanego sposobu odpowiedzi, spełnionego warunku i obecnego celu / kotwicy. Brak odpowiedzi nie spełnia warunku. Obsługiwane operatory modelu: `rowne`, `zawieraWariant`, `coNajmniej`.
3. Każda reguła wykonuje się najwyżej raz w jednym przeliczeniu. Po wykonaniu operacji powtarzamy przegląd tablicy, aż żadne oczekujące dodanie / modyfikacja / pominięcie nie może się wykonać. Pozwala to obsłużyć zależne kotwice dodatkowe umieszczone później w tablicy reguł. Liczba wykonanych reguł ogranicza liczbę powtórzeń.
4. Kilka dodatków do jednej kotwicy zachowuje kolejność wykonania. Kolejny dodatek trafia za ostatni dodatek tej kotwicy. Pominięty cel / kotwica nie jest dostępny dla oczekującej operacji; niewykonana operacja nie tworzy zmiany.
5. Konflikt kilku operacji na tym samym pytaniu odrzuca istniejący walidator 1.0.0, również przed startem runtime. Nie wybieramy zwycięzcy. Cykle i niedozwolone zależności od późniejszych odpowiedzi również odrzuca istniejący model.
6. Po przeliczeniu usuwamy z aktualnych decyzji odpowiedzi pytań spoza ścieżki, archiwizujemy je i ponawiamy przeliczenie bez tych źródeł aż do stabilizacji. Każde powtórzenie usuwa co najmniej jedną decyzję. Historyczna odpowiedź nie wraca samoczynnie po ponownym dodaniu pytania. Niezależne aktualne odpowiedzi pozostają ważne.

Każda wykonana operacja tworzy istniejącą `ZmianaAdaptacyjna`: rodzaj, cel, regułę z ID i powodem, źródłowe pytanie i pełną decyzję oraz migawki przed / po. Kolejność jest liczona od 0; ID wynika jednoznacznie z ID reguły (z długością jako separatorem) i źródłowej decyzji. Nie używamy zegara ani losowania podczas przeliczenia. Modyfikacja obejmuje istniejące pola: treść, wyjaśnienie i rekomendację wariantu; nie zmienia definicji wariantów ani mechaniki odpowiedzi.

Replay Etapu 6 odtwarza adaptację po każdym zdarzeniu. Zmiana wcześniejszej odpowiedzi przelicza całą ścieżkę wraz z zależnymi regułami. Wycofane zmiany trafiają do `historiaZmianAdaptacyjnych`; pełny audyt decyzji pozostaje w dzienniku. Po odłożeniu źródła znikają jego konsekwencje; jeżeli znika następne pytanie, wybieramy pierwsze dalsze zachowane pytanie albo koniec zestawu. Wznowienie weryfikuje także zgodność obu tablic adaptacji z replayem. Zapis korzysta z dotychczasowej transakcji IndexedDB, bez migracji i bez zmiany wersji formatu.

UI pokazuje wszystkie aktualne operacje, także pominięcia, jako „Pytanie dodane”, „Pytanie zmodyfikowane” lub „Pytanie pominięte”. „Dlaczego?” ujawnia powód, regułę i źródłowe pytanie / odpowiedź. Historyczna odpowiedź jest oznaczona jako nieaktualna decyzja. Testy obejmują operacje, konflikty, zależności, cofanie, wielokrotną zmianę, osierocenie, serializację oraz ponowne otwarcie ekranu z IndexedDB.

## Etap 8 — analizowana własna odpowiedź

`odpowiedz-wlasna.ts` korzysta z istniejącego `SzkicWlasnejOdpowiedzi`: `szkic` → `oczekujeAnalizy` → `przeanalizowana`. Pusty tekst może być szkicem, ale nie może trafić do analizy. Wynik wymaga oczekującego szkicu z dokładnie tym samym tekstem; nieaktualny wynik jest odrzucany. Zmiana tekstu tworzy ponownie `szkic` i usuwa poprzednią analizę. Nie modyfikuje wcześniejszej zatwierdzonej decyzji.

Zapis szkicu i analizy zmienia wyłącznie `szkiceWlasnychOdpowiedzi`, bez zdarzeń decyzji, przeliczenia ścieżki ani aktualizacji czasu ostatniego zdarzenia `zmieniono`. Magazyn nadal sprawdza zgodność dziennika przy zapisie, bez dodawania operacji do replayu. „Zapisz szkic” utrwala tekst w dotychczasowej transakcji IndexedDB. „Przeanalizuj odpowiedź” najpierw utrwala szkic i oczekiwanie, dopiero potem uruchamia usługę. Niezapisany tekst jest oznaczony, blokuje nawigację pytania i uruchamia ostrzeżenie przed zamknięciem okna.

Samo wpisanie tekstu i wynik analizy nie są decyzją. Dopiero „Zatwierdź odpowiedź” tworzy kanoniczną `Decyzja.odpowiedz` rodzaju `wlasna`, zawierającą tekst i pełną analizę, przez dotychczasowy reduktor / dziennik Etapu 6. Replay odtwarza decyzję bez ponownego wywoływania analizatora; adaptacja Etapu 7 przelicza konsekwencje. Poprzednia decyzja trafia do historii. Szkic tego pytania zostaje usunięty po potwierdzeniu, w tym samym zapisie. Dalej akceptuje zatwierdzoną odpowiedź własną. Pytanie musi jawnie dopuszczać `innaOdpowiedz`.

Własny tekst nie jest mapowany na wariant ani mechanikę `otwarta`. Istniejące reguły mają warunki dotyczące standardowych wartości odpowiedzi; zatwierdzenie własnej odpowiedzi może wycofać konsekwencje poprzedniego wyboru, ale analiza nie tworzy nowych reguł. „Potencjalnie dotknięte pytania” w wyniku są informacją, nie wykonaniem operacji.

„Zmień odpowiedź” wraca do szkicu; ponowne zatwierdzenie wymaga nowej analizy. Awaria, niepoprawny wynik lub niedostępność usługi zachowują tekst i stan oczekiwania, pokazują błąd i umożliwiają ponowienie. Restart odtwarza zapisany szkic / oczekiwanie / wynik bez uruchamiania analizy ani automatycznego potwierdzenia. Błąd zapisu korzysta z dotychczasowego „Ponów zapis”; nie wywołujemy usługi przed utrwaleniem oczekiwania.

Neutralny interfejs i deterministyczny FakeAnalizator opisuje [moduł analizy](../ai/README.md). Testy silnika i ekranu sprawdzają rozdzielenie szkicu / wyniku / decyzji, ponowną edycję, restart z IndexedDB, awarie, stan oczekiwania i replay dopiero po potwierdzeniu.

## MVP — formularz i zakończenie

`OdpowiedzStandardowa` zapisuje szkic po 350 ms bez edycji w tym samym magazynie IndexedDB, przez istniejący zapis z kontrolą współbieżności. Opcjonalne metadane `szkiceStandardowe` wykorzystują rozszerzalny zapis sesji; schematy domenowe i JSON quizu 1.0.0 pozostają bez zmian. Szkic przechowuje niezależne wartości i komentarz, również niepełną kombinację. Nie jest decyzją ani źródłem adaptacji. Zatwierdzenie formularza tworzy decyzję przez dotychczasowy dziennik i usuwa szkic w jednej transakcji. Ranking ustala kolejność dodawania, którą można zmienić przyciskiem „Wyżej”. Kombinacja pozwala dodawać wiele opisanych fragmentów z kilku wariantów. Komentarz trafia do istniejącej `Decyzja.notatka`.

Przejrzenie zestawu z odłożonymi pytaniami nadal pozostawia sesję w trakcie. Jawny przycisk „Zakończ z nierozstrzygniętymi pytaniami” dopisuje do istniejącego dziennika nawigację z końca na koniec i kończy sesję, zachowując odłożone ID. Bez odpowiedzi lub świadomego odłożenia każdego aktywnego pytania zakończenie jest odrzucane. Biblioteka udostępnia także zakończone sesje i liczbę nierozstrzygniętych pytań. Ponowne otwarcie, cofnięcie lub powrót do odłożonego pytania umożliwia dalszą edycję i ponowne zakończenie. Własna odpowiedź wymagająca AI nadal wymaga dostępnego analizatora i jawnego zatwierdzenia; nie dodano integracji AI.

Test odbiorowy `testy/silnik/mvp.test.tsx` przechodzi rzeczywisty import w UI, dziewięć wymaganych mechanik naraz, autosave i restart szkicu, adaptacyjne dodanie i modyfikację, restart decyzji, edycję wcześniejszej odpowiedzi z osieroceniem decyzji dodatkowej, zakończenie z odłożeniem, otwarcie z Biblioteki i ponowne zakończenie po rozstrzygnięciu wszystkich pytań. Test działa w jsdom z fake-indexeddb; nie stanowi ręcznego testu przeglądarki, urządzenia ani instalacji PWA.
