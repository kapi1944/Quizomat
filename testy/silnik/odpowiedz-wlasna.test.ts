import { describe as opisz, it as sprawdz, expect as oczekuj } from 'vitest';
import {
  FakeAnalizator,
  analizatorAutorski,
  sprawdzAnalize,
} from '../../src/ai/analizator';
import {
  zapiszSzkic,
  zatwierdzOdpowiedzWlasna,
} from '../../src/silnik/odpowiedz-wlasna';
import {
  aktualizujSesje,
  utworzSesje,
  wznowSesje,
} from '../../src/silnik/sesja';
import type { PrzebiegSesji } from '../../src/silnik/sesja';
import { przejdzDalej, wybierzWariant } from '../../src/silnik/runtime';
import type { Wynik } from '../../src/silnik/runtime';
import { quizTekstowy } from '../domena/przyklady';

const czas = '2026-10-08T10:00:00.000Z';
const pytanie = quizTekstowy.pytania[0];
const quiz = {
  ...quizTekstowy,
  liczbaPytan: 2,
  pytania: [pytanie, { ...pytanie, id: 'drugie' }],
  reguly: [
    {
      id: 'pomin',
      powod: 'Prosty wybór pomija szczegóły.',
      warunek: {
        pytanieId: pytanie.id,
        sposobId: 'wybor',
        operator: 'rowne' as const,
        wartosc: 'prosty',
      },
      operacja: { rodzaj: 'pomin' as const, pytanieId: 'drugie' },
    },
  ],
};
function wartosc<T>(wynik: Wynik<T>): T {
  if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
  return wynik.wartosc;
}
function poczatek() {
  return wartosc(utworzSesje(quiz, 'sesja', czas));
}
function szkic(stan: PrzebiegSesji, tekst = 'Własny kierunek') {
  return wartosc(
    zapiszSzkic(stan, { pytanieId: pytanie.id, tekst, stan: 'szkic' }),
  );
}
function oczekiwanie(stan: PrzebiegSesji) {
  return wartosc(
    zapiszSzkic(stan, {
      ...stan.sesja.szkiceWlasnychOdpowiedzi[0],
      stan: 'oczekujeAnalizy',
    }),
  );
}
async function analizuj(stan: PrzebiegSesji) {
  const oczekujacy = oczekiwanie(stan);
  const tekst = oczekujacy.sesja.szkiceWlasnychOdpowiedzi[0]!.tekst;
  const analiza = await new FakeAnalizator().analizuj({ pytanie, tekst, quiz });
  return wartosc(
    zapiszSzkic(oczekujacy, {
      pytanieId: pytanie.id,
      tekst,
      stan: 'przeanalizowana',
      analiza,
    }),
  );
}

opisz('Własna odpowiedź Etapu 8', () => {
  sprawdz(
    'lokalna analiza autora działa bez integracji i waliduje opcjonalne dane',
    async () => {
      const analiza = {
        tryb: 'autorska' as const,
        interpretacja: 'Interpretacja autora',
        potencjalneSkutki: [],
      };
      const autorskie = {
        ...pytanie,
        innaOdpowiedz: { etykieta: 'Inne', analiza },
      };
      oczekuj(
        await analizatorAutorski.analizuj({
          pytanie: autorskie,
          tekst: 'Mój tekst',
          quiz,
        }),
      ).toEqual(analiza);
      oczekuj(() => sprawdzAnalize({ ...analiza, zalety: 5 }, quiz)).toThrow(
        'niepoprawny wynik',
      );
      oczekuj(() =>
        sprawdzAnalize({ ...analiza, dotknietePytaniaId: ['obce'] }, quiz),
      ).toThrow('nieistniejące pytanie');
    },
  );

  sprawdz(
    'szkic ≠ decyzja, analiza ≠ decyzja, zatwierdzenie = decyzja',
    async () => {
      const start = poczatek();
      const zapisany = szkic(start);
      const wynik = await analizuj(zapisany);
      for (const stan of [zapisany, oczekiwanie(zapisany), wynik]) {
        oczekuj(stan.sesja.decyzje).toEqual([]);
        oczekuj(stan.sesja.dziennikSesji).toEqual(start.sesja.dziennikSesji);
        oczekuj(stan.przebieg).toEqual(start.przebieg);
        oczekuj(przejdzDalej(stan.przebieg).stan).toBe('blad');
      }
      oczekuj(
        zatwierdzOdpowiedzWlasna(zapisany, {
          id: 'za-wczesnie',
          zatwierdzono: czas,
        }).stan,
      ).toBe('blad');
      const decyzja = wartosc(
        zatwierdzOdpowiedzWlasna(wynik, {
          id: 'potwierdzenie',
          zatwierdzono: czas,
        }),
      );
      oczekuj(decyzja.sesja.decyzje[0]?.odpowiedz).toMatchObject({
        rodzaj: 'wlasna',
        tekst: 'Własny kierunek',
        analiza: { interpretacja: 'Analiza testowa: Własny kierunek' },
      });
      oczekuj(decyzja.sesja.dziennikSesji!.zdarzenia).toHaveLength(1);
      oczekuj(decyzja.sesja.szkiceWlasnychOdpowiedzi).toEqual([]);
      oczekuj(przejdzDalej(decyzja.przebieg).stan).toBe('gotowy');
      oczekuj(
        wartosc(wznowSesje(quiz, JSON.parse(JSON.stringify(decyzja.sesja)))),
      ).toEqual(decyzja);
    },
  );

  sprawdz(
    'zmiana po analizie usuwa wynik i odrzuca spóźnioną analizę poprzedniego tekstu',
    async () => {
      const wynik = await analizuj(szkic(poczatek()));
      const zmieniony = szkic(wynik, 'Nowy kierunek');
      oczekuj(zmieniony.sesja.szkiceWlasnychOdpowiedzi[0]).not.toHaveProperty(
        'analiza',
      );
      oczekuj(
        zatwierdzOdpowiedzWlasna(zmieniony, { id: 'obca', zatwierdzono: czas })
          .stan,
      ).toBe('blad');
      oczekuj(
        zapiszSzkic(
          oczekiwanie(zmieniony),
          wynik.sesja.szkiceWlasnychOdpowiedzi[0],
        ).stan,
      ).toBe('blad');
    },
  );

  sprawdz(
    'restart zachowuje szkic, oczekiwanie i wynik bez automatycznej decyzji',
    async () => {
      const zapisany = szkic(poczatek());
      for (const stan of [
        zapisany,
        oczekiwanie(zapisany),
        await analizuj(zapisany),
      ])
        oczekuj(
          wartosc(wznowSesje(quiz, JSON.parse(JSON.stringify(stan.sesja)))),
        ).toEqual(stan);
    },
  );

  sprawdz(
    'awaria FakeAnalizatora zachowuje oczekujący szkic bez decyzji',
    async () => {
      const stan = oczekiwanie(szkic(poczatek()));
      const przed = structuredClone(stan);
      await oczekuj(
        new FakeAnalizator(true).analizuj({
          pytanie,
          tekst: 'Własny kierunek',
          quiz,
        }),
      ).rejects.toThrow('niedostępna');
      oczekuj(stan).toEqual(przed);
      oczekuj(stan.sesja.decyzje).toEqual([]);
      await oczekuj(
        analizatorAutorski.analizuj({
          pytanie,
          tekst: 'Własny kierunek',
          quiz,
        }),
      ).rejects.toThrow('niedostępna');
    },
  );

  sprawdz(
    'replay/adaptacja dopiero po potwierdzeniu zastępuje wcześniejszy wybór',
    async () => {
      const start = poczatek();
      const wybrany = wartosc(
        aktualizujSesje(
          start,
          wybierzWariant(start.przebieg, 'prosty', {
            id: 'standard',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      oczekuj(wybrany.sesja.zmianyAdaptacyjne).toHaveLength(1);
      const wynik = await analizuj(szkic(wybrany));
      oczekuj(wynik.przebieg).toEqual(wybrany.przebieg);
      oczekuj(wynik.sesja.dziennikSesji).toEqual(wybrany.sesja.dziennikSesji);
      const potwierdzony = wartosc(
        zatwierdzOdpowiedzWlasna(wynik, { id: 'wlasna', zatwierdzono: czas }),
      );
      oczekuj(
        potwierdzony.przebieg.pytania.map((pytanie) => pytanie.id),
      ).toEqual([pytanie.id, 'drugie']);
      oczekuj(potwierdzony.sesja.zmianyAdaptacyjne).toEqual([]);
      oczekuj(potwierdzony.sesja.historiaDecyzji).toEqual(
        wybrany.sesja.decyzje,
      );
      oczekuj(potwierdzony.sesja.historiaZmianAdaptacyjnych).toEqual(
        wybrany.sesja.zmianyAdaptacyjne,
      );
      oczekuj(wartosc(wznowSesje(quiz, potwierdzony.sesja))).toEqual(
        potwierdzony,
      );
    },
  );

  sprawdz(
    'FakeAnalizator jest deterministyczny; pusty szkic nie przechodzi do analizy',
    async () => {
      const analizator = new FakeAnalizator();
      const zlecenie = { pytanie, tekst: 'Ten sam tekst', quiz };
      oczekuj(await analizator.analizuj(zlecenie)).toEqual(
        await analizator.analizuj(zlecenie),
      );
      const pusty = szkic(poczatek(), '   ');
      oczekuj(
        zapiszSzkic(pusty, {
          pytanieId: pytanie.id,
          tekst: '   ',
          stan: 'oczekujeAnalizy',
        }).stan,
      ).toBe('blad');
    },
  );
});
