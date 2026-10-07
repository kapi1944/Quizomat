import { describe as opisz, expect as oczekuj, it as sprawdz } from 'vitest';
import {
  aktualizujSesje,
  odlozPytanie,
  utworzSesje,
  wrocDoPytania,
  wznowSesje,
} from '../../src/silnik/sesja';
import { przejdzDalej, wybierzWariant } from '../../src/silnik/runtime';
import type { Wynik } from '../../src/silnik/runtime';
import { quizTekstowy } from '../domena/przyklady';

const czas = '2026-10-08T10:00:00.000Z';
function wartosc<T>(wynik: Wynik<T>): T {
  if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
  return wynik.wartosc;
}

opisz('Sesja kanoniczna i odkładanie', () => {
  sprawdz(
    'odłożenie przechodzi do końca zestawu, nie kończy sesji i przetrwa wznowienie',
    () => {
      const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
      const odlozona = wartosc(odlozPytanie(poczatek, czas));
      oczekuj(odlozona.sesja.stan).toBe('wTrakcie');
      oczekuj(odlozona.sesja.biezacePytanieId).toBeNull();
      oczekuj(odlozona.sesja.odlozonePytaniaId).toEqual(['podzial']);
      oczekuj(odlozona.sesja.decyzje).toEqual([]);
      const wznowiona = wartosc(wznowSesje(quizTekstowy, odlozona.sesja));
      oczekuj(wznowiona).toEqual(odlozona);
      const powrot = wartosc(wrocDoPytania(wznowiona, 'podzial', czas));
      oczekuj(powrot.sesja.odlozonePytaniaId).toEqual(['podzial']);
      const wybrana = wartosc(
        aktualizujSesje(
          powrot,
          wybierzWariant(powrot.przebieg, 'prosty', {
            id: 'decyzja-1',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      oczekuj(wybrana.sesja.odlozonePytaniaId).toEqual([]);
      const koniec = wartosc(
        aktualizujSesje(wybrana, przejdzDalej(wybrana.przebieg), czas),
      );
      oczekuj(koniec.sesja.stan).toBe('zakonczona');
      oczekuj(wartosc(wznowSesje(quizTekstowy, koniec.sesja))).toEqual(koniec);
      oczekuj(poczatek.sesja.odlozonePytaniaId).toEqual([]);
    },
  );

  sprawdz(
    'odłożenie wybranego pytania usuwa bieżącą decyzję, ale zachowuje istniejącą historię',
    () => {
      const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
      const wybrana = wartosc(
        aktualizujSesje(
          poczatek,
          wybierzWariant(poczatek.przebieg, 'prosty', {
            id: 'decyzja-1',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      const odlozona = wartosc(odlozPytanie(wybrana, czas));
      oczekuj(odlozona.sesja.decyzje).toEqual([]);
      oczekuj(odlozona.sesja.historiaDecyzji).toEqual(wybrana.sesja.decyzje);
      oczekuj(odlozPytanie(odlozona, czas).stan).toBe('blad');
      oczekuj(wrocDoPytania(odlozona, 'obcy', czas).stan).toBe('blad');
    },
  );

  sprawdz.each([
    { quizId: 'obcy' },
    { wersjaQuizu: '2.0.0' },
    { biezacePytanieId: 'obce' },
    { odlozonePytaniaId: ['obce'] },
    { stan: 'zakonczona' },
    { biezacePytanieId: null },
  ])('odrzuca niespójną sesję: %j', (zmiana) => {
    const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
    oczekuj(
      wznowSesje(quizTekstowy, { ...poczatek.sesja, ...zmiana }).stan,
    ).toBe('blad');
  });

  sprawdz(
    'weryfikuje wariant odpowiedzi przy wznowieniu, nie tylko strukturę sesji',
    () => {
      const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
      oczekuj(
        wznowSesje(quizTekstowy, {
          ...poczatek.sesja,
          decyzje: [
            {
              id: 'decyzja',
              pytanieId: 'podzial',
              zatwierdzono: czas,
              adnotacje: [],
              odpowiedz: {
                rodzaj: 'standardowa',
                wartosci: [
                  {
                    sposobId: 'wybor',
                    rodzaj: 'pojedynczyWybor',
                    wariantId: 'obcy',
                  },
                ],
              },
            },
          ],
        }).stan,
      ).toBe('blad');
    },
  );
});
