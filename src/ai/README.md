# Analiza własnej odpowiedzi — Etap 8

`analizator.ts` udostępnia neutralny interfejs `Analizator.analizuj`: otrzymuje pytanie, tekst i definicję quizu, zwraca asynchronicznie istniejącą analizę domenową. Nie zapisuje sesji, nie tworzy decyzji i nie wykonuje adaptacji. Wynik jest walidowany przed zapisaniem; opcjonalne ID dotkniętych pytań muszą istnieć w quizie. Lista pytań jest informacją dla użytkownika, nie poleceniem zmiany ścieżki.

`FakeAnalizator` służy wyłącznie testom. Zwraca deterministyczny wynik zależny od tekstu i pytania, a wariant awaryjny odrzuca analizę. Nie ma zegara, losowania ani sieci.

Ekran domyślnie używa lokalnej analizy skonfigurowanej przez autora (`tryb: autorska`), pokazanej jako propozycja autora. Dla `tryb: ai` usługa zgłasza niedostępność: szkic pozostaje zapisany, można ponowić analizę lub zmienić tekst. Nie podstawiamy FakeAnalizatora za rzeczywistą analizę. Brak integracji AI, kluczy API i żądań sieciowych.

Wynik zachowuje istniejące `tryb`, `interpretacja` i `potencjalneSkutki`. Ten sam schemat otrzymał opcjonalne tablice `zalety`, `wady`, `dotknietePytaniaId`, `niejednoznacznosci`; wcześniejsze analizy pozostają poprawne. O zatwierdzeniu decyduje użytkownik.
