import { strict as oczekuj } from 'node:assert';
import {
  mkdir as utworzKatalog,
  writeFile as zapiszPlik,
  readFile as odczytajPlik,
} from 'node:fs/promises';
import { createRequire as utworzOdczytPakietow } from 'node:module';
import proces from 'node:process';
import konsola from 'node:console';

const wymagaj = utworzOdczytPakietow(import.meta.url);
const { chromium: chromiumPrzegladarki } = wymagaj(
  proces.env.QUIZOMAT_PLAYWRIGHT ?? 'playwright',
);
const dane = JSON.parse(await odczytajPlik(proces.env.QUIZOMAT_QUIZ, 'utf8'));
oczekuj.equal(dane.pytania.length, 40);
const katalog = 'test-results/widoki';
await utworzKatalog(katalog, { recursive: true });
const przegladarka = await chromiumPrzegladarki.launch({
  channel: 'msedge',
  headless: true,
});
try {
  const strona = await przegladarka.newPage({
    viewport: { width: 1280, height: 1000 },
  });
  const bledy = [];
  strona.on('pageerror', (blad) => bledy.push(blad.message));
  const przycisk = (nazwa) =>
    strona.getByRole('button', { name: nazwa, exact: true });
  const zapis = () =>
    strona.getByText('Postęp zapisany lokalnie.', { exact: true }).waitFor();
  const odczytajSesje = () =>
    strona.evaluate(
      () =>
        new Promise((zakoncz, odrzuc) => {
          const zadanie = globalThis.indexedDB.open('quizomat');
          zadanie.onerror = () => odrzuc(zadanie.error);
          zadanie.onsuccess = () => {
            const baza = zadanie.result;
            const odczyt = baza
              .transaction('sesje')
              .objectStore('sesje')
              .getAll();
            odczyt.onsuccess = () => {
              baza.close();
              zakoncz(odczyt.result);
            };
          };
        }),
    );
  await strona.goto(
    `${proces.env.QUIZOMAT_URL ?? 'http://127.0.0.1:5193'}/#/import`,
  );
  await strona
    .getByLabel('Plik quizu JSON')
    .setInputFiles(proces.env.QUIZOMAT_QUIZ);
  await przycisk('Zatwierdź import').click();
  await przycisk('Rozpocznij nową').click();
  await zapis();
  oczekuj.equal(
    await przycisk('Pojedyncze pytania').getAttribute('aria-pressed'),
    'true',
  );
  oczekuj.equal(await strona.locator('.pytanie-quizu').count(), 1);
  oczekuj(await przycisk('← Poprzednie pytanie').isDisabled());
  oczekuj(await przycisk('Następne pytanie →').isDisabled());
  oczekuj.equal(
    await strona.locator('.wariant button[aria-pressed="true"]').count(),
    0,
  );
  oczekuj((await strona.locator('.rekomendowany').count()) > 0);
  oczekuj.equal(
    await strona
      .locator('.wariant h3')
      .filter({ hasText: /^(Zalety|Wady)$/ })
      .count(),
    0,
  );
  oczekuj.equal(
    await strona.locator('.zalety li span[aria-hidden]').first().innerText(),
    '+',
  );
  oczekuj.equal(
    await strona.locator('.wady li span[aria-hidden]').first().innerText(),
    '−',
  );
  const przed = await strona.locator('.wariant').nth(1).boundingBox();
  await przycisk(`Wybierz: ${dane.pytania[0].warianty[0].etykieta}`).click();
  await zapis();
  const po = await strona.locator('.wariant').nth(1).boundingBox();
  oczekuj.equal(po.y, przed.y);
  await przycisk(`Wybierz: ${dane.pytania[0].warianty[1].etykieta}`).click();
  await zapis();
  await strona.evaluate(() => globalThis.window.scrollTo(0, 0));
  await strona.waitForTimeout(250);
  await strona.screenshot({ path: `${katalog}/pojedynczy-desktop.png` });
  const wysokoscKafli = await strona
    .locator('.warianty')
    .evaluate((element) => element.getBoundingClientRect().height);
  await przycisk('Następne pytanie →').click();
  await zapis();
  await przycisk('← Poprzednie pytanie').click();
  await zapis();
  const przedTrybem = await odczytajSesje();
  await przycisk('Widok pełny').click();
  oczekuj.equal(await strona.locator('.pytanie-quizu').count(), 40);
  oczekuj.deepEqual(await odczytajSesje(), przedTrybem);
  const ostatnie = strona.getByRole('region', {
    name: 'Pytanie 40',
    exact: true,
  });
  await ostatnie
    .getByRole('button', {
      name: `Wybierz: ${dane.pytania[39].warianty[0].etykieta}`,
      exact: true,
    })
    .click();
  await zapis();
  await przycisk('Pojedyncze pytania').click();
  await strona
    .getByRole('heading', {
      name: dane.pytania[39].tresc,
      level: 1,
      exact: true,
    })
    .waitFor();
  oczekuj.equal(
    await strona.locator('.wariant button[aria-pressed="true"]').count(),
    1,
  );
  await przycisk('Widok pełny').click();
  const pierwsze = strona.getByRole('region', {
    name: 'Pytanie 1',
    exact: true,
  });
  await pierwsze
    .getByRole('button', {
      name: `Wybierz: ${dane.pytania[0].warianty[0].etykieta}`,
      exact: true,
    })
    .click();
  await zapis();
  await strona.evaluate(() => globalThis.window.scrollTo(0, 0));
  await strona.waitForTimeout(250);
  await strona.setViewportSize({ width: 1280, height: 1900 });
  await strona.screenshot({ path: `${katalog}/pelny-desktop.png` });
  await strona.setViewportSize({ width: 1280, height: 1000 });
  await przycisk('Pojedyncze pytania').click();
  await strona
    .getByLabel('Treść własnej odpowiedzi')
    .fill('Własny kierunek do sprawdzenia');
  oczekuj(await przycisk('Widok pełny').isDisabled());
  await przycisk('Zapisz szkic').click();
  await zapis();
  await strona.reload();
  await zapis();
  oczekuj.equal(
    await strona.getByLabel('Treść własnej odpowiedzi').inputValue(),
    'Własny kierunek do sprawdzenia',
  );
  const sesje = await odczytajSesje();
  oczekuj.equal(sesje[0].decyzje.length, 2);
  await strona.setViewportSize({ width: 390, height: 844 });
  await strona.evaluate(() => globalThis.window.scrollTo(0, 0));
  oczekuj(
    await strona.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.window.innerWidth,
    ),
  );
  await strona.waitForTimeout(250);
  await strona.screenshot({ path: `${katalog}/pojedynczy-390.png` });
  await przycisk('Widok pełny').click();
  oczekuj.equal(await strona.locator('.pytanie-quizu').count(), 40);
  oczekuj(
    await strona.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.window.innerWidth,
    ),
  );
  oczekuj.deepEqual(bledy, []);
  const raport = {
    przegladarka: await przegladarka.version(),
    pytania: 40,
    decyzje: sesje[0].decyzje.length,
    wysokoscKafli,
    bledy,
    wynik: 'PASS',
  };
  await zapiszPlik(`${katalog}/wynik.json`, JSON.stringify(raport, null, 2));
  konsola.log(JSON.stringify(raport));
} finally {
  await przegladarka.close();
}
