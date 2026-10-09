import { IDBFactory as FabrykaBazy } from 'fake-indexeddb';
import {
  act as wykonaj,
  render as pokaz,
  screen as ekran,
  waitFor as poczekaj,
  within as wewnatrz,
} from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter as Router } from 'react-router-dom';
import {
  afterEach as poKazdym,
  beforeEach as przedKazdym,
  describe as opisz,
  expect as oczekuj,
  it as sprawdz,
  vi as atrapy,
} from 'vitest';
import { Aplikacja } from '../../src/aplikacja/Aplikacja';
import {
  odczytajBiblioteke,
  zapiszZatwierdzonyQuiz,
} from '../../src/dane/biblioteka';
import { walidujImportQuizu } from '../../src/import/walidator';
import { quizTekstowy } from '../domena/przyklady';

przedKazdym(() => atrapy.stubGlobal('indexedDB', new FabrykaBazy()));
poKazdym(() => {
  atrapy.restoreAllMocks();
  atrapy.unstubAllGlobals();
});

function plik(dane: unknown = quizTekstowy) {
  return new File([JSON.stringify(dane)], 'quiz.json', {
    type: 'application/json',
  });
}
function otworzImport() {
  pokaz(
    <Router initialEntries={['/import']}>
      <Aplikacja />
    </Router>,
  );
  return uzytkownik.setup();
}
async function wczytaj(dane: unknown = quizTekstowy) {
  const osoba = otworzImport();
  await osoba.upload(ekran.getByLabelText('Plik quizu JSON'), plik(dane));
  await ekran.findByRole('heading', { name: /pytań poprawnych/ });
  return osoba;
}

opisz('Raport i decyzja użytkownika', () => {
  sprawdz('błąd odczytu jest widoczny i pozwala ponowić wybór', async () => {
    const odczyt = atrapy
      .spyOn(FileReader.prototype, 'readAsText')
      .mockImplementation(function (this: FileReader) {
        this.dispatchEvent(new ProgressEvent('error'));
      });
    const osoba = otworzImport();
    await osoba.upload(ekran.getByLabelText('Plik quizu JSON'), plik());
    await ekran.findByText('Nie można odczytać pliku. Wybierz go ponownie.');
    oczekuj(await odczytajBiblioteke()).toEqual([]);
    odczyt.mockRestore();
    await osoba.upload(ekran.getByLabelText('Plik quizu JSON'), plik());
    await ekran.findByRole('heading', { name: '1 z 1 pytań poprawnych' });
    oczekuj(ekran.queryByRole('alert')).not.toBeInTheDocument();
  });

  sprawdz('anulowanie podczas odczytu ignoruje spóźniony raport', async () => {
    const czytniki: FileReader[] = [];
    atrapy
      .spyOn(FileReader.prototype, 'readAsText')
      .mockImplementation(function (this: FileReader) {
        czytniki.push(this);
      });
    const osoba = otworzImport();
    await osoba.upload(ekran.getByLabelText('Plik quizu JSON'), plik());
    await osoba.click(ekran.getByRole('button', { name: 'Anuluj' }));
    await ekran.findByRole('heading', { name: 'Biblioteka' });
    await wykonaj(() => {
      Object.defineProperty(czytniki[0]!, 'result', {
        value: JSON.stringify(quizTekstowy),
      });
      czytniki[0]!.dispatchEvent(new ProgressEvent('load'));
    });
    oczekuj(
      ekran.queryByRole('heading', { name: /pytań poprawnych/ }),
    ).not.toBeInTheDocument();
    oczekuj(await odczytajBiblioteke()).toEqual([]);
  });
  sprawdz(
    'nie zapisuje przed akceptacją, zapisuje dopiero po niej i odczytuje po ponownym otwarciu',
    async () => {
      const osoba = await wczytaj();
      oczekuj(await odczytajBiblioteke()).toEqual([]);
      oczekuj(
        ekran.getByRole('heading', { name: '1 z 1 pytań poprawnych' }),
      ).toHaveFocus();
      await osoba.click(
        ekran.getByRole('button', { name: 'Zatwierdź import' }),
      );
      await ekran.findByRole('heading', { name: quizTekstowy.tytul });
      oczekuj((await odczytajBiblioteke())[0]?.quiz).toEqual(quizTekstowy);
      await osoba.click(ekran.getByRole('link', { name: 'Start' }));
      await osoba.click(ekran.getByRole('link', { name: 'Biblioteka' }));
      await ekran.findByRole('heading', { name: quizTekstowy.tytul });
      oczekuj(ekran.queryByText(quizTekstowy.id)).not.toBeInTheDocument();
    },
  );
  sprawdz(
    'wymaga świadomej akceptacji ostrzeżeń i zachowuje pola źródłowe',
    async () => {
      const dane = { ...quizTekstowy, rozszerzenie: 'zachowaj' };
      const osoba = await wczytaj(dane);
      oczekuj(
        ekran.getByRole('heading', { name: 'Ostrzeżenia (1)' }),
      ).toBeVisible();
      oczekuj(await odczytajBiblioteke()).toEqual([]);
      await osoba.click(
        ekran.getByRole('button', { name: 'Kontynuuj mimo ostrzeżeń' }),
      );
      await ekran.findByRole('heading', { name: quizTekstowy.tytul });
      oczekuj((await odczytajBiblioteke())[0]?.daneZrodlowe).toEqual(dane);
    },
  );
  sprawdz(
    'blokuje cały quiz przy niezgodnej liczbie i pokazuje różnicę struktury',
    async () => {
      await wczytaj({ ...quizTekstowy, liczbaPytan: 20 });
      oczekuj(
        ekran.getByRole('heading', { name: '1 z 20 pytań poprawnych' }),
      ).toBeVisible();
      oczekuj(
        ekran.getByRole('button', { name: 'Kontynuuj mimo ostrzeżeń' }),
      ).toBeDisabled();
      oczekuj(ekran.getByText('-19')).toBeVisible();
      oczekuj(await odczytajBiblioteke()).toEqual([]);
    },
  );
  sprawdz(
    'pokazuje odrzucone pytanie, przyczynę oraz ID wyłącznie w diagnostyce',
    async () => {
      const pytanie = {
        ...quizTekstowy.pytania[0],
        rekomendacja: { wariantId: 'nieistniejacy', uzasadnienie: 'Powód' },
      };
      const osoba = await wczytaj({ ...quizTekstowy, pytania: [pytanie] });
      oczekuj(
        ekran.getByRole('heading', { name: '0 z 1 pytań poprawnych' }),
      ).toBeVisible();
      oczekuj(
        ekran.getByRole('heading', { name: 'Pytanie 1 (bazowe)' }),
      ).toBeVisible();
      const szczegoly = ekran
        .getByText('Diagnostyka pytania')
        .closest('details')!;
      oczekuj(szczegoly).not.toHaveAttribute('open');
      await osoba.click(wewnatrz(szczegoly).getByText('Diagnostyka pytania'));
      oczekuj(szczegoly).toHaveAttribute('open');
      oczekuj(
        wewnatrz(szczegoly).getByText('ID pytania: podzial'),
      ).toBeInTheDocument();
      oczekuj(ekran.getAllByText(/Rekomendacja/).length).toBeGreaterThan(0);
    },
  );
  sprawdz.each(['Anuluj', 'Popraw plik'])(
    '%s nie dodaje quizu',
    async (dzialanie) => {
      const osoba = await wczytaj();
      await osoba.click(ekran.getByRole('button', { name: dzialanie }));
      oczekuj(await odczytajBiblioteke()).toEqual([]);
      if (dzialanie === 'Popraw plik') {
        await osoba.upload(ekran.getByLabelText('Plik quizu JSON'), plik());
        await ekran.findByRole('heading', { name: '1 z 1 pytań poprawnych' });
      } else
        await ekran.findByText(
          'Biblioteka jest pusta. Stwórz własny quiz lub zaimportuj gotowy.',
        );
    },
  );
  sprawdz('raport składni blokuje import i pozwala poprawić plik', async () => {
    const osoba = otworzImport();
    await osoba.upload(
      ekran.getByLabelText('Plik quizu JSON'),
      new File(['{'], 'quiz.json', { type: 'application/json' }),
    );
    await ekran.findByRole('heading', { name: /pytań poprawnych/ });
    oczekuj(
      ekran.getByRole('button', { name: 'Kontynuuj mimo ostrzeżeń' }),
    ).toBeDisabled();
    await osoba.click(ekran.getByRole('button', { name: 'Popraw plik' }));
    oczekuj(
      ekran.queryByRole('heading', { name: /pytań poprawnych/ }),
    ).not.toBeInTheDocument();
  });
  sprawdz('nie nadpisuje quizu o istniejącym ID', async () => {
    await zapiszZatwierdzonyQuiz(
      walidujImportQuizu(JSON.stringify(quizTekstowy)),
    );
    const osoba = await wczytaj({ ...quizTekstowy, tytul: 'Nowa nazwa' });
    await osoba.click(ekran.getByRole('button', { name: 'Zatwierdź import' }));
    await ekran.findByText(/Quiz o tym ID jest już w bibliotece/);
    oczekuj((await odczytajBiblioteke())[0]?.quiz.tytul).toBe(
      quizTekstowy.tytul,
    );
    oczekuj(
      ekran.getByRole('button', { name: 'Zatwierdź import' }),
    ).toBeEnabled();
  });
  sprawdz('błąd magazynu nie daje fałszywego sukcesu', async () => {
    const osoba = await wczytaj();
    atrapy.stubGlobal('indexedDB', undefined);
    await osoba.click(ekran.getByRole('button', { name: 'Zatwierdź import' }));
    await poczekaj(() => oczekuj(ekran.getByRole('alert')).toBeInTheDocument());
    oczekuj(
      ekran.getByRole('heading', { name: /pytań poprawnych/ }),
    ).toBeVisible();
    oczekuj(
      ekran.getByRole('button', { name: 'Zatwierdź import' }),
    ).toBeEnabled();
  });
  sprawdz('późny odczyt poprzedniego pliku nie podmienia raportu', async () => {
    const czytniki: FileReader[] = [];
    atrapy
      .spyOn(FileReader.prototype, 'readAsText')
      .mockImplementation(function (this: FileReader) {
        czytniki.push(this);
      });
    const osoba = otworzImport();
    await osoba.upload(ekran.getByLabelText('Plik quizu JSON'), plik());
    await osoba.upload(
      ekran.getByLabelText('Plik quizu JSON'),
      plik({ ...quizTekstowy, tytul: 'Nowszy' }),
    );
    function zakoncz(indeks: number, tytul: string) {
      const czytnik = czytniki[indeks]!;
      Object.defineProperty(czytnik, 'result', {
        value: JSON.stringify({ ...quizTekstowy, tytul }),
      });
      czytnik.dispatchEvent(new ProgressEvent('load'));
    }
    await wykonaj(() => zakoncz(1, 'Nowszy'));
    await wykonaj(() => zakoncz(0, 'Starszy'));
    oczekuj(ekran.getByText('Nowszy · quiz.json')).toBeVisible();
    oczekuj(ekran.queryByText('Starszy · quiz.json')).not.toBeInTheDocument();
  });
});

opisz('Granica lokalnego zapisu', () => {
  sprawdz('nie zapisuje zablokowanego wyniku nawet poza UI', async () => {
    await oczekuj(
      zapiszZatwierdzonyQuiz(walidujImportQuizu('{')),
    ).rejects.toThrow('Błędy krytyczne');
    oczekuj(await odczytajBiblioteke()).toEqual([]);
  });
});
