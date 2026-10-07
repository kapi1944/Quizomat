import { render as pokaz, screen as ekran } from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import {
  beforeEach as przedKazdymTestem,
  describe as opisz,
  expect as oczekuj,
  it as sprawdz,
  vi as atrapy,
} from 'vitest';
import { useRegisterSW as uzyjRejestracjiPwa } from 'virtual:pwa-register/react';
import { KomunikatPwa } from '../src/komponenty/KomunikatPwa';

opisz('Świadoma aktualizacja PWA', () => {
  const zaktualizuj = atrapy.fn().mockResolvedValue(undefined);
  const ustawWymagaOdswiezenia = atrapy.fn();

  przedKazdymTestem(() => {
    atrapy.mocked(uzyjRejestracjiPwa).mockReturnValue({
      needRefresh: [true, ustawWymagaOdswiezenia],
      offlineReady: [false, atrapy.fn()],
      updateServiceWorker: zaktualizuj,
    });
  });

  sprawdz('aktualizuje dopiero po kliknięciu użytkownika', async () => {
    const osoba = uzytkownik.setup();
    pokaz(<KomunikatPwa />);
    oczekuj(zaktualizuj).not.toHaveBeenCalled();
    await osoba.click(ekran.getByRole('button', { name: 'Zaktualizuj' }));
    oczekuj(zaktualizuj).toHaveBeenCalledExactlyOnceWith(true);
  });

  sprawdz('pozwala odłożyć aktualizację bez przeładowania', async () => {
    const osoba = uzytkownik.setup();
    pokaz(<KomunikatPwa />);
    await osoba.click(ekran.getByRole('button', { name: 'Później' }));
    oczekuj(ustawWymagaOdswiezenia).toHaveBeenCalledExactlyOnceWith(false);
    oczekuj(zaktualizuj).not.toHaveBeenCalled();
  });
});
