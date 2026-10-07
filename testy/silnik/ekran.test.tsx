import { IDBFactory as FabrykaBazy } from 'fake-indexeddb';
import {
  render as pokaz,
  screen as ekran,
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

const quiz = {
  ...quizTekstowy,
  liczbaPytan: 2,
  pytania: [
    {
      ...quizTekstowy.pytania[0],
      wyjasnienie: 'Porównaj kierunki.',
      warianty: [
        { ...quizTekstowy.pytania[0].warianty[0], opis: 'Mało kategorii.' },
        quizTekstowy.pytania[0].warianty[1],
        { id: 'trzeci', etykieta: 'Trzeci' },
        { id: 'czwarty', etykieta: 'Czwarty' },
      ],
    },
    { ...quizTekstowy.pytania[0], id: 'drugie', tresc: 'Kolejne pytanie?' },
  ],
};

przedKazdym(() => {
  atrapy.stubGlobal('indexedDB', new FabrykaBazy());
  localStorage.clear();
});
poKazdym(() => {
  atrapy.restoreAllMocks();
  atrapy.unstubAllGlobals();
  localStorage.clear();
});

async function otworz(dane: unknown = quiz, sciezka = '/biblioteka') {
  await zapiszZatwierdzonyQuiz(walidujImportQuizu(JSON.stringify(dane)));
  pokaz(
    <Router initialEntries={[sciezka]}>
      <Aplikacja />
    </Router>,
  );
  const osoba = uzytkownik.setup();
  if (sciezka === '/biblioteka')
    await osoba.click(
      await ekran.findByRole('link', { name: 'Rozpocznij quiz' }),
    );
  return osoba;
}

opisz('Quiz uruchamiany z istniejącej Biblioteki', () => {
  sprawdz(
    'renderuje pełną treść, cztery warianty i rekomendację bez automatycznego wyboru',
    async () => {
      await otworz();
      const naglowek = await ekran.findByRole('heading', {
        name: 'Jaki podział wybierasz?',
      });
      oczekuj(naglowek).toHaveFocus();
      for (const tekst of [
        'Porównaj kierunki.',
        'Mało kategorii.',
        'Szybkie rozpoczęcie',
        'Mniej szczegółów',
        'Łatwiejsze przygotowanie',
        'Kilka kategorii.',
      ])
        oczekuj(ekran.getByText(tekst)).toBeVisible();
      oczekuj(ekran.getAllByRole('button', { name: /^Wybierz:/ })).toHaveLength(
        4,
      );
      const polecany = ekran.getByRole('button', { name: 'Wybierz: Prosty' });
      oczekuj(polecany).toHaveAttribute('aria-pressed', 'false');
      oczekuj(polecany.closest('article')).toHaveClass('rekomendowany');
      oczekuj(polecany.closest('article')).not.toHaveClass('wybrany');
      oczekuj(ekran.getByRole('button', { name: 'Dalej' })).toBeDisabled();
      oczekuj(ekran.getByRole('button', { name: 'Wstecz' })).toBeDisabled();
      oczekuj(
        ekran.queryByRole('button', { name: 'Wróć później' }),
      ).not.toBeInTheDocument();
      oczekuj(
        ekran.getByText(/Inne: odpowiedź własna jest nieobsługiwana/),
      ).toBeVisible();
    },
  );

  sprawdz(
    'obsługuje wybór klawiaturą, Dalej/Wstecz, zmianę wyboru i zakończenie',
    async () => {
      const osoba = await otworz();
      const czwarty = await ekran.findByRole('button', {
        name: 'Wybierz: Czwarty',
      });
      czwarty.focus();
      await osoba.keyboard(' ');
      oczekuj(czwarty).toHaveAttribute('aria-pressed', 'true');
      oczekuj(czwarty.closest('article')).toHaveClass('wybrany');
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Prosty' }),
      ).toHaveAttribute('aria-pressed', 'false');
      await osoba.click(ekran.getByRole('button', { name: 'Dalej' }));
      oczekuj(
        ekran.getByRole('heading', { name: 'Kolejne pytanie?' }),
      ).toHaveFocus();
      await osoba.click(ekran.getByRole('button', { name: 'Wstecz' }));
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Czwarty' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await osoba.click(ekran.getByRole('button', { name: 'Wybierz: Prosty' }));
      const polecany = ekran.getByRole('button', { name: 'Wybierz: Prosty' });
      oczekuj(polecany.closest('article')).toHaveClass(
        'rekomendowany',
        'wybrany',
      );
      oczekuj(
        wewnatrz(polecany.closest('article')!).getByText('Twój wybór'),
      ).toBeVisible();
      await osoba.click(ekran.getByRole('button', { name: 'Dalej' }));
      await osoba.click(
        ekran.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      );
      await osoba.click(ekran.getByRole('button', { name: 'Dalej' }));
      oczekuj(
        ekran.getByRole('heading', { name: 'Quiz zakończony' }),
      ).toHaveFocus();
      await osoba.click(ekran.getByRole('button', { name: 'Wstecz' }));
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      ).toHaveAttribute('aria-pressed', 'true');
      oczekuj((await odczytajBiblioteke())[0]?.quiz).toEqual(quiz);
    },
  );

  sprawdz(
    'zapisuje ustawienie lokalnie i ukrywa rekomendację przy uruchomieniu quizu',
    async () => {
      const osoba = await otworz(quiz, '/ustawienia');
      await osoba.click(
        ekran.getByRole('checkbox', { name: 'Pokazuj rekomendacje' }),
      );
      await osoba.click(ekran.getByRole('link', { name: 'Biblioteka' }));
      await osoba.click(
        await ekran.findByRole('link', { name: 'Rozpocznij quiz' }),
      );
      const przycisk = await ekran.findByRole('button', {
        name: 'Wybierz: Prosty',
      });
      oczekuj(przycisk.closest('article')).not.toHaveClass('rekomendowany');
      oczekuj(ekran.queryByText(/Rekomendacja autora/)).not.toBeInTheDocument();
      await osoba.click(przycisk);
      oczekuj(przycisk).toHaveAttribute('aria-pressed', 'true');
      await osoba.click(ekran.getByRole('link', { name: 'Ustawienia' }));
      oczekuj(
        ekran.getByRole('checkbox', { name: 'Pokazuj rekomendacje' }),
      ).not.toBeChecked();
    },
  );

  sprawdz(
    'komunikuje odmowę wykonania mechaniki bez przycisków wyboru',
    async () => {
      await otworz({
        ...quizTekstowy,
        pytania: [
          {
            ...quizTekstowy.pytania[0],
            sposobyOdpowiedzi: [
              { id: 'wybor', rodzaj: 'takNie', wymagany: true },
            ],
          },
        ],
      });
      await ekran.findByText(
        /Ten zestaw sposobów odpowiedzi jest nieobsługiwany/,
      );
      oczekuj(
        ekran.queryByRole('button', { name: /^Wybierz:/ }),
      ).not.toBeInTheDocument();
      oczekuj(ekran.getByRole('button', { name: 'Dalej' })).toBeDisabled();
    },
  );

  sprawdz(
    'nie zapisuje sesji i po ponownym otwarciu rozpoczyna od początku',
    async () => {
      const osoba = await otworz();
      await osoba.click(
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      );
      await osoba.click(ekran.getByRole('button', { name: 'Dalej' }));
      await osoba.click(
        ekran.getByRole('link', { name: 'Wróć do Biblioteki' }),
      );
      await osoba.click(
        await ekran.findByRole('link', { name: 'Rozpocznij quiz' }),
      );
      oczekuj(
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      ).toHaveAttribute('aria-pressed', 'false');
    },
  );

  sprawdz(
    'pokazuje błąd dla nieistniejącego quizu i niedostępnej Biblioteki',
    async () => {
      const widok = pokaz(
        <Router initialEntries={['/quiz/nieistniejacy']}>
          <Aplikacja />
        </Router>,
      );
      oczekuj(await ekran.findByRole('alert')).toHaveTextContent(
        'Nie znaleziono tego quizu',
      );
      widok.unmount();
      atrapy.stubGlobal('indexedDB', undefined);
      pokaz(
        <Router initialEntries={['/quiz/nieistniejacy']}>
          <Aplikacja />
        </Router>,
      );
      oczekuj(await ekran.findByRole('alert')).toHaveTextContent(
        'Nie można odczytać lokalnej biblioteki',
      );
    },
  );

  sprawdz(
    'pokazuje błąd zapisu ustawienia zamiast sugerować trwałość',
    async () => {
      atrapy.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Brak miejsca');
      });
      pokaz(
        <Router initialEntries={['/ustawienia']}>
          <Aplikacja />
        </Router>,
      );
      await uzytkownik
        .setup()
        .click(ekran.getByRole('checkbox', { name: 'Pokazuj rekomendacje' }));
      oczekuj(ekran.getByRole('alert')).toHaveTextContent(
        'Nie zapisano ustawienia lokalnie',
      );
    },
  );
});
