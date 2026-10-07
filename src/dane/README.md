# Trwałe dane

Etap 3: `biblioteka.ts` zapisuje zaakceptowane quizy oraz ich pełne dane źródłowe w IndexedDB (`quizomat`, wersja 1, zbiór `quizy`). Zapis kończy się dopiero po zatwierdzeniu transakcji. Powtórne ID nie nadpisuje wpisu; błędy są widoczne w UI. Cache PWA jest osobny od magazynu danych użytkownika.

Zapis zasobów, sesji i ustawień, zarządzanie wersjami quizu oraz dalsze migracje pozostają odłożone.
