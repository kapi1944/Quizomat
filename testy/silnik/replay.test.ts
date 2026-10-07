import { describe as opisz, expect as oczekuj, it as sprawdz } from 'vitest';
import {
  aktualizujSesje,
  odlozPytanie,
  utworzSesje,
  wrocDoPytania,
  wznowSesje,
} from '../../src/silnik/sesja';
import type { PrzebiegSesji } from '../../src/silnik/sesja';
import { odtworzSesje } from '../../src/silnik/replay';
import {
  przejdzDalej,
  przejdzWstecz,
  wybierzWariant,
} from '../../src/silnik/runtime';
import type { Wynik } from '../../src/silnik/runtime';
import { quizTekstowy } from '../domena/przyklady';

const czas = '2026-10-08T10:00:00.000Z';
const quiz = {
  ...quizTekstowy,
  liczbaPytan: 3,
  pytania: [
    quizTekstowy.pytania[0],
    { ...quizTekstowy.pytania[0], id: 'drugie' },
    { ...quizTekstowy.pytania[0], id: 'trzecie' },
  ],
};
function wartosc<T>(wynik: Wynik<T>): T {
  if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
  return wynik.wartosc;
}
function wybierz(stan: PrzebiegSesji, wariant: string) {
  return wartosc(
    aktualizujSesje(
      stan,
      wybierzWariant(stan.przebieg, wariant, {
        id: `decyzja-${stan.sesja.dziennikSesji!.zdarzenia.length + 1}`,
        zatwierdzono: czas,
      }),
      czas,
    ),
  );
}
function dalej(stan: PrzebiegSesji) {
  return wartosc(aktualizujSesje(stan, przejdzDalej(stan.przebieg), czas));
}
function wstecz(stan: PrzebiegSesji) {
  return wartosc(
    aktualizujSesje(
      stan,
      { stan: 'gotowy', wartosc: przejdzWstecz(stan.przebieg) },
      czas,
    ),
  );
}

opisz('Czysty replay decyzji i nawigacji', () => {
  sprawdz.each([
    ['prosty', 'szczegolowy'],
    ['prosty', 'szczegolowy', 'prosty'],
  ])('zachowuje pełny łańcuch zmian %j', (...warianty) => {
    let stan = wartosc(utworzSesje(quiz, 'sesja', czas));
    const poczatek = structuredClone(stan);
    for (const wariant of warianty) stan = wybierz(stan, wariant);
    const dziennik = stan.sesja.dziennikSesji!;
    oczekuj(dziennik.zdarzenia).toHaveLength(warianty.length);
    oczekuj(dziennik.zdarzenia.map((zdarzenie) => zdarzenie.kolejnosc)).toEqual(
      warianty.map((_, indeks) => indeks + 1),
    );
    dziennik.zdarzenia.forEach((zdarzenie, indeks) => {
      if (zdarzenie.rodzaj !== 'decyzja') throw new Error('Oczekiwano decyzji');
      oczekuj(zdarzenie.pytanieId).toBe('podzial');
      oczekuj(zdarzenie.czas).toBe(czas);
      oczekuj(zdarzenie.poprzedniaDecyzja).toEqual(
        indeks === 0 ? null : stan.sesja.historiaDecyzji[indeks - 1],
      );
      oczekuj(zdarzenie.nowaDecyzja.odpowiedz).toEqual({
        rodzaj: 'standardowa',
        wartosci: [
          {
            sposobId: 'wybor',
            rodzaj: 'pojedynczyWybor',
            wariantId: warianty[indeks],
          },
        ],
      });
    });
    oczekuj(stan.sesja.historiaDecyzji).toHaveLength(warianty.length - 1);
    oczekuj(wartosc(odtworzSesje(quiz, stan.sesja))).toEqual(stan.sesja);
    oczekuj(poczatek.sesja.decyzje).toEqual([]);
  });

  sprawdz(
    'przelicza kilka wcześniejszych pytań i zachowuje ważne niezależne decyzje liniowe',
    () => {
      let stan = wartosc(utworzSesje(quiz, 'sesja', czas));
      stan = dalej(wybierz(stan, 'prosty'));
      stan = dalej(wybierz(stan, 'szczegolowy'));
      stan = dalej(wybierz(stan, 'prosty'));
      oczekuj(stan.sesja.stan).toBe('zakonczona');
      stan = wstecz(wstecz(stan));
      stan = wybierz(stan, 'prosty');
      stan = wstecz(stan);
      stan = wybierz(stan, 'szczegolowy');
      oczekuj(stan.sesja.decyzje).toHaveLength(3);
      oczekuj(
        stan.sesja.historiaDecyzji.map((decyzja) => decyzja.pytanieId),
      ).toEqual(['drugie', 'podzial']);
      oczekuj(wartosc(odtworzSesje(quiz, stan.sesja))).toEqual(stan.sesja);
      oczekuj(wartosc(wznowSesje(quiz, stan.sesja))).toEqual(stan);
    },
  );

  sprawdz(
    'replay odtwarza projekcję z dziennika, a wznowienie odrzuca przypadkowy stan',
    () => {
      const poczatek = wartosc(utworzSesje(quiz, 'sesja', czas));
      const stan = wybierz(wybierz(poczatek, 'prosty'), 'szczegolowy');
      const staraProjekcja = {
        ...stan.sesja,
        decyzje: poczatek.sesja.decyzje,
        historiaDecyzji: [],
      };
      oczekuj(wartosc(odtworzSesje(quiz, staraProjekcja))).toEqual(stan.sesja);
      oczekuj(wznowSesje(quiz, staraProjekcja).stan).toBe('blad');
      const przed = structuredClone(stan.sesja);
      for (let indeks = 0; indeks < 3; indeks++)
        oczekuj(wartosc(wznowSesje(quiz, stan.sesja))).toEqual(stan);
      oczekuj(stan.sesja).toEqual(przed);
    },
  );

  sprawdz(
    'replay zachowuje odłożenie, powrót, ponowne odłożenie i późniejszą odpowiedź',
    () => {
      let stan = wartosc(utworzSesje(quiz, 'sesja', czas));
      stan = wartosc(odlozPytanie(stan, czas));
      stan = wartosc(odlozPytanie(stan, czas));
      stan = wartosc(odlozPytanie(stan, czas));
      stan = wartosc(wrocDoPytania(stan, 'podzial', czas));
      stan = wartosc(wrocDoPytania(stan, 'drugie', czas));
      stan = wybierz(stan, 'prosty');
      stan = wartosc(odlozPytanie(stan, czas));
      oczekuj(stan.sesja.odlozonePytaniaId).toEqual([
        'podzial',
        'trzecie',
        'drugie',
      ]);
      oczekuj(wartosc(odtworzSesje(quiz, stan.sesja))).toEqual(stan.sesja);
    },
  );

  sprawdz.each(['kolejnosc', 'poprzednia', 'czas', 'wariant'] as const)(
    'odrzuca uszkodzone zdarzenie: %s',
    (pole) => {
      const stan = wybierz(
        wybierz(wartosc(utworzSesje(quiz, 'sesja', czas)), 'prosty'),
        'szczegolowy',
      );
      const sesja = structuredClone(stan.sesja);
      const zdarzenie = sesja.dziennikSesji!.zdarzenia[1]!;
      if (zdarzenie.rodzaj !== 'decyzja') throw new Error('Oczekiwano decyzji');
      if (pole === 'kolejnosc') zdarzenie.kolejnosc = 1;
      if (pole === 'poprzednia') zdarzenie.poprzedniaDecyzja = null;
      if (pole === 'czas') zdarzenie.czas = '2026-10-08T09:00:00.000Z';
      if (pole === 'wariant')
        zdarzenie.nowaDecyzja.odpowiedz = {
          rodzaj: 'standardowa',
          wartosci: [
            { sposobId: 'wybor', rodzaj: 'pojedynczyWybor', wariantId: 'obcy' },
          ],
        };
      oczekuj(odtworzSesje(quiz, sesja).stan).toBe('blad');
    },
  );

  sprawdz('odrzuca dodatkowe dane dopisane poza reduktorem', () => {
    const stan = wybierz(wartosc(utworzSesje(quiz, 'sesja', czas)), 'prosty');
    const obcyStan = { ...stan.przebieg, historiaDecyzji: [], decyzje: [] };
    oczekuj(
      aktualizujSesje(stan, { stan: 'gotowy', wartosc: obcyStan }, czas).stan,
    ).toBe('blad');
  });
});
