import { strict as oczekuj } from 'node:assert';
import { spawn as uruchom } from 'node:child_process';
import {
  mkdir as utworzKatalog,
  readFile as odczytajPlik,
} from 'node:fs/promises';
import { createRequire as utworzOdczytPakietow } from 'node:module';
import { fileURLToPath as sciezkaPliku, URL as AdresUrl } from 'node:url';
import proces from 'node:process';
import konsola from 'node:console';
import { Buffer as Bufor } from 'node:buffer';
import {
  setTimeout as odrocz,
  clearTimeout as anulujOpoznienie,
} from 'node:timers';

const wymagaj = utworzOdczytPakietow(import.meta.url);
const { chromium: przegladarkaChromium } = wymagaj(
  proces.env.QUIZOMAT_PLAYWRIGHT ?? 'playwright',
);
const katalogProjektu = sciezkaPliku(new AdresUrl('../../', import.meta.url));
const katalogWynikow = sciezkaPliku(
  new AdresUrl('../../test-results/mvp/', import.meta.url),
);
const port = proces.env.QUIZOMAT_PORT ?? '5191';
const adres = `http://127.0.0.1:${port}`;
const zrodlo = `**1. Czy aktualizacja powinna mieć własny tytuł?**
A. Tytuł obowiązkowy.
B. Tytuł opcjonalny. ⭐
**Sugestia: B** — Autor dopuszcza drobne aktualizacje bez tytułu.

2. Który układ wybrać?
A. Prosty układ.
B. Szczegółowy układ.

3. Czy dodać opis?
A. Dodać opis.
B. Bez opisu.`;

const serwer = uruchom(
  proces.execPath,
  [
    'node_modules/vite/bin/vite.js',
    '--host',
    '127.0.0.1',
    '--port',
    port,
    '--strictPort',
  ],
  {
    cwd: katalogProjektu,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let dziennikSerwera = '';
const gotowosc = new Promise((zakoncz, odrzuc) => {
  const limit = odrocz(
    () => odrzuc(new Error(`Nie uruchomiono Vite: ${dziennikSerwera}`)),
    30000,
  );
  serwer.stdout.on('data', (dane) => {
    dziennikSerwera += dane.toString();
    if (dziennikSerwera.includes('Local:')) {
      anulujOpoznienie(limit);
      zakoncz();
    }
  });
  serwer.stderr.on('data', (dane) => {
    dziennikSerwera += dane.toString();
  });
  serwer.once('error', (blad) => {
    anulujOpoznienie(limit);
    odrzuc(blad);
  });
  serwer.once('exit', (kod) => {
    anulujOpoznienie(limit);
    odrzuc(new Error(`Vite zakończył działanie (${kod}): ${dziennikSerwera}`));
  });
});
let przegladarka;
try {
  await gotowosc;
  await utworzKatalog(katalogWynikow, { recursive: true });
  const kanal =
    proces.env.QUIZOMAT_BROWSER ??
    (proces.platform === 'win32' ? 'msedge' : 'chromium');
  przegladarka = await przegladarkaChromium.launch({
    headless: true,
    ...(kanal === 'chromium' ? {} : { channel: kanal }),
  });
  const bledy = [];
  let liczbaScenariuszy = 0;
  for (const rozszerzenie of ['md', 'txt']) {
    const kontekst = await przegladarka.newContext({
      acceptDownloads: true,
      viewport: { width: rozszerzenie === 'md' ? 1280 : 390, height: 900 },
    });
    const strona = await kontekst.newPage();
    strona.on('pageerror', (blad) => bledy.push(blad.message));
    const przycisk = (nazwa) =>
      strona.getByRole('button', { name: nazwa, exact: true });
    const naglowek = (nazwa) =>
      strona
        .getByRole('heading', { name: nazwa, exact: true, level: 1 })
        .waitFor();
    await strona.goto(`${adres}/#/import`);
    await przycisk('Import tekstowy').click();
    await strona
      .getByLabel('Tytuł pakietu', { exact: true })
      .fill(`Przebieg ${rozszerzenie}`);
    await strona.getByLabel('Język pakietu (np. pl)').fill('pl');
    await strona.getByLabel('Plik TXT lub MD').setInputFiles({
      name: `quiz.${rozszerzenie}`,
      mimeType: rozszerzenie === 'md' ? 'text/markdown' : 'text/plain',
      buffer: Bufor.from(zrodlo),
    });
    await przycisk('Rozpoznaj pytania').click();
    await strona
      .getByRole('heading', { name: 'Podgląd tekstu', exact: true })
      .waitFor();
    oczekuj.match(
      await strona.locator('body').innerText(),
      /Rozpoznane pytania: 3/,
    );
    await strona.getByLabel(/Potwierdzam interpretację/).check();
    await przycisk('Sprawdź kanoniczny JSON').click();
    await strona
      .getByRole('heading', { name: '3 z 3 pytań poprawnych', exact: true })
      .waitFor();
    await przycisk('Zatwierdź import').click();
    await naglowek('Biblioteka');
    await przycisk('Rozpocznij nową').click();
    await naglowek('Czy aktualizacja powinna mieć własny tytuł?');
    await przycisk('Wybierz: Tytuł obowiązkowy.').click();
    await przycisk('Dalej').click();
    await naglowek('Który układ wybrać?');
    const adresSesji = strona.url();
    await strona
      .getByRole('link', { name: 'Wróć do Biblioteki', exact: true })
      .click();
    await strona.getByRole('link', { name: 'Kontynuuj', exact: true }).click();
    await naglowek('Który układ wybrać?');
    oczekuj.equal(strona.url(), adresSesji);
    await strona.reload();
    await naglowek('Który układ wybrać?');
    await przycisk('Wstecz').click();
    await naglowek('Czy aktualizacja powinna mieć własny tytuł?');
    await przycisk('Wybierz: Tytuł opcjonalny.').click();
    await przycisk('Dalej').click();
    await naglowek('Który układ wybrać?');
    await przycisk('Wybierz: Szczegółowy układ.').click();
    await strona
      .getByLabel('Komentarz (opcjonalny)')
      .fill('Zażółć gęślą jaźń — moja uwaga.');
    await przycisk('Zapisz odpowiedź z komentarzem').click();
    await przycisk('Dalej').click();
    await naglowek('Czy dodać opis?');
    await przycisk('Wybierz: Dodać opis.').click();
    await przycisk('Dalej').click();
    await naglowek('Quiz zakończony');
    await strona
      .getByRole('heading', {
        name: 'Specyfikacja Twoich decyzji',
        exact: true,
      })
      .waitFor();
    await strona.screenshot({
      path: `${katalogWynikow}/podsumowanie-${rozszerzenie}.png`,
      fullPage: true,
    });

    async function pobierz(format, dopisek = '') {
      await przycisk('Eksportuj').click();
      for (const etykieta of ['Markdown (.md)', 'JSON (.json)', 'TXT (.txt)'])
        await strona.getByLabel(etykieta, { exact: true }).uncheck();
      await strona
        .getByLabel(
          { md: 'Markdown (.md)', json: 'JSON (.json)', txt: 'TXT (.txt)' }[
            format
          ],
          { exact: true },
        )
        .check();
      const oczekiwanie = strona.waitForEvent('download');
      await przycisk('Generuj').click();
      const plik = await oczekiwanie;
      oczekuj.ok(plik.suggestedFilename().endsWith(`.${format}`));
      const sciezka = `${katalogWynikow}/z-${rozszerzenie}${dopisek}.${format}`;
      await plik.saveAs(sciezka);
      const tekst = await odczytajPlik(sciezka, 'utf8');
      await przycisk('Eksportuj').click();
      return tekst;
    }
    const json = await pobierz('json');
    const raport = JSON.parse(json);
    oczekuj.equal(raport.rodzaj, 'raportDecyzji');
    oczekuj.equal(raport.specyfikacja.length, 3);
    oczekuj.equal(raport.nierozstrzygniete.length, 0);
    oczekuj.equal(
      raport.specyfikacja[0].decyzja.odpowiedz.wartosci[0].wariantId,
      raport.specyfikacja[0].pytanie.warianty[1].id,
    );
    oczekuj.equal(
      raport.specyfikacja[1].decyzja.notatka,
      'Zażółć gęślą jaźń — moja uwaga.',
    );
    oczekuj.equal('historiaDecyzji' in raport, false);
    for (const format of ['md', 'txt']) {
      const tekst = await pobierz(format);
      oczekuj.match(tekst, /Rekomendacja autora/);
      oczekuj.match(tekst, /Szczegółowy układ/);
      oczekuj.match(tekst, /Zażółć gęślą jaźń/);
    }
    await strona.reload();
    await naglowek('Quiz zakończony');
    oczekuj.equal(await pobierz('json', '-po-wznowieniu'), json);
    await kontekst.close();
    liczbaScenariuszy += 1;
    konsola.log(
      `PASS: ${rozszerzenie.toUpperCase()} → import → akceptacja → sesja → wznowienie → zmiana odpowiedzi → podsumowanie → JSON / MD / TXT (w tym identyczny JSON po odświeżeniu).`,
    );
  }
  oczekuj.deepEqual(bledy, []);
  konsola.log(
    `PASS: ${liczbaScenariuszy} pełne scenariusze w ${await przegladarka.version()}, brak błędów pageerror. Artefakty: ${katalogWynikow}`,
  );
} finally {
  await przegladarka?.close();
  serwer.kill();
}
