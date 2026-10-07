# Quizomat

Prywatna, uniwersalna aplikacja PWA wspomagająca podejmowanie decyzji projektowych. Konkretne quizy są danymi, a ich treść pozostaje oddzielona od aplikacji.

## Stan: Etap 0

Dostępne: responsywny shell React, nawigacja Start / Biblioteka / Import / Ustawienia, manifest, ikony, cache powłoki offline i komunikat aktualizacji PWA. Biblioteka, import i ustawienia są placeholderami. Silnik quizu, zapis danych użytkownika, raporty, eksport i AI nie są jeszcze zaimplementowane.

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

## Kontrakt

- [Założenia projektu](docs/ZALOZENIA_PROJEKTU.md)
- [Architektura](docs/ARCHITEKTURA.md)
- [Etapy 0–17](docs/ROADMAP.md)
- [Format quizu](docs/FORMAT_QUIZU.md)

Konfiguracja korzysta z [Vite](https://vite.dev/guide/) i trybu aktualizacji `prompt` opisanego w [Vite PWA](https://vite-pwa-org.netlify.app/guide/prompt-for-update). Lokalne testy jednostkowe nie potwierdzają instalacji na telefonie ani cyklu aktualizacji w rzeczywistej przeglądarce.
