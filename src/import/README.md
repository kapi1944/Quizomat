# Import

Etap 2: `walidujImportQuizu(tekst)` w `walidator.ts` przyjmuje tekst pliku JSON i zwraca strukturalny raport z błędami krytycznymi, ostrzeżeniami i informacjami. Korzysta z kanonicznych schematów domenowych. `json.ts` wykrywa powtórzone pola po weryfikacji składni przez `JSON.parse`, aby nie akceptować cichego nadpisania.

Walidator JSON nie zgaduje wersji, ID, pól, typów ani mechanik. Nie migruje danych, nie wykonuje reguł, nie korzysta z sieci / AI i nie zapisuje do biblioteki. Wynik bez błędów jest kandydatem do świadomego zatwierdzenia, nigdy automatycznym importem. Ostrzeżenia wymagają osobnego potwierdzenia. Etap 3 dodaje `plik.ts` (odczyt UTF-8), ekran w `src/aplikacja/ImportQuizu.tsx` i zapis dopiero po akceptacji przez użytkownika.

Etap 3.5 dodaje niezależne `tekst.ts`: źródło → parser → wstępne pytania i raport → korekta / potwierdzenie zakresu → kanoniczny JSON → ten sam walidator. `ImportTekstu.tsx` obsługuje wklejanie i TXT/MD. Korekta odbywa się w edytorze źródła; ponowne rozpoznanie unieważnia poprzednie zgody. Raport rozdziela normalizacje, interpretacje i błędy, podaje numery wierszy, kategorię, ważność i rozwiązanie. Wybrane pytania z błędami blokują konwersję; odrzucenie fragmentów wymaga osobnego zatwierdzenia częściowego zakresu.

Oryginał, tekst po korekcie, oba raporty, wybrane ID, znacznik niekompletności i kanoniczny obiekt trafiają do `daneZrodlowe` istniejącego wpisu biblioteki. Bez nowego magazynu, migracji ani zmiany kontraktu 1.0.0. Oryginał nie jest zapisywany przed zatwierdzeniem i pozostaje w edytorze przy błędach parsowania. Szczegóły składni i ograniczenia opisuje dokumentacja formatu.

Standard, znaczenie liczników i granice sprawdzania obrazów: `docs/FORMAT_QUIZU.md`. Osiem przykładowych plików: `testy/import/pliki`.
