# Trwałe dane

Etap 5: `biblioteka.ts` nadal zapisuje zaakceptowane quizy i pełne dane źródłowe. To samo otwarcie bazy `quizomat` wykonuje migrację 1 → 2: dodaje `sesje` z kluczem `id` i indeksem `quizId`, zachowując `quizy` bez zmian. Świeża instalacja tworzy oba zbiory. Cache PWA jest osobny od magazynu danych użytkownika.

Etap 6: ta sama baza ma wersję 3. Migracja 2 → 3 dodaje do każdej dotychczasowej sesji bazę dziennika z pełnym dotychczasowym stanem i pustą listą nowych zdarzeń. Zachowuje stare decyzje, archiwum i rozszerzenia; nie zgaduje kolejności dawnych zmian. Nie tworzy nowego zbioru ani kopii definicji. Błąd migracji wycofuje całą transakcję. Zapis sprawdza replay oraz niezmienioną bazę i prefiks wcześniejszych zdarzeń. Audyt i aktualna projekcja sesji zapisują się atomowo.

`sesje.ts` zapisuje istniejący domenowy model `Sesja`, bez kopii definicji quizu. Sprawdza wersję i poprawność wznowienia przez silnik, a następnie porównuje poprzedni zapisany stan w transakcji, aby nie nadpisywać zmian innej karty. Sukces oznacza `oncomplete`, abort zachowuje poprzedni poprawny stan. `poprzednia: null` służy wyłącznie do tworzenia nowej sesji; istniejącego ID nie zastępuje.

Zasoby, zarządzanie wersjami quizu i dalsze migracje pozostają odłożone. Ustawienie rekomendacji korzysta z localStorage. Decyzję o referencji do niezmiennej definicji i zachowanie autosave opisuje `docs/ARCHITEKTURA.md`.
