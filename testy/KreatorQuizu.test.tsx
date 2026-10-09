import {
  IDBFactory as FabrykaBazy,
  IDBObjectStore as Magazyn,
} from 'fake-indexeddb';
import {
  render as pokaz,
  screen as ekran,
  waitFor as poczekaj,
  within as wewnatrz,
} from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter as Router } from 'react-router-dom';
import {
  beforeEach as przedKazdym,
  afterEach as poKazdym,
  it as sprawdz,
  expect as oczekuj,
  vi as atrapy,
} from 'vitest';
import { Aplikacja } from '../src/aplikacja/Aplikacja';
import { odczytajBiblioteke } from '../src/dane/biblioteka';
import { schematQuizu } from '../src/domena/quiz';
import { utworzSesje } from '../src/silnik/sesja';

przedKazdym(() => {
  atrapy.stubGlobal('indexedDB', new FabrykaBazy());
});
poKazdym(() => {
  atrapy.restoreAllMocks();
  atrapy.unstubAllGlobals();
});

async function wpisz(
  osoba: ReturnType<typeof uzytkownik.setup>,
  pole: HTMLElement,
  tekst: string,
) {
  await osoba.click(pole);
  await osoba.paste(tekst);
}

async function otworz() {
  pokaz(
    <Router initialEntries={['/biblioteka']}>
      <Aplikacja />
    </Router>,
  );
  const osoba = uzytkownik.setup();
  await osoba.click(ekran.getByRole('link', { name: '+ Stwórz nowy quiz' }));
  await wpisz(osoba, ekran.getByLabelText('Tytuł quizu'), 'Nasz projekt');
  await wpisz(
    osoba,
    ekran.getByLabelText('Opis (opcjonalny)'),
    'Ustalenia zespołu',
  );
  await osoba.click(ekran.getByRole('button', { name: 'Dalej: pytania →' }));
  return osoba;
}

sprawdz(
  'prowadzi przez podgląd i zapisuje dopiero po zatwierdzeniu; gotowy quiz działa w silniku',
  async () => {
    const osoba = await otworz();
    await wpisz(osoba, ekran.getByLabelText('Treść pytania'), 'Jaki układ?');
    await wpisz(
      osoba,
      ekran.getByLabelText('Wariant 1', { exact: true }),
      'Prosty',
    );
    await wpisz(
      osoba,
      ekran.getByLabelText('Wariant 2', { exact: true }),
      'Rozbudowany',
    );
    await osoba.click(
      ekran.getAllByText('Szczegóły wariantu 1', { exact: true })[0]!,
    );
    await wpisz(
      osoba,
      ekran.getByLabelText('Opis wariantu 1 (opcjonalny)'),
      'Mało elementów',
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Dalej: logika adaptacyjna →' }),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Przejdź do podglądu →' }),
    );
    oczekuj(await odczytajBiblioteke()).toEqual([]);
    oczekuj(ekran.getByRole('heading', { name: 'Jaki układ?' })).toBeVisible();
    await osoba.click(ekran.getByText('Warianty i szczegóły (2)'));
    oczekuj(ekran.getByText('Mało elementów')).toBeVisible();
    await osoba.click(ekran.getByRole('button', { name: '← Wstecz' }));
    await osoba.click(ekran.getByRole('button', { name: '← Wstecz' }));
    oczekuj(ekran.getByLabelText('Treść pytania')).toHaveValue('Jaki układ?');
    await osoba.click(
      ekran.getByRole('button', { name: 'Dalej: logika adaptacyjna →' }),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Przejdź do podglądu →' }),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
    );
    await osoba.click(
      await ekran.findByRole('link', { name: 'Otwórz Bibliotekę' }),
    );
    await ekran.findByRole('heading', { name: 'Biblioteka' });
    const wpisy = await odczytajBiblioteke();
    oczekuj(wpisy).toHaveLength(1);
    const quiz = schematQuizu.parse(wpisy[0]!.quiz);
    oczekuj(quiz.tytul).toBe('Nasz projekt');
    oczekuj(quiz.pytania[0]!.warianty[0]!.opis).toBe('Mało elementów');
    oczekuj(
      utworzSesje(quiz, 'nowa-sesja', new Date().toISOString()).stan,
    ).toBe('gotowy');
    await osoba.click(
      await ekran.findByRole('button', { name: 'Rozpocznij nową' }),
    );
    oczekuj(
      await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
    ).toBeVisible();
  },
);

sprawdz('blokuje pusty opis i błędne pytania przed zapisem', async () => {
  pokaz(
    <Router initialEntries={['/nowy-quiz']}>
      <Aplikacja />
    </Router>,
  );
  const osoba = uzytkownik.setup();
  await osoba.click(ekran.getByRole('button', { name: 'Dalej: pytania →' }));
  oczekuj(ekran.getByRole('alert')).toHaveTextContent('Podaj tytuł quizu.');
  await wpisz(osoba, ekran.getByLabelText('Tytuł quizu'), 'Quiz');
  await osoba.click(ekran.getByRole('button', { name: 'Dalej: pytania →' }));
  await osoba.click(
    ekran.getByRole('button', { name: 'Dalej: logika adaptacyjna →' }),
  );
  await osoba.click(
    ekran.getByRole('button', { name: 'Przejdź do podglądu →' }),
  );
  oczekuj(
    ekran.getByRole('heading', { name: /Błędy krytyczne/ }),
  ).toBeVisible();
  oczekuj(
    ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
  ).toBeDisabled();
  oczekuj(ekran.getByRole('button', { name: 'Eksportuj JSON' })).toBeDisabled();
  oczekuj(await odczytajBiblioteke()).toEqual([]);
});

sprawdz.each([
  'pojedynczyWybor',
  'wielokrotnyWybor',
  'takNie',
  'prawdaFalsz',
  'otwarta',
  'skala',
  'ranking',
  'kombinacjaWariantow',
])('tworzy poprawny quiz dla mechaniki %s', async (rodzaj) => {
  const osoba = await otworz();
  await wpisz(osoba, ekran.getByLabelText('Treść pytania'), 'Twoja odpowiedź?');
  await osoba.selectOptions(ekran.getByLabelText('Sposób odpowiedzi'), rodzaj);
  if (ekran.queryByLabelText('Wariant 1', { exact: true })) {
    await wpisz(
      osoba,
      ekran.getByLabelText('Wariant 1', { exact: true }),
      'Pierwszy',
    );
    await wpisz(
      osoba,
      ekran.getByLabelText('Wariant 2', { exact: true }),
      'Drugi',
    );
  }
  await osoba.click(
    ekran.getByRole('button', { name: 'Dalej: logika adaptacyjna →' }),
  );
  await osoba.click(
    ekran.getByRole('button', { name: 'Przejdź do podglądu →' }),
  );
  await osoba.click(
    ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
  );
  await osoba.click(
    await ekran.findByRole('link', { name: 'Otwórz Bibliotekę' }),
  );
  await ekran.findByRole('heading', { name: 'Biblioteka' });
  const quiz = schematQuizu.parse((await odczytajBiblioteke())[0]!.quiz);
  oczekuj(quiz.pytania[0]!.sposobyOdpowiedzi[0]!.rodzaj).toBe(rodzaj);
  oczekuj(utworzSesje(quiz, 'sesja', new Date().toISOString()).stan).toBe(
    'gotowy',
  );
});

sprawdz(
  'zachowuje pytania przy zmianie kolejności i usuwa tylko wskazane pytanie',
  async () => {
    const osoba = await otworz();
    await wpisz(osoba, ekran.getByLabelText('Treść pytania'), 'Pierwsze');
    await osoba.selectOptions(
      ekran.getByLabelText('Sposób odpowiedzi'),
      'takNie',
    );
    await osoba.click(ekran.getByRole('button', { name: '+ Dodaj pytanie' }));
    await wpisz(osoba, ekran.getByLabelText('Treść pytania'), 'Drugie');
    await osoba.selectOptions(
      ekran.getByLabelText('Sposób odpowiedzi'),
      'otwarta',
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Przesuń pytanie w górę' }),
    );
    const lista = wewnatrz(
      ekran.getByRole('complementary', { name: 'Lista pytań' }),
    );
    oczekuj(lista.getAllByRole('listitem')[0]).toHaveTextContent('Drugie');
    oczekuj(ekran.getByLabelText('Treść pytania')).toHaveValue('Drugie');
    await osoba.click(ekran.getByRole('button', { name: 'Usuń pytanie' }));
    oczekuj(ekran.getByLabelText('Treść pytania')).toHaveValue('Pierwsze');
    oczekuj(ekran.getByRole('button', { name: 'Usuń pytanie' })).toBeDisabled();
    await osoba.click(
      ekran.getByRole('button', { name: 'Dalej: logika adaptacyjna →' }),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Przejdź do podglądu →' }),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
    );
    await osoba.click(
      await ekran.findByRole('link', { name: 'Otwórz Bibliotekę' }),
    );
    await ekran.findByRole('heading', { name: 'Biblioteka' });
    const quiz = (await odczytajBiblioteke())[0]!.quiz;
    oczekuj(quiz.liczbaPytan).toBe(1);
    oczekuj(quiz.pytania.map((pytanie) => pytanie.tresc)).toEqual(['Pierwsze']);
  },
);

sprawdz(
  'zachowuje podgląd po błędzie magazynu i umożliwia ponowienie zapisu',
  async () => {
    const osoba = await otworz();
    await wpisz(
      osoba,
      ekran.getByLabelText('Treść pytania'),
      'Czy kontynuować?',
    );
    await osoba.selectOptions(
      ekran.getByLabelText('Sposób odpowiedzi'),
      'takNie',
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Dalej: logika adaptacyjna →' }),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Przejdź do podglądu →' }),
    );
    const awaria = atrapy
      .spyOn(Magazyn.prototype, 'add')
      .mockImplementationOnce(() => {
        throw new Error('Brak miejsca na zapis.');
      });
    await osoba.click(
      ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
    );
    await poczekaj(() =>
      oczekuj(ekran.getByRole('alert')).toHaveTextContent(
        'Brak miejsca na zapis.',
      ),
    );
    oczekuj(
      ekran.getByRole('heading', { name: 'Czy kontynuować?' }),
    ).toBeVisible();
    oczekuj(await odczytajBiblioteke()).toEqual([]);
    awaria.mockRestore();
    await osoba.click(
      ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
    );
    await osoba.click(
      await ekran.findByRole('link', { name: 'Otwórz Bibliotekę' }),
    );
    await ekran.findByRole('heading', { name: 'Biblioteka' });
    oczekuj(await odczytajBiblioteke()).toHaveLength(1);
  },
);
