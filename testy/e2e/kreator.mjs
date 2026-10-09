/* global document, innerWidth, indexedDB, getComputedStyle */
import { setTimeout as odrocz, clearTimeout as anuluj } from 'node:timers';
import { strict as oczekuj } from 'node:assert';
import { spawn as uruchom } from 'node:child_process';
import { readFile as odczytaj, mkdir as utworzKatalog } from 'node:fs/promises';
import { createRequire as odczytPakietu } from 'node:module';
import proces from 'node:process';
import konsola from 'node:console';
import { Buffer as Bufor } from 'node:buffer';
const { chromium: przegladarkaChromium } = odczytPakietu(import.meta.url)(
  proces.env.QUIZOMAT_PLAYWRIGHT ?? 'playwright',
);
const adres = `http://127.0.0.1:${proces.env.QUIZOMAT_PORT ?? '5195'}`;
const katalog = 'test-results/kreator-json';
const serwer = uruchom(
  proces.execPath,
  [
    'node_modules/vite/bin/vite.js',
    '--host',
    '127.0.0.1',
    '--port',
    proces.env.QUIZOMAT_PORT ?? '5195',
    '--strictPort',
  ],
  { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
let przegladarka;
try {
  await new Promise((zakoncz, odrzuc) => {
    const limit = odrocz(
      () => odrzuc(new Error('Vite nie wystartował')),
      30000,
    );
    serwer.stdout.on('data', (dane) => {
      if (dane.toString().includes('Local:')) {
        anuluj(limit);
        zakoncz();
      }
    });
    serwer.once('error', odrzuc);
    serwer.once('exit', (kod) => {
      anuluj(limit);
      odrzuc(new Error(`Vite: ${kod}`));
    });
  });
  const kanal =
    proces.env.QUIZOMAT_BROWSER ??
    (proces.platform === 'win32' ? 'msedge' : 'chromium');
  przegladarka = await przegladarkaChromium.launch({
    ...(kanal === 'chromium' ? {} : { channel: kanal }),
    headless: true,
  });
  const kontekst = await przegladarka.newContext({
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
  });
  const strona = await kontekst.newPage();
  const bledy = [];
  strona.on('pageerror', (blad) => bledy.push(blad.message));
  const przycisk = (nazwa) =>
    strona.getByRole('button', { name: nazwa, exact: true });
  const pole = (nazwa) => strona.getByLabel(nazwa, { exact: true });
  const wybor = (nazwa) =>
    strona.getByRole('combobox', { name: nazwa, exact: true });
  const naglowek = (nazwa) =>
    strona
      .getByRole('heading', { name: nazwa, exact: true, level: 1 })
      .waitFor();
  async function lista(nazwa, wartosci = []) {
    for (const [indeks, tekst] of wartosci.entries()) {
      await przycisk(`+ Dodaj: ${nazwa}`).click();
      await pole(`${nazwa} — wpis ${indeks + 1}`).fill(tekst);
    }
  }
  const zrodlo = proces.env.QUIZOMAT_REAL_QUIZ
    ? JSON.parse(await odczytaj(proces.env.QUIZOMAT_REAL_QUIZ, 'utf8'))
        .pytania[0]
    : {
        id: 'zrodlo',
        tresc: 'Który projekt wybierasz?',
        prezentacja: { rodzaj: 'tekstowa' },
        warianty: [
          {
            id: 'a',
            etykieta: 'A',
            zalety: ['Szybko'],
            wady: ['Mniej detali'],
          },
          {
            id: 'b',
            etykieta: 'B',
            zalety: ['Czytelnie', 'Elastycznie'],
            wady: ['Dłużej'],
          },
          { id: 'c', etykieta: 'C', zalety: ['Prosto'], wady: ['Koszt'] },
        ],
        sposobyOdpowiedzi: [
          { id: 'wybor', rodzaj: 'pojedynczyWybor', wymagany: true },
        ],
        rekomendacja: { wariantId: 'b', uzasadnienie: 'Najlepszy kompromis' },
        innaOdpowiedz: {
          etykieta: 'Inne — własna odpowiedź',
          analiza: {
            tryb: 'autorska',
            interpretacja: 'Wymaga doprecyzowania',
            potencjalneSkutki: ['Ustal zakres'],
            zalety: ['Swoboda'],
            wady: ['Niepewność'],
          },
        },
      };
  const oczekiwane = JSON.parse(JSON.stringify(zrodlo));
  oczekiwane.warianty[0].konsekwencje = [
    'Dodatkowe ustalenie',
    'Weryfikacja zakresu',
  ];
  await strona.goto(`${adres}/#/nowy-quiz`);
  await pole('Tytuł quizu').fill('Round-trip kreatora');
  await pole('Opis (opcjonalny)').fill('Test kanonicznego JSON 1.0.0');
  await pole('Wersja quizu').fill('2.1.3');
  await przycisk('Dalej: pytania →').click();
  await pole('Treść pytania').fill(zrodlo.tresc);
  await przycisk('+ Dodaj wariant').click();
  for (const [indeks, wariant] of oczekiwane.warianty.entries()) {
    const numer = indeks + 1;
    await pole(`Wariant ${numer}`).fill(wariant.etykieta);
    await strona
      .getByText(`Szczegóły wariantu ${numer}`, { exact: true })
      .click();
    if (wariant.opis)
      await pole(`Opis wariantu ${numer} (opcjonalny)`).fill(wariant.opis);
    if (wariant.wyjasnienie)
      await pole(`Wyjaśnienie wariantu ${numer}`).fill(wariant.wyjasnienie);
    for (const [klucz, etykieta] of [
      ['zalety', 'Zalety'],
      ['wady', 'Wady'],
      ['konsekwencje', 'Konsekwencje'],
    ])
      await lista(`${etykieta} wariantu ${numer}`, wariant[klucz]);
    await strona
      .getByText(`Szczegóły wariantu ${numer}`, { exact: true })
      .click();
  }
  await strona.getByText('Rekomendacja autora', { exact: true }).click();
  await pole('Dodaj rekomendację autora').check();
  await wybor('Rekomendowany wariant').selectOption({
    label: zrodlo.warianty.find(
      (wariant) => wariant.id === zrodlo.rekomendacja.wariantId,
    ).etykieta,
  });
  await pole('Uzasadnienie rekomendacji').fill(
    zrodlo.rekomendacja.uzasadnienie,
  );
  await strona.getByText('Własna odpowiedź „Inne”', { exact: true }).click();
  await pole('Zezwól na własną odpowiedź').check();
  await pole('Etykieta własnej odpowiedzi').fill(zrodlo.innaOdpowiedz.etykieta);
  await pole('Interpretacja autora').fill(
    zrodlo.innaOdpowiedz.analiza.interpretacja,
  );
  for (const [klucz, etykieta] of [
    ['potencjalneSkutki', 'Potencjalne skutki analizy'],
    ['zalety', 'Zalety analizy'],
    ['wady', 'Wady analizy'],
  ])
    await lista(etykieta, zrodlo.innaOdpowiedz.analiza[klucz]);
  await strona.getByText('Własna odpowiedź „Inne”', { exact: true }).click();
  await utworzKatalog(katalog, { recursive: true });
  for (const szerokosc of [1280, 390, 320]) {
    await strona.setViewportSize({ width: szerokosc, height: 900 });
    oczekuj.ok(
      await strona.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Przepełnienie: ${szerokosc}`,
    );
    await strona.screenshot({
      path: `${katalog}/pytanie-${szerokosc}.png`,
      fullPage: true,
    });
  }
  await strona.setViewportSize({ width: 1280, height: 900 });
  for (const [tresc, rodzaj, dodatkowe] of [
    ['Czy kontynuować?', 'takNie', false],
    ['Co ustalamy?', 'otwarta', false],
    ['Dodatkowe doprecyzowanie?', 'takNie', true],
  ]) {
    await przycisk('+ Dodaj pytanie').click();
    await pole('Treść pytania').fill(tresc);
    await wybor('Sposób odpowiedzi').selectOption(rodzaj);
    if (dodatkowe) await wybor('Pula pytania').selectOption('pytaniaDodatkowe');
  }
  await przycisk('Dalej: logika adaptacyjna →').click();
  await przycisk('+ Dodaj regułę').click();
  await pole('Powód reguły').fill('Dopytaj po wyborze B');
  await wybor('Wariant warunku').selectOption({
    label: zrodlo.warianty[1].etykieta,
  });
  await przycisk('Przejdź do podglądu →').click();
  await przycisk('Zapisz do Biblioteki').click();
  await strona
    .getByRole('status')
    .filter({ hasText: 'Quiz zapisany' })
    .waitFor();
  const pobranie = strona.waitForEvent('download');
  await przycisk('Eksportuj JSON').click();
  const plik = await pobranie;
  const eksport = JSON.parse(await odczytaj(await plik.path(), 'utf8'));
  oczekuj.equal(eksport.schemaVersion, '1.0.0');
  oczekuj.equal(eksport.liczbaPytan, 3);
  oczekuj.equal(eksport.pytaniaDodatkowe.length, 1);
  oczekuj.equal(eksport.reguly.length, 1);
  // ID generuje kreator; porównanie remapuje wyłącznie te identyfikatory.
  const pytanie = JSON.parse(JSON.stringify(eksport.pytania[0]));
  const indeksRekomendacji = pytanie.warianty.findIndex(
    (wariant) => wariant.id === pytanie.rekomendacja.wariantId,
  );
  pytanie.id = oczekiwane.id;
  pytanie.warianty.forEach(
    (wariant, indeks) => (wariant.id = oczekiwane.warianty[indeks].id),
  );
  pytanie.sposobyOdpowiedzi.forEach(
    (sposob, indeks) => (sposob.id = oczekiwane.sposobyOdpowiedzi[indeks].id),
  );
  pytanie.rekomendacja.wariantId = oczekiwane.warianty[indeksRekomendacji]?.id;
  oczekuj.deepEqual(pytanie, oczekiwane);
  async function biblioteka(usun = false) {
    return strona.evaluate(
      ({ id, usun }) =>
        new Promise((zakoncz, odrzuc) => {
          const otwarcie = indexedDB.open('quizomat', 3);
          otwarcie.onerror = () => odrzuc(otwarcie.error);
          otwarcie.onsuccess = () => {
            const baza = otwarcie.result;
            const transakcja = baza.transaction(
              'quizy',
              usun ? 'readwrite' : 'readonly',
            );
            const zadanie = usun
              ? transakcja.objectStore('quizy').delete(id)
              : transakcja.objectStore('quizy').get(id);
            transakcja.oncomplete = () => {
              baza.close();
              zakoncz(zadanie.result?.quiz ?? null);
            };
            transakcja.onabort = () => {
              baza.close();
              odrzuc(transakcja.error);
            };
          };
        }),
      { id: eksport.id, usun },
    );
  }
  oczekuj.deepEqual(await biblioteka(), eksport);
  await biblioteka(true);
  oczekuj.equal(await biblioteka(), null);
  await strona.goto(`${adres}/#/import`);
  await pole('Plik quizu JSON').setInputFiles({
    name: 'roundtrip.json',
    mimeType: 'application/json',
    buffer: Bufor.from(JSON.stringify(eksport)),
  });
  await przycisk('Zatwierdź import').click();
  await naglowek('Biblioteka');
  await strona.reload();
  await naglowek('Biblioteka');
  oczekuj.deepEqual(await biblioteka(), eksport);
  await przycisk('Rozpocznij nową').click();
  await naglowek(zrodlo.tresc);
  oczekuj.equal(
    await przycisk(
      `Wybierz: ${zrodlo.warianty[indeksRekomendacji].etykieta}`,
    ).getAttribute('aria-pressed'),
    'false',
  );
  await przycisk(`Wybierz: ${zrodlo.warianty[1].etykieta}`).click();
  await przycisk('Następne pytanie →').click();
  await naglowek('Dodatkowe doprecyzowanie?');
  await pole('TAK').check();
  await przycisk('Zatwierdź odpowiedzi').click();
  await przycisk('Następne pytanie →').click();
  await naglowek('Czy kontynuować?');
  await pole('TAK').check();
  await przycisk('Zatwierdź odpowiedzi').click();
  await przycisk('Następne pytanie →').click();
  await naglowek('Co ustalamy?');
  await strona.getByLabel(/^Treść odpowiedzi/).fill('Ustalenie końcowe');
  await przycisk('Zatwierdź odpowiedzi').click();
  await przycisk('Następne pytanie →').click();
  await naglowek('Quiz zakończony');
  await strona.goto(`${adres}/#/biblioteka`);
  await przycisk('Rozpocznij nową').click();
  await naglowek(zrodlo.tresc);
  await pole('Treść własnej odpowiedzi').fill('Mój osobny projekt');
  await przycisk('Przeanalizuj odpowiedź').click();
  await strona
    .getByText(zrodlo.innaOdpowiedz.analiza.interpretacja, { exact: true })
    .waitFor();
  await przycisk('Zatwierdź odpowiedź').click();
  await przycisk('Następne pytanie →').click();
  await naglowek('Czy kontynuować?');
  for (const [motyw, nazwa] of [
    ['jasny', 'Jasny'],
    ['kolorowy', 'Kolorowy'],
    ['ciemny', 'Ciemny'],
    ['systemowy', 'Systemowy'],
  ]) {
    await strona.goto(`${adres}/#/ustawienia`);
    await strona
      .locator('label.opcja-motywu')
      .filter({ hasText: nazwa })
      .click();
    oczekuj.equal(
      await strona.getByRole('radio', { name: nazwa, exact: true }).isChecked(),
      true,
    );
    await strona.goto(`${adres}/#/nowy-quiz`);
    await pole('Tytuł quizu').fill('Kontrola motywu');
    await przycisk('Dalej: pytania →').click();
    oczekuj.equal(
      await strona.locator('html').getAttribute('data-motyw'),
      motyw,
    );
    await strona.setViewportSize({ width: 390, height: 900 });
    await strona.screenshot({
      path: `${katalog}/motyw-${motyw}.png`,
      fullPage: true,
    });
    oczekuj.ok(
      await strona.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await strona.emulateMedia({ colorScheme: 'light' });
  const jasneTlo = await strona
    .locator('html')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await strona.emulateMedia({ colorScheme: 'dark' });
  oczekuj.notEqual(
    await strona
      .locator('html')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    jasneTlo,
  );
  await pole('Treść pytania').fill('Wybór ze szkicem');
  await pole('Wariant 1').fill('Pierwszy');
  await pole('Wariant 2').fill('Drugi');
  await strona
    .getByText('Prezentacja i wyjaśnienie pytania', { exact: true })
    .click();
  await wybor('Typ prezentacji').selectOption('mieszana');
  await strona.getByText('Obrazy pytania (0)', { exact: true }).click();
  await przycisk('+ Dodaj obraz').click();
  await pole('Opis alternatywny obrazu 1').fill('Piksel testowego szkicu');
  const obraz =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5V8AAAAASUVORK5CYII=';
  await pole('Plik obrazu 1 (PNG, JPEG, WebP)').setInputFiles({
    name: 'szkic.png',
    mimeType: 'image/png',
    buffer: Bufor.from(obraz, 'base64'),
  });
  await strona.getByText('Obraz osadzony w quizie.', { exact: true }).waitFor();
  await przycisk('Dalej: logika adaptacyjna →').click();
  await przycisk('Przejdź do podglądu →').click();
  oczekuj.equal(await przycisk('Zapisz do Biblioteki').isDisabled(), true);
  await pole(
    'Akceptuję ostrzeżenia i chcę zapisać lub wyeksportować quiz',
  ).check();
  const pobranieObrazu = strona.waitForEvent('download');
  await przycisk('Eksportuj JSON').click();
  const plikObrazu = await pobranieObrazu;
  const quizZObrazem = JSON.parse(
    await odczytaj(await plikObrazu.path(), 'utf8'),
  );
  oczekuj.equal(
    quizZObrazem.pytania[0].prezentacja.obrazy[0].dane,
    `data:image/png;base64,${obraz}`,
  );
  oczekuj.deepEqual(bledy, []);
  konsola.log(
    `PASS Edge ${await przegladarka.version()}: GUI → zapis → JSON → usunięcie izolowanej kopii → importer → odświeżenie → identyczna definicja → adaptacja → ukończenie; analiza autorska; 1280/390/320 px; ${proces.env.QUIZOMAT_REAL_QUIZ ? 'rzeczywiste pytanie Tajemnic Trzebiatowa' : 'syntetyczny quiz'}.`,
  );
  await kontekst.close();
} finally {
  await przegladarka?.close();
  serwer.kill();
}
