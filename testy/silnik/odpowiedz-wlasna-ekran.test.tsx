import { IDBFactory as FabrykaBazy } from 'fake-indexeddb';
import {
  render as pokaz,
  screen as ekran,
  waitFor as poczekaj,
  cleanup as posprzataj,
} from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import {
  MemoryRouter as Router,
  Routes as Trasy,
  Route as Trasa,
} from 'react-router-dom';
import {
  beforeEach as przedKazdym,
  afterEach as poKazdym,
  describe as opisz,
  it as sprawdz,
  expect as oczekuj,
  vi as atrapy,
} from 'vitest';
import { EkranQuizu } from '../../src/aplikacja/EkranQuizu';
import { FakeAnalizator } from '../../src/ai/analizator';
import type { Analizator } from '../../src/ai/analizator';
import { zapiszZatwierdzonyQuiz } from '../../src/dane/biblioteka';
import { odczytajSesje, zapiszSesje } from '../../src/dane/sesje';
import { walidujImportQuizu } from '../../src/import/walidator';
import { utworzSesje } from '../../src/silnik/sesja';
import { quizTekstowy } from '../domena/przyklady';

przedKazdym(() => {
  atrapy.stubGlobal('indexedDB', new FabrykaBazy());
  localStorage.clear();
});
poKazdym(() => {
  posprzataj();
  atrapy.unstubAllGlobals();
  atrapy.restoreAllMocks();
});
function wyswietl(analizator?: Analizator) {
  pokaz(
    <Router initialEntries={['/sesja/testowa']}>
      <Trasy>
        <Trasa
          path="/sesja/:sesjaId"
          element={
            analizator ? <EkranQuizu analizator={analizator} /> : <EkranQuizu />
          }
        />
      </Trasy>
    </Router>,
  );
}
async function otworz(analizator?: Analizator) {
  await zapiszZatwierdzonyQuiz(
    walidujImportQuizu(JSON.stringify(quizTekstowy)),
  );
  const wynik = utworzSesje(quizTekstowy, 'testowa', new Date().toISOString());
  if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
  await zapiszSesje(wynik.wartosc.sesja, null);
  wyswietl(analizator);
  await ekran.findByRole('textbox', { name: 'Treść własnej odpowiedzi' });
  return uzytkownik.setup();
}
async function zapis() {
  await poczekaj(() =>
    oczekuj(ekran.queryByText('Zapisywanie postępu…')).not.toBeInTheDocument(),
  );
  return (await odczytajSesje())[0]!;
}

opisz('Ekran analizowanej własnej odpowiedzi', () => {
  sprawdz(
    'oczekiwanie zapisuje tekst i blokuje decyzję przed nadejściem wyniku',
    async () => {
      let zakoncz!: () => void;
      const gotowy = new Promise<void>((rozwiaz) => {
        zakoncz = rozwiaz;
      });
      const analizator: Analizator = {
        async analizuj(zlecenie) {
          await gotowy;
          return new FakeAnalizator().analizuj(zlecenie);
        },
      };
      const osoba = await otworz(analizator);
      await osoba.type(
        ekran.getByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
        'Poczekać na wynik',
      );
      await osoba.click(
        ekran.getByRole('button', { name: 'Przeanalizuj odpowiedź' }),
      );
      await poczekaj(async () =>
        oczekuj(
          (await odczytajSesje())[0]!.szkiceWlasnychOdpowiedzi[0]?.stan,
        ).toBe('oczekujeAnalizy'),
      );
      oczekuj(ekran.getByText('Oczekiwanie na analizę…')).toBeVisible();
      oczekuj(
        ekran.getByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
      ).toBeDisabled();
      oczekuj(
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      ).toBeDisabled();
      oczekuj((await odczytajSesje())[0]!.decyzje).toEqual([]);
      zakoncz();
      await ekran.findByRole('button', { name: 'Zatwierdź odpowiedź' });
      oczekuj((await zapis()).decyzje).toEqual([]);
    },
  );

  sprawdz(
    'szkic przetrwa restart; analiza czeka na świadome zatwierdzenie i umożliwia Dalej',
    async () => {
      const osoba = await otworz(new FakeAnalizator());
      await osoba.type(
        ekran.getByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
        'Mój kierunek',
      );
      oczekuj((await odczytajSesje())[0]!.decyzje).toEqual([]);
      await osoba.click(ekran.getByRole('button', { name: 'Zapisz szkic' }));
      const szkic = await zapis();
      oczekuj(szkic.szkiceWlasnychOdpowiedzi[0]).toMatchObject({
        stan: 'szkic',
        tekst: 'Mój kierunek',
      });
      oczekuj(szkic.dziennikSesji!.zdarzenia).toEqual([]);
      posprzataj();
      wyswietl(new FakeAnalizator());
      oczekuj(
        await ekran.findByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
      ).toHaveValue('Mój kierunek');
      await osoba.click(
        ekran.getByRole('button', { name: 'Przeanalizuj odpowiedź' }),
      );
      await ekran.findByRole('heading', {
        name: 'Wynik analizy — do zatwierdzenia',
      });
      const przeanalizowana = await zapis();
      oczekuj(przeanalizowana.decyzje).toEqual([]);
      oczekuj(przeanalizowana.dziennikSesji!.zdarzenia).toEqual([]);
      oczekuj(
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      ).toBeDisabled();
      oczekuj(
        ekran.getByRole('heading', { name: 'Niejednoznaczności' }),
      ).toBeVisible();
      posprzataj();
      wyswietl(new FakeAnalizator());
      await ekran.findByRole('button', { name: 'Zatwierdź odpowiedź' });
      oczekuj((await odczytajSesje())[0]!.decyzje).toEqual([]);
      await osoba.click(
        ekran.getByRole('button', { name: 'Zatwierdź odpowiedź' }),
      );
      const potwierdzona = await zapis();
      oczekuj(potwierdzona.decyzje[0]?.odpowiedz).toMatchObject({
        rodzaj: 'wlasna',
        tekst: 'Mój kierunek',
      });
      oczekuj(potwierdzona.dziennikSesji!.zdarzenia).toHaveLength(1);
      oczekuj(
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      ).toBeEnabled();
      await osoba.click(ekran.getByRole('button', { name: 'Wybierz: Prosty' }));
      await zapis();
      oczekuj(
        ekran.getByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
      ).toHaveValue('');
      oczekuj(
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      ).toBeEnabled();
      await osoba.click(
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      await zapis();
      oczekuj(
        ekran.getByRole('heading', { level: 1, name: 'Quiz zakończony' }),
      ).toBeVisible();
    },
  );

  sprawdz(
    'Zmień odpowiedź unieważnia wynik i wymaga ponownej analizy',
    async () => {
      const osoba = await otworz(new FakeAnalizator());
      await osoba.type(
        ekran.getByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
        'Stary tekst',
      );
      await osoba.click(
        ekran.getByRole('button', { name: 'Przeanalizuj odpowiedź' }),
      );
      await ekran.findByRole('button', { name: 'Zatwierdź odpowiedź' });
      await osoba.click(ekran.getByRole('button', { name: 'Zmień odpowiedź' }));
      await zapis();
      oczekuj(
        ekran.queryByRole('button', { name: 'Zatwierdź odpowiedź' }),
      ).not.toBeInTheDocument();
      await osoba.clear(
        ekran.getByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
      );
      await osoba.type(
        ekran.getByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
        'Nowy tekst',
      );
      await osoba.click(
        ekran.getByRole('button', { name: 'Przeanalizuj odpowiedź' }),
      );
      oczekuj(
        await ekran.findByText('Analiza testowa: Nowy tekst'),
      ).toBeVisible();
      oczekuj(
        ekran.queryByText('Analiza testowa: Stary tekst'),
      ).not.toBeInTheDocument();
      oczekuj((await zapis()).decyzje).toEqual([]);
    },
  );

  sprawdz.each([new FakeAnalizator(true), undefined])(
    'awaria lub brak integracji zachowuje szkic i pozwala ponowić po restarcie (%#)',
    async (analizator) => {
      const osoba = await otworz(analizator);
      await osoba.type(
        ekran.getByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
        'Nie utracić tekstu',
      );
      await osoba.click(
        ekran.getByRole('button', { name: 'Przeanalizuj odpowiedź' }),
      );
      oczekuj(await ekran.findByRole('alert')).toHaveTextContent('niedostępna');
      const stan = await zapis();
      oczekuj(stan.szkiceWlasnychOdpowiedzi[0]).toMatchObject({
        stan: 'oczekujeAnalizy',
        tekst: 'Nie utracić tekstu',
      });
      oczekuj(stan.decyzje).toEqual([]);
      oczekuj(
        ekran.queryByRole('button', { name: 'Zatwierdź odpowiedź' }),
      ).not.toBeInTheDocument();
      posprzataj();
      wyswietl(new FakeAnalizator());
      oczekuj(
        await ekran.findByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
      ).toHaveValue('Nie utracić tekstu');
      await osoba.click(ekran.getByRole('button', { name: 'Ponów analizę' }));
      oczekuj(
        await ekran.findByRole('button', { name: 'Zatwierdź odpowiedź' }),
      ).toBeVisible();
      oczekuj((await zapis()).decyzje).toEqual([]);
    },
  );
});
