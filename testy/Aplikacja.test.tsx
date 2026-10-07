import { render as pokaz, screen as ekran } from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter as Router } from 'react-router-dom';
import { describe as opisz, expect as oczekuj, it as sprawdz } from 'vitest';
import { Aplikacja } from '../src/aplikacja/Aplikacja';

opisz('Shell Quizomatu', () => {
  sprawdz('przenosi fokus do treści bez zmiany trasy', async () => {
    const osoba = uzytkownik.setup();
    pokaz(
      <Router initialEntries={['/import']}>
        <Aplikacja />
      </Router>,
    );
    await osoba.click(ekran.getByRole('link', { name: 'Przejdź do treści' }));
    oczekuj(ekran.getByRole('main')).toHaveFocus();
    oczekuj(ekran.getByRole('heading', { name: 'Import' })).toBeVisible();
  });

  sprawdz(
    'prowadzi ze startu do biblioteki i oznacza aktywną stronę',
    async () => {
      const osoba = uzytkownik.setup();
      pokaz(
        <Router>
          <Aplikacja />
        </Router>,
      );
      oczekuj(
        ekran.getByRole('heading', { name: 'Twoje decyzje. Spójny projekt.' }),
      ).toBeVisible();
      await osoba.click(
        ekran.getByRole('link', { name: 'Przejdź do biblioteki' }),
      );
      oczekuj(ekran.getByRole('heading', { name: 'Biblioteka' })).toBeVisible();
      oczekuj(ekran.getByRole('link', { name: 'Biblioteka' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      oczekuj(ekran.getByRole('link', { name: 'Start' })).not.toHaveAttribute(
        'aria-current',
      );
    },
  );

  sprawdz.each([
    ['/import', 'Import'],
    ['/ustawienia', 'Ustawienia'],
  ])('pokazuje uczciwy placeholder pod adresem %s', (sciezka, tytul) => {
    pokaz(
      <Router initialEntries={[sciezka]}>
        <Aplikacja />
      </Router>,
    );
    oczekuj(ekran.getByRole('heading', { name: tytul })).toBeVisible();
    oczekuj(
      ekran.getByText('Ta funkcja nie jest jeszcze dostępna w Etapie 0.'),
    ).toBeVisible();
  });

  sprawdz('pozwala wrócić z nieistniejącego adresu na start', async () => {
    const osoba = uzytkownik.setup();
    pokaz(
      <Router initialEntries={['/nieznana']}>
        <Aplikacja />
      </Router>,
    );
    oczekuj(
      ekran.getByRole('heading', { name: 'Nie znaleziono strony' }),
    ).toBeVisible();
    await osoba.click(ekran.getByRole('link', { name: 'Wróć na start' }));
    oczekuj(
      ekran.getByRole('heading', { name: 'Twoje decyzje. Spójny projekt.' }),
    ).toBeVisible();
  });
});
