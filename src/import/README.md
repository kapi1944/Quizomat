# Import

Etap 2: `walidujImportQuizu(tekst)` w `walidator.ts` przyjmuje tekst pliku JSON i zwraca strukturalny raport z błędami krytycznymi, ostrzeżeniami i informacjami. Korzysta z kanonicznych schematów domenowych. `json.ts` wykrywa powtórzone pola po weryfikacji składni przez `JSON.parse`, aby nie akceptować cichego nadpisania.

Nie zgaduje wersji, ID, pól, typów ani mechanik. Nie interpretuje Markdown, nie migruje danych, nie wykonuje reguł, nie korzysta z sieci / AI i nie zapisuje do biblioteki. Wynik bez błędów jest kandydatem do świadomego zatwierdzenia, nigdy automatycznym importem. Ostrzeżenia wymagają osobnego potwierdzenia. UI wyboru pliku i trwały zapis są odłożone.

Standard, znaczenie liczników i granice sprawdzania obrazów: `docs/FORMAT_QUIZU.md`. Osiem przykładowych plików: `testy/import/pliki`.
