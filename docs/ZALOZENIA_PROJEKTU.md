# Zatwierdzone założenia Quizomatu

Status: pełny kontrakt funkcjonalny projektu, obowiązujący od Etapu 0. Opis funkcji docelowych nie oznacza ich implementacji. Zakres bieżącego etapu opisuje ROADMAP.md.

## Cel i niezależność

Quizomat NIE jest zwykłym testem wiedzy. To uniwersalne narzędzie wspomagające podejmowanie decyzji projektowych. Przykładowe zadanie: „Chcę zaprojektować nowy interfejs gracza”. Quiz może prowadzić przez decyzje, przedstawiać warianty, zalety, wady, konsekwencje i rekomendacje, reagować na wcześniejsze odpowiedzi, dodawać pytania doprecyzowujące, pomijać zbędne, porównywać warianty wizualne, łączyć ich elementy oraz tworzyć kompletną specyfikację wynikającą z decyzji.

**Quizomat jest silnikiem uniwersalnym, a konkretne quizy są danymi.** Kod aplikacji nie może zawierać pojęć konkretnego zastosowania, takich jak Trzebiatów, fabuła gry, zakończenie gry, podpowiedź terenowa, GPS gry czy Kaszana Baszta. Takie informacje mogą występować wyłącznie w danych konkretnego quizu. Repozytorium `C:\GitHub\Projects\Quizomat` jest osobnym projektem. Nie wolno przenosić do niego kodu z `Zwiedzanie_Trzebiatowa`.

## 1. Forma

Osobna PWA, projektowana przede wszystkim na telefon, działająca także na komputerze i instalowalna jako aplikacja.

## 2. Użytkownik

Na razie jedna osoba. Brak logowania, kont i systemu ról.

## 3. Dane

Local-first: zapis przede wszystkim lokalny. Funkcje niewymagające AI mają działać offline. Zapis lokalny nie jest synchronizacją ani kopią zapasową; docelowy eksport pozwoli zachować dane poza przeglądarką.

## 4. Quizy

Treść jest całkowicie oddzielona od aplikacji. Quizy są importowanymi, standaryzowanymi danymi. Podstawowy format maszynowy to JSON. Format musi być wersjonowany przez `schemaVersion`.

## 5. Podstawowe pytania

Pytanie i odpowiedzi, przykładowo A / B / C / Inne. Liczba wariantów nie jest ograniczona na sztywno do trzech. Litery są opcjonalnymi etykietami prezentacji; identyfikację zapewniają stabilne ID.

## 6. Zawartość wariantu

Wariant odpowiedzi może zawierać opis, zalety, wady, konsekwencje, dodatkowe wyjaśnienie i opcjonalną zawartość wizualną.

## 7. Rekomendacje

Autor quizu może wskazać rekomendowany wariant. Quizomat może pokazywać rekomendację wraz z uzasadnieniem. Tryb pokazywania rekomendacji można włączyć lub wyłączyć w ustawieniach.

## 8. UI rekomendacji

Subtelny pomarańczowy akcent i lekkie, płynne powiększenie.

## 9. UI wyboru

Wybór użytkownika otrzymuje mocniejszą zieleń, wyraźnie grubszy border i większe, płynne powiększenie niż rekomendacja. Rekomendacja NIGDY nie może wyglądać jak dokonany wybór. Wybór ma pierwszeństwo wizualne, a oznaczenie rekomendacji pozostaje odrębną informacją. Stan musi być czytelny także bez rozróżniania kolorów; ustawienie ograniczonego ruchu wyłącza animację.

## 10. „Inne”

Własna odpowiedź nie jest stosowana automatycznie. Najpierw trafia do analizy. Użytkownik otrzymuje interpretację i potencjalne skutki, a dopiero potem wybiera „Zatwierdź odpowiedź” albo „Zmień odpowiedź”. Szkic i wynik analizy są oddzielone od zatwierdzonej decyzji. Jeżeli dana analiza jawnie wymaga AI, brak połączenia nie może powodować automatycznego zatwierdzenia.

## 11. Adaptacyjność

Quiz może dodać, zmodyfikować lub pominąć pytanie. Każda operacja MUSI być jawna. Należy zapisać i pokazać:

- rodzaj zmiany,
- powód,
- regułę,
- wcześniejsze pytanie,
- wcześniejszą odpowiedź, która spowodowała zmianę.

Zakazana jest niewidzialna modyfikacja ścieżki. Dane źródłowe quizu pozostają niezmienne, a zmiany tworzą wynik obliczenia ścieżki wraz z dziennikiem wyjaśnień.

## 12. Cofanie

Zmiana wcześniejszej odpowiedzi powoduje ponowne obliczenie dalszej ścieżki. Decyzje, które tracą aktualność, nie mogą po cichu pozostać w wynikowej specyfikacji. Użytkownik musi widzieć skutki przeliczenia.

## 13. Odkładanie

Każde pytanie można oznaczyć „Wróć później”. Odłożenie nie oznacza odpowiedzi ani pominięcia przez regułę. Nierozstrzygnięte pytania pozostają widoczne w raporcie.

## 14. Sesje

Postęp jest zapisywany pomiędzy uruchomieniami. Docelowo zapis obejmuje wersję quizu, zatwierdzone decyzje, szkice, odłożone pytania i historię jawnych zmian. Błędy zapisu muszą być komunikowane, bez fałszywego potwierdzania trwałości.

## 15. Raport

Pełny raport decyzji, a nie lista liter A / B / C. Zawiera treści pytań i odpowiedzi, interpretacje, wybrane elementy wariantów, zalety, wady, konsekwencje, rekomendacje odróżnione od wyborów, uzasadnienia zmian ścieżki i nierozstrzygnięte kwestie. Wynikowa specyfikacja wynika z faktycznie zatwierdzonych decyzji; nie dopisuje niewybranych założeń.

## 16. Eksport

TXT, Markdown, JSON i PDF. Użytkownik może wybrać dowolną kombinację tych formatów. JSON zachowuje strukturę decyzji i historii; pozostałe formaty prezentują ten sam raport w formie czytelnej dla człowieka.

## 17. Panel eksportu

Panel pojawia się dopiero po kliknięciu „Eksportuj”. Formaty są kolorowymi pillami / znacznikami, NIE klasycznymi checkboxami. Aktywny format ma kolorowe wypełnienie. Nieaktywny ma przygaszone wypełnienie tego samego koloru i nadal widoczny kolorowy border. Wybór wielu formatów jest niezależny. Pliki powstają dopiero po kliknięciu „Generuj”; przy pustym wyborze generowanie jest niedostępne. Docelowo znaczniki obsługują klawiaturę i komunikują stan przez `aria-pressed`.

## 18. Import

Błędy i ostrzeżenia nie mogą być ignorowane po cichu. Najpierw raport importu, potem decyzja użytkownika. Błędy blokują import; ostrzeżenia wymagają świadomego potwierdzenia. Samo wskazanie pliku nie zmienia biblioteki.

## 19. Kontrola importu

Co najmniej: `schemaVersion`, ID quizu, deklarowana i faktyczna liczba pytań, stabilne ID pytań, liczba odpowiedzi, poprawność rekomendowanej odpowiedzi oraz poprawność typów danych. Sprawdzane będą również unikalność ID, odwołania w regułach, zgodność prezentacji i sposobów odpowiedzi oraz zasoby wizualne. Raport identyfikuje miejsce, wagę i przyczynę problemu. Nieznana wersja wymaga jawnej obsługi, a nie zgadywania formatu.

## 20. Metadane

Techniczne metadane quizu nie są eksponowane podczas normalnego przechodzenia quizu. Są dostępne w raporcie importu i diagnostyce. Wersje oraz ID są zachowane w danych sesji i eksporcie JSON.

## 21. Pytania wizualne

Pełnoprawny typ prezentacji. Użytkownik może oglądać obrazy i warianty, powiększać je, wybierać kilka, oceniać skalą, łączyć warianty i dodawać własne adnotacje. Przykład: „Z A biorę układ, z C kolorystykę”. NIE trzeba wskazywać jednego zwycięzcy. Opisy alternatywne i sposób obsługi pozostają dostępne także bez samego obrazu.

## 22. Dwie niezależne osie

RODZAJ / PREZENTACJA pytania jest oddzielona od SPOSOBU UDZIELANIA ODPOWIEDZI. Jedno pytanie wizualne może równocześnie obsługiwać wielokrotny wybór, skalę, komentarz i kombinację wariantów. Model nie może sprowadzać pytania do jednego wyłącznego „typu”.

## 23. Docelowe sposoby odpowiedzi

Pojedynczy wybór, wielokrotny wybór, TAK / NIE, PRAWDA / FAŁSZ, odpowiedź otwarta, skala, ranking i kombinacja wariantów. Komentarz / adnotacja może uzupełniać inne sposoby. Limity i reguły poprawności odpowiedzi należą do danych konkretnego pytania.

## 24. AI

AI jest osobnym modułem. Silnik quizu NIE może zależeć od AI. Quiz można przejść bez AI, poza funkcjami jawnie wymagającymi analizy AI. Stałe reguły adaptacji i rekomendacje autora nie wymagają modelu. AI może proponować interpretacje, lecz nie zatwierdza decyzji za użytkownika i nie modyfikuje niewidzialnie ścieżki.

## 25. Klucze i pośrednictwo

Klucza API nie wolno umieszczać w PWA, jej kodzie, zasobach, lokalnym magazynie ani zmiennych `VITE_*`. Ewentualne połączenie z modelem należy projektować przez osobną prywatną warstwę pośrednią. Teraz nie powstaje duży backend ani konta użytkowników. Implementacja integracji wymaga osobnego, wyraźnego polecenia.

## Technologia i granica Etapu 0

React, TypeScript, Vite, React Router, PWA, Vitest, Testing Library, Zod, ESLint i Prettier. UI, dokumentacja, nazwy funkcji, zmiennych i komponentów po polsku; identyfikatory bez polskich znaków. Oryginalne nazwy wymagane przez narzędzia i zewnętrzne API zachowują ich kontrakt.

Struktura rozdziela aplikację / UI, domenę, silnik quizu, import, trwałe dane, eksport, AI, komponenty i testy. Etap 0 obejmuje tylko fundament techniczny, dokumentację i shell: start oraz placeholdery biblioteki, importu i ustawień. Nie obejmuje właściwego silnika ani docelowych ekranów quizu. Wymagane kontrole: testy, typecheck, lint i build. Zamknięcie: jeden lokalny commit `chore(etap-0): fundament Quizomatu` i push.
