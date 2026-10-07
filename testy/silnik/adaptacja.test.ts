import { describe as opisz, expect as oczekuj, it as sprawdz } from 'vitest';
import { schematQuizu } from '../../src/domena/quiz';
import type { Quiz, RegulaAdaptacyjna } from '../../src/domena/quiz';
import { schematZmianyAdaptacyjnej } from '../../src/domena/sesja';
import {
  aktualizujSesje,
  odlozPytanie,
  utworzSesje,
  wznowSesje,
} from '../../src/silnik/sesja';
import type { PrzebiegSesji } from '../../src/silnik/sesja';
import {
  biezacePytanie,
  przejdzDalej,
  przejdzWstecz,
  rozpocznijQuiz,
  wybierzWariant,
} from '../../src/silnik/runtime';
import type { Wynik } from '../../src/silnik/runtime';
import { odtworzSesje } from '../../src/silnik/replay';
import { quizTekstowy } from '../domena/przyklady';

const czas = '2026-10-08T10:00:00.000Z';
const pierwsze = quizTekstowy.pytania[0];
const quiz: Quiz = {
  ...quizTekstowy,
  liczbaPytan: 3,
  pytania: [
    pierwsze,
    { ...pierwsze, id: 'drugie' },
    { ...pierwsze, id: 'trzecie' },
  ],
  pytaniaDodatkowe: [
    { ...pierwsze, id: 'dodatkowe' },
    { ...pierwsze, id: 'inne' },
  ],
};
function regula(
  id: string,
  operacja: RegulaAdaptacyjna['operacja'],
  zrodlo = pierwsze.id,
): RegulaAdaptacyjna {
  return {
    id,
    powod: `Powód ${id}`,
    warunek: {
      pytanieId: zrodlo,
      sposobId: 'wybor',
      operator: 'rowne',
      wartosc: 'szczegolowy',
    },
    operacja,
  };
}
function wartosc<T>(wynik: Wynik<T>): T {
  if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
  return wynik.wartosc;
}
function poczatek(reguly: RegulaAdaptacyjna[]) {
  const definicja = { ...quiz, reguly };
  oczekuj(schematQuizu.safeParse(definicja).success).toBe(true);
  return wartosc(utworzSesje(definicja, 'sesja', czas));
}
function wybierz(stan: PrzebiegSesji, wariant = 'szczegolowy') {
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
function sciezka(stan: PrzebiegSesji) {
  return stan.przebieg.pytania.map((pytanie) => pytanie.id);
}
const dodanie = regula('dodanie', {
  rodzaj: 'dodaj',
  pytanieId: 'dodatkowe',
  poPytaniuId: pierwsze.id,
});

opisz('Adaptacja i replay Etapu 7', () => {
  sprawdz(
    'add tworzy pełną zmianę i wstawia pytanie w ścieżkę bez mutacji quizu',
    () => {
      const stan = poczatek([dodanie]);
      const przed = structuredClone(stan);
      const wybrany = wybierz(stan);
      oczekuj(sciezka(wybrany)).toEqual([
        pierwsze.id,
        'dodatkowe',
        'drugie',
        'trzecie',
      ]);
      oczekuj(biezacePytanie(dalej(wybrany).przebieg)?.id).toBe('dodatkowe');
      const zmiana = wybrany.sesja.zmianyAdaptacyjne[0]!;
      oczekuj(schematZmianyAdaptacyjnej.safeParse(zmiana).success).toBe(true);
      oczekuj(zmiana).toMatchObject({
        rodzaj: 'dodaj',
        regulaId: dodanie.id,
        powod: dodanie.powod,
        przed: null,
        po: { id: 'dodatkowe' },
        zrodlo: { pytanie: pierwsze, decyzja: wybrany.sesja.decyzje[0] },
      });
      oczekuj(stan).toEqual(przed);
    },
  );

  sprawdz('skip pomija pytanie i kończy tylko aktywną ścieżkę', () => {
    let stan = wybierz(
      poczatek([
        regula('pominiecie', { rodzaj: 'pomin', pytanieId: 'drugie' }),
      ]),
    );
    oczekuj(sciezka(stan)).toEqual([pierwsze.id, 'trzecie']);
    oczekuj(stan.sesja.zmianyAdaptacyjne[0]).toMatchObject({
      rodzaj: 'pomin',
      przed: { id: 'drugie' },
      po: null,
    });
    stan = dalej(wybierz(dalej(stan), 'prosty'));
    oczekuj(stan.sesja.stan).toBe('zakonczona');
  });

  sprawdz('modify zmienia treść, wyjaśnienie i rekomendowany wariant', () => {
    const zmiany = {
      tresc: 'Nowe pytanie',
      wyjasnienie: 'Nowy opis',
      rekomendacja: { wariantId: 'szczegolowy', uzasadnienie: 'Nowy kierunek' },
    };
    const stan = wybierz(
      poczatek([
        regula('modyfikacja', {
          rodzaj: 'modyfikuj',
          pytanieId: 'drugie',
          zmiany,
        }),
      ]),
    );
    oczekuj(biezacePytanie(dalej(stan).przebieg)).toMatchObject(zmiany);
    oczekuj(stan.sesja.zmianyAdaptacyjne[0]).toMatchObject({
      rodzaj: 'modyfikuj',
      przed: { tresc: pierwsze.tresc },
      po: zmiany,
    });
  });

  sprawdz(
    'kilka reguł: kolejność tablicy, wspólna kotwica i zależny łańcuch',
    () => {
      const reguly = [
        dodanie,
        regula('inne', {
          rodzaj: 'dodaj',
          pytanieId: 'inne',
          poPytaniuId: pierwsze.id,
        }),
        regula(
          'lancuch',
          { rodzaj: 'pomin', pytanieId: 'drugie' },
          'dodatkowe',
        ),
      ];
      let stan = wybierz(poczatek(reguly));
      oczekuj(sciezka(stan)).toEqual([
        pierwsze.id,
        'dodatkowe',
        'inne',
        'drugie',
        'trzecie',
      ]);
      stan = wybierz(dalej(stan));
      oczekuj(sciezka(stan)).toEqual([
        pierwsze.id,
        'dodatkowe',
        'inne',
        'trzecie',
      ]);
      oczekuj(
        stan.sesja.zmianyAdaptacyjne.map((zmiana) => zmiana.regulaId),
      ).toEqual(['dodanie', 'inne', 'lancuch']);
      oczekuj(wartosc(odtworzSesje(stan.przebieg.quiz, stan.sesja))).toEqual(
        stan.sesja,
      );
    },
  );

  sprawdz(
    'konflikt celu odrzuca walidator i runtime bez wyboru zwycięzcy',
    () => {
      const definicja = {
        ...quiz,
        reguly: [
          regula('a', { rodzaj: 'pomin', pytanieId: 'drugie' }),
          regula('b', {
            rodzaj: 'modyfikuj',
            pytanieId: 'drugie',
            zmiany: { tresc: 'Konflikt' },
          }),
        ],
      };
      oczekuj(schematQuizu.safeParse(definicja).success).toBe(false);
      oczekuj(rozpocznijQuiz(definicja).stan).toBe('blad');
    },
  );

  sprawdz(
    'reguła czeka na dodatkową kotwicę niezależnie od miejsca w tablicy',
    () => {
      const zalezne = regula('zalezne-dodanie', {
        rodzaj: 'dodaj',
        pytanieId: 'inne',
        poPytaniuId: 'dodatkowe',
      });
      const stan = wybierz(poczatek([zalezne, dodanie]));
      oczekuj(sciezka(stan)).toEqual([
        pierwsze.id,
        'dodatkowe',
        'inne',
        'drugie',
        'trzecie',
      ]);
      oczekuj(
        stan.sesja.zmianyAdaptacyjne.map((zmiana) => zmiana.regulaId),
      ).toEqual(['dodanie', 'zalezne-dodanie']);
    },
  );

  sprawdz(
    'skip po cofnięciu archiwizuje odpowiedź bazową, zachowując niezależną późniejszą',
    () => {
      let stan = wybierz(
        poczatek([regula('skip', { rodzaj: 'pomin', pytanieId: 'drugie' })]),
        'prosty',
      );
      stan = dalej(wybierz(dalej(stan), 'prosty'));
      stan = wybierz(stan, 'prosty');
      const trzecia = stan.sesja.decyzje.find(
        (decyzja) => decyzja.pytanieId === 'trzecie',
      );
      const druga = stan.sesja.decyzje.find(
        (decyzja) => decyzja.pytanieId === 'drugie',
      );
      stan = wybierz(wstecz(wstecz(stan)));
      oczekuj(stan.sesja.decyzje).toContainEqual(trzecia);
      oczekuj(stan.sesja.historiaDecyzji).toContainEqual(druga);
      oczekuj(stan.sesja.decyzje).not.toContainEqual(druga);
      oczekuj(wartosc(wznowSesje(stan.przebieg.quiz, stan.sesja))).toEqual(
        stan,
      );
    },
  );

  sprawdz(
    'cofnięcie zachowuje adaptację, wielokrotna zmiana ją cofa i odtwarza',
    () => {
      let stan = wybierz(poczatek([dodanie]));
      const zmiana = stan.sesja.zmianyAdaptacyjne[0];
      stan = wstecz(dalej(stan));
      oczekuj(stan.sesja.zmianyAdaptacyjne).toEqual([zmiana]);
      stan = wybierz(stan, 'prosty');
      oczekuj(stan.sesja.zmianyAdaptacyjne).toEqual([]);
      oczekuj(stan.sesja.historiaZmianAdaptacyjnych).toEqual([zmiana]);
      stan = wybierz(stan);
      stan = wybierz(stan, 'prosty');
      stan = wybierz(stan);
      oczekuj(stan.sesja.historiaZmianAdaptacyjnych).toHaveLength(2);
      oczekuj(sciezka(stan)).toContain('dodatkowe');
      oczekuj(
        wartosc(
          wznowSesje(
            stan.przebieg.quiz,
            JSON.parse(JSON.stringify(stan.sesja)),
          ),
        ),
      ).toEqual(stan);
    },
  );

  sprawdz(
    'osierocona późniejsza decyzja zostaje w historii i nie uruchamia dalszych reguł',
    () => {
      let stan = wybierz(
        poczatek([
          dodanie,
          regula(
            'zalezne',
            { rodzaj: 'pomin', pytanieId: 'trzecie' },
            'dodatkowe',
          ),
        ]),
      );
      stan = wybierz(dalej(stan));
      const osierocona = stan.sesja.decyzje.find(
        (decyzja) => decyzja.pytanieId === 'dodatkowe',
      )!;
      stan = wybierz(wstecz(stan), 'prosty');
      oczekuj(
        stan.sesja.decyzje.some((decyzja) => decyzja.id === osierocona.id),
      ).toBe(false);
      oczekuj(stan.sesja.historiaDecyzji).toContainEqual(osierocona);
      oczekuj(sciezka(stan)).toEqual([pierwsze.id, 'drugie', 'trzecie']);
      stan = wybierz(stan);
      oczekuj(
        stan.sesja.decyzje.some((decyzja) => decyzja.pytanieId === 'dodatkowe'),
      ).toBe(false);
      oczekuj(sciezka(stan)).toContain('trzecie');
      oczekuj(
        wartosc(
          wznowSesje(
            stan.przebieg.quiz,
            JSON.parse(JSON.stringify(stan.sesja)),
          ),
        ),
      ).toEqual(stan);
    },
  );

  sprawdz(
    'odłożenie źródła usuwa dodaną gałąź i wybiera następne aktywne pytanie',
    () => {
      const stan = wartosc(odlozPytanie(wybierz(poczatek([dodanie])), czas));
      oczekuj(stan.sesja.biezacePytanieId).toBe('drugie');
      oczekuj(stan.sesja.zmianyAdaptacyjne).toEqual([]);
      oczekuj(stan.sesja.odlozonePytaniaId).toEqual([pierwsze.id]);
    },
  );

  sprawdz(
    'replay po restarcie odtwarza identycznie i odrzuca podmienioną adaptację',
    () => {
      let stan = wybierz(poczatek([dodanie]));
      stan = dalej(wybierz(dalej(stan), 'prosty'));
      const zapis = JSON.parse(JSON.stringify(stan.sesja));
      for (let indeks = 0; indeks < 3; indeks++) {
        oczekuj(wartosc(wznowSesje(stan.przebieg.quiz, zapis))).toEqual(stan);
        oczekuj(wartosc(odtworzSesje(stan.przebieg.quiz, zapis))).toEqual(
          stan.sesja,
        );
      }
      zapis.zmianyAdaptacyjne = [];
      oczekuj(wznowSesje(stan.przebieg.quiz, zapis).stan).toBe('blad');
    },
  );
});
