import { describe as opisz, expect as oczekuj, it as sprawdz } from 'vitest';
import type { Quiz } from '../../src/domena/quiz';
import {
  biezacePytanie,
  przejdzDalej,
  przejdzWstecz,
  rozpocznijQuiz,
  sprawdzObslugePytania,
  walidujOdpowiedz,
  wybierzWariant,
  wybranyWariant,
  zatwierdzDecyzje,
} from '../../src/silnik/runtime';
import type { Wynik } from '../../src/silnik/runtime';
import { quizAdaptacyjny, quizTekstowy } from '../domena/przyklady';

function wartosc<T>(wynik: Wynik<T>): T {
  if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
  return wynik.wartosc;
}
const zdarzenie = { id: 'decyzja-1', zatwierdzono: '2026-10-08T10:00:00.000Z' };
const pytanie = quizTekstowy.pytania[0];
const quiz: Quiz = {
  ...quizTekstowy,
  liczbaPytan: 2,
  pytania: [pytanie, { ...pytanie, id: 'drugie', tresc: 'Kolejna decyzja?' }],
};
const odpowiedz = {
  rodzaj: 'standardowa',
  wartosci: [
    { sposobId: 'wybor', rodzaj: 'pojedynczyWybor', wariantId: 'prosty' },
  ],
};

opisz('Liniowy runtime', () => {
  sprawdz(
    'wykonuje cały quiz, cofa z końca i zachowuje decyzje bez modyfikacji źródła',
    () => {
      const zrodlo = structuredClone(quiz);
      const poczatek = wartosc(rozpocznijQuiz(quiz));
      oczekuj(wybranyWariant(poczatek)).toBeNull();
      oczekuj(przejdzWstecz(poczatek).indeksPytania).toBe(0);
      oczekuj(przejdzDalej(poczatek).stan).toBe('blad');
      const wybrany = wartosc(wybierzWariant(poczatek, 'prosty', zdarzenie));
      const drugi = wartosc(przejdzDalej(wybrany));
      oczekuj(biezacePytanie(drugi)?.id).toBe('drugie');
      const koniec = wartosc(
        przejdzDalej(
          wartosc(
            wybierzWariant(drugi, 'szczegolowy', {
              ...zdarzenie,
              id: 'decyzja-2',
            }),
          ),
        ),
      );
      oczekuj(biezacePytanie(koniec)).toBeNull();
      oczekuj(przejdzDalej(koniec).stan).toBe('blad');
      oczekuj(wybranyWariant(przejdzWstecz(koniec))).toBe('szczegolowy');
      oczekuj(wybranyWariant(przejdzWstecz(drugi))).toBe('prosty');
      oczekuj(poczatek.decyzje).toEqual([]);
      oczekuj(quiz).toEqual(zrodlo);
    },
  );

  sprawdz(
    'jest deterministyczny dla tych samych danych i jawnych metadanych zdarzenia',
    () => {
      const poczatek = wartosc(rozpocznijQuiz(quiz));
      oczekuj(wybierzWariant(poczatek, 'prosty', zdarzenie)).toEqual(
        wybierzWariant(poczatek, 'prosty', zdarzenie),
      );
      const neutralny = {
        ...quiz,
        tytul: 'Inny cel',
        pytania: quiz.pytania.map((pytanie) => ({
          ...pytanie,
          tresc: 'Dowolna treść',
        })),
      };
      oczekuj(
        wartosc(
          wybierzWariant(
            wartosc(rozpocznijQuiz(neutralny)),
            'prosty',
            zdarzenie,
          ),
        ).decyzje,
      ).toEqual(wartosc(wybierzWariant(poczatek, 'prosty', zdarzenie)).decyzje);
    },
  );

  sprawdz(
    'przechowuje poprzednią decyzję po edycji i odrzuca ponowne ID zdarzenia',
    () => {
      const pierwszy = wartosc(
        wybierzWariant(wartosc(rozpocznijQuiz(quiz)), 'prosty', zdarzenie),
      );
      const zmieniony = wartosc(
        wybierzWariant(pierwszy, 'szczegolowy', {
          ...zdarzenie,
          id: 'decyzja-2',
        }),
      );
      oczekuj(wybranyWariant(zmieniony)).toBe('szczegolowy');
      oczekuj(zmieniony.decyzje).toHaveLength(1);
      oczekuj(zmieniony.historiaDecyzji).toEqual(pierwszy.decyzje);
      oczekuj(wybierzWariant(zmieniony, 'prosty', zdarzenie).stan).toBe('blad');
    },
  );

  sprawdz.each([
    [
      'nieistniejący wariant',
      {
        ...odpowiedz,
        wartosci: [{ ...odpowiedz.wartosci[0], wariantId: 'obcy' }],
      },
    ],
    [
      'obcy sposób',
      {
        ...odpowiedz,
        wartosci: [{ ...odpowiedz.wartosci[0], sposobId: 'obcy' }],
      },
    ],
    [
      'zły rodzaj',
      {
        ...odpowiedz,
        wartosci: [{ sposobId: 'wybor', rodzaj: 'takNie', wartosc: true }],
      },
    ],
    [
      'powtórzony sposób',
      {
        ...odpowiedz,
        wartosci: [...odpowiedz.wartosci, ...odpowiedz.wartosci],
      },
    ],
    ['brak wartości', { ...odpowiedz, wartosci: [] }],
  ])('odrzuca: %s', (_, dane) => {
    oczekuj(walidujOdpowiedz(pytanie, dane).stan).toBe('blad');
  });

  sprawdz(
    'odrzuca decyzję innego pytania oraz adnotację nieistniejącego wariantu',
    () => {
      const poczatek = wartosc(rozpocznijQuiz(quiz));
      const decyzja = {
        ...zdarzenie,
        pytanieId: 'drugie',
        odpowiedz,
        adnotacje: [],
      };
      oczekuj(zatwierdzDecyzje(poczatek, decyzja).stan).toBe('blad');
      oczekuj(
        zatwierdzDecyzje(poczatek, {
          ...decyzja,
          pytanieId: pytanie.id,
          adnotacje: [
            {
              id: 'notatka',
              pytanieId: pytanie.id,
              wariantId: 'obcy',
              tekst: 'Opis',
            },
          ],
        }).stan,
      ).toBe('blad');
    },
  );

  sprawdz.each([
    'wielokrotnyWybor',
    'takNie',
    'prawdaFalsz',
    'otwarta',
    'skala',
    'ranking',
    'kombinacjaWariantow',
  ] as const)('jawnie odmawia mechaniki %s', (rodzaj) => {
    const nieobslugiwane = {
      ...pytanie,
      sposobyOdpowiedzi: [
        {
          id: 'wybor',
          rodzaj,
          wymagany: true,
          minimum: 1,
          maksimum: 2,
          krok: 1,
          cel: 'pytanie' as const,
          maksymalnaDlugosc: 100,
          minimumElementow: 1,
        },
      ],
    };
    oczekuj(sprawdzObslugePytania(nieobslugiwane).stan).toBe('nieobslugiwane');
    const poczatek = wartosc(
      rozpocznijQuiz({ ...quizTekstowy, pytania: [nieobslugiwane] }),
    );
    oczekuj(wybierzWariant(poczatek, 'prosty', zdarzenie).stan).toBe(
      'nieobslugiwane',
    );
    oczekuj(przejdzDalej(poczatek).stan).toBe('nieobslugiwane');
  });

  sprawdz(
    'jawnie odmawia kompozycji, prezentacji wizualnej i własnej odpowiedzi',
    () => {
      oczekuj(
        sprawdzObslugePytania({
          ...pytanie,
          sposobyOdpowiedzi: [
            ...pytanie.sposobyOdpowiedzi,
            { id: 'drugi-wybor', rodzaj: 'pojedynczyWybor', wymagany: true },
          ],
        }).stan,
      ).toBe('nieobslugiwane');
      oczekuj(
        sprawdzObslugePytania({
          ...pytanie,
          prezentacja: { rodzaj: 'wizualna' },
        }).stan,
      ).toBe('nieobslugiwane');
      oczekuj(rozpocznijQuiz(quizAdaptacyjny).stan).toBe('gotowy');
      oczekuj(
        walidujOdpowiedz(pytanie, {
          rodzaj: 'wlasna',
          tekst: 'Inne',
          analiza: {
            tryb: 'autorska',
            interpretacja: 'Opis',
            potencjalneSkutki: [],
          },
        }).stan,
      ).toBe('nieobslugiwane');
      oczekuj(walidujOdpowiedz(pytanie, odpowiedz).stan).toBe('gotowy');
    },
  );
});
