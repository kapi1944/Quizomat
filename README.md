# Quizomat

Prywatna, uniwersalna aplikacja PWA wspomagająca podejmowanie decyzji projektowych. Konkretne quizy są danymi, a ich treść pozostaje oddzielona od aplikacji.

## Stan: użytkowy MVP

Dostępne: import kanonicznego JSON 1.0.0 oraz tekstu / TXT / Markdown z raportem, korektą i jawnym zatwierdzeniem; biblioteka IndexedDB; trwałe sesje, kompozycyjne odpowiedzi, replay i jawna adaptacja. Po zakończeniu sesji ekran pokazuje specyfikację aktualnych decyzji, rekomendacje autora, zmiany adaptacyjne oraz pytania nierozstrzygnięte. „Eksportuj” otwiera wybór Markdown / JSON / TXT; dopiero „Generuj” przygotowuje lokalne pobrania. Nieaktualne decyzje pozostają w historii sesji, poza bieżącą specyfikacją. Nie dopisujemy brakujących analiz i konsekwencji. Import częściowy zachowuje oznaczenie w raporcie i eksporcie. PDF i połączenie AI pozostają odłożone.

## Uruchomienie

Node.js 24.15+ LTS (zalecany); obsługiwane także 22.22.2+ LTS i 26+. Wymagania odpowiadają całemu zestawowi narzędzi, w tym jsdom. Zależności są przypięte w `package-lock.json`.

```powershell
npm.cmd ci
npm.cmd run dev
```

Kontrola:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run format:check
```

Podgląd produkcyjny: `npm.cmd run preview`. PWA działa w kompilacji produkcyjnej, na HTTPS lub localhost; tryb developerski nie rejestruje service workera. Po pierwszym pobraniu i aktywacji cache shell może działać offline. Pierwsza wizyta wymaga połączenia. Instalację udostępnia przeglądarka; aplikacja nie wymusza instalacji. Trasy używają fragmentu URL (`/#/biblioteka`), więc nie wymagają konfiguracji przekierowań serwera.

Brak kont, backendu, telemetrii, zewnętrznych fontów i połączenia AI. „Prywatna” określa sposób używania i lokalny kierunek zapisu, nie oznacza zabezpieczenia hostingu hasłem. Publiczne opublikowanie witryny nie jest częścią Etapu 0.

## Test przepływu w przeglądarce

`npm.cmd run test:e2e` uruchamia własny serwer Vite na porcie 5191 (lub `QUIZOMAT_PORT`) i dwa izolowane konteksty prawdziwej przeglądarki. Przebieg MD (1280 px) i TXT (390 px) obejmuje import, raport, akceptację, bibliotekę, odpowiedzi, wznowienie, odświeżenie, zmianę wcześniejszej odpowiedzi, ukończenie, podsumowanie i rzeczywiste pobrania wszystkich trzech formatów. Sprawdza też identyczny JSON po odświeżeniu zakończonej sesji i brak błędów JavaScript. Pliki oraz zrzuty trafiają do ignorowanego `test-results/mvp`.

Playwright jest narzędziem testowym spoza zależności aplikacji. W środowisku Codex można wskazać pakiet z dostępnego runtime:

```powershell
$env:QUIZOMAT_PLAYWRIGHT = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright"
$env:QUIZOMAT_BROWSER = "msedge"
npm.cmd run test:e2e
```

Bez zmiennej runner szuka istniejącego pakietu `playwright`. Domyślna przeglądarka na Windows to zainstalowany Edge; można wskazać `chrome` albo `chromium` z dostępnym binarium Playwright. Test nie instaluje pakietów ani przeglądarek. Szerokość mobilna w Edge nie zastępuje odbioru na fizycznym telefonie; przebieg developerski nie potwierdza instalacji, offline i aktualizacji PWA.

## Kontrakt

- [Założenia projektu](docs/ZALOZENIA_PROJEKTU.md)
- [Architektura](docs/ARCHITEKTURA.md)
- [Etapy 0–17](docs/ROADMAP.md)
- [Format quizu](docs/FORMAT_QUIZU.md)

Konfiguracja korzysta z [Vite](https://vite.dev/guide/) i trybu aktualizacji `prompt` opisanego w [Vite PWA](https://vite-pwa-org.netlify.app/guide/prompt-for-update). Lokalne testy jednostkowe nie potwierdzają instalacji na telefonie ani cyklu aktualizacji w rzeczywistej przeglądarce.
