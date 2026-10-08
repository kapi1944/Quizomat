import { it as sprawdz, expect as oczekuj } from 'vitest';
import type { Pytanie, Quiz } from '../../src/domena/quiz';
import type { Odpowiedz } from '../../src/domena/sesja';
import {
  utworzRaport,
  generujEksport,
  sekcjeRaportu,
} from '../../src/eksport/raport';
import {
  utworzSesje,
  aktualizujSesje,
  odlozPytanie,
  wznowSesje,
} from '../../src/silnik/sesja';
import type { PrzebiegSesji } from '../../src/silnik/sesja';
import {
  zatwierdzDecyzje,
  przejdzDalej,
  przejdzWstecz,
} from '../../src/silnik/runtime';
import type { Wynik } from '../../src/silnik/runtime';
import { quizTekstowy } from '../domena/przyklady';

const czas = '2026-10-08T12:00:00.000Z';
function wartosc<T>(wynik: Wynik<T>): T {
  if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
  return wynik.wartosc;
}
function wybierz(stan: PrzebiegSesji, odpowiedz: Odpowiedz) {
  return wartosc(
    aktualizujSesje(
      stan,
      zatwierdzDecyzje(stan.przebieg, {
        id: `decyzja-${stan.sesja.dziennikSesji!.zdarzenia.length + 1}`,
        pytanieId: stan.sesja.biezacePytanieId,
        odpowiedz,
        zatwierdzono: czas,
        notatka: 'Mój komentarz',
        adnotacje: [
          {
            id: 'uwaga',
            pytanieId: stan.sesja.biezacePytanieId,
            tekst: 'Moja adnotacja',
          },
        ],
      }),
      czas,
    ),
  );
}
function odpowiedz(wariantId = 'prosty'): Odpowiedz {
  return {
    rodzaj: 'standardowa',
    wartosci: [{ sposobId: 'wybor', rodzaj: 'pojedynczyWybor', wariantId }],
  };
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

sprawdz(
  'raport i wszystkie eksporty zachowują pełne mechaniki, treść autora, komentarze i zatwierdzoną odpowiedź własną',
  () => {
    const pytanie: Pytanie = {
      ...quizTekstowy.pytania[0],
      warianty: [
        {
          ...quizTekstowy.pytania[0].warianty[0]!,
          opis: 'Opis prostego wariantu',
        },
        quizTekstowy.pytania[0].warianty[1]!,
      ],
      sposobyOdpowiedzi: [
        { id: 'wybor', rodzaj: 'pojedynczyWybor', wymagany: true },
        {
          id: 'wiele',
          rodzaj: 'wielokrotnyWybor',
          wymagany: true,
          minimum: 0,
          maksimum: 2,
        },
        { id: 'zgoda', rodzaj: 'takNie', wymagany: true },
        { id: 'fakt', rodzaj: 'prawdaFalsz', wymagany: true },
        {
          id: 'tekst',
          rodzaj: 'otwarta',
          wymagany: true,
          maksymalnaDlugosc: 200,
        },
        {
          id: 'skala',
          rodzaj: 'skala',
          cel: 'pytanie',
          wymagany: true,
          minimum: 0,
          maksimum: 1,
          krok: 0.1,
        },
        {
          id: 'oceny',
          rodzaj: 'skala',
          cel: 'warianty',
          wymagany: true,
          minimum: 0,
          maksimum: 5,
          krok: 1,
        },
        {
          id: 'ranking',
          rodzaj: 'ranking',
          wymagany: true,
          minimum: 2,
          maksimum: 2,
        },
        {
          id: 'kombinacja',
          rodzaj: 'kombinacjaWariantow',
          wymagany: true,
          minimumElementow: 2,
        },
      ],
    };
    const quiz: Quiz = {
      ...quizTekstowy,
      liczbaPytan: 2,
      pytania: [
        pytanie,
        {
          ...quizTekstowy.pytania[0],
          id: 'wlasne',
          tresc: 'Twoja propozycja?',
        },
      ],
    };
    let stan = wartosc(utworzSesje(quiz, 'sesja', czas));
    stan = wybierz(stan, {
      rodzaj: 'standardowa',
      wartosci: [
        {
          sposobId: 'wybor',
          rodzaj: 'pojedynczyWybor',
          wariantId: 'szczegolowy',
        },
        {
          sposobId: 'wiele',
          rodzaj: 'wielokrotnyWybor',
          wariantyId: ['prosty', 'szczegolowy'],
        },
        { sposobId: 'zgoda', rodzaj: 'takNie', wartosc: false },
        { sposobId: 'fakt', rodzaj: 'prawdaFalsz', wartosc: false },
        {
          sposobId: 'tekst',
          rodzaj: 'otwarta',
          tekst: 'Żółta ścieżka i źródło',
        },
        { sposobId: 'skala', rodzaj: 'skala', cel: 'pytanie', wartosc: 0.3 },
        {
          sposobId: 'oceny',
          rodzaj: 'skala',
          cel: 'warianty',
          oceny: [
            { wariantId: 'prosty', wartosc: 0 },
            { wariantId: 'szczegolowy', wartosc: 5 },
          ],
        },
        {
          sposobId: 'ranking',
          rodzaj: 'ranking',
          wariantyId: ['szczegolowy', 'prosty'],
        },
        {
          sposobId: 'kombinacja',
          rodzaj: 'kombinacjaWariantow',
          elementy: [
            { wariantId: 'prosty', fragment: 'Układ', adnotacja: 'Bez zmian' },
            { wariantId: 'szczegolowy', fragment: 'Kolory' },
          ],
        },
      ],
    });
    stan = dalej(stan);
    stan = wybierz(stan, {
      rodzaj: 'wlasna',
      tekst: 'Moje własne rozwiązanie',
      analiza: {
        tryb: 'autorska',
        interpretacja: 'Analiza dostarczona w danych',
        potencjalneSkutki: ['Skutek podany przez autora'],
        zalety: ['Podana zaleta'],
        wady: ['Podana wada'],
        niejednoznacznosci: ['Podana niepewność'],
      },
    });
    stan = dalej(stan);
    const przed = structuredClone(stan);
    const raport = utworzRaport(quiz, stan.sesja, true);
    oczekuj(raport.specyfikacja.map((wpis) => wpis.decyzja)).toEqual(
      stan.sesja.decyzje,
    );
    oczekuj(raport.specyfikacja[0]?.pytanie).toEqual(pytanie);
    oczekuj(JSON.parse(generujEksport(raport, 'json').tresc)).toEqual(raport);
    const tekst = generujEksport(raport, 'txt').tresc;
    for (const fragment of [
      'Opis prostego wariantu',
      'Szybkie rozpoczęcie',
      'Mniej szczegółów',
      'Łatwiejsze przygotowanie',
      'Żółta ścieżka i źródło',
      '0.3',
      'Prosty: 0',
      '1. Szczegółowy\n2. Prosty',
      'Prosty: Układ',
      'Szczegółowy: Kolory',
      'Bez zmian',
      'Moje własne rozwiązanie',
      'Skutek podany przez autora',
      'Podana zaleta',
      'Podana wada',
      'Podana niepewność',
      'Mój komentarz',
      'Moja adnotacja',
      'Rekomendacja autora',
      'niekompletny względem źródła',
    ])
      oczekuj(tekst).toContain(fragment);
    oczekuj(tekst).toContain('NIE');
    oczekuj(tekst).toContain('FAŁSZ');
    oczekuj(generujEksport(raport, 'md').tresc).toContain('## Decyzja 1');
    oczekuj(stan).toEqual(przed);
    raport.specyfikacja[0]!.pytanie.tresc = 'Zmieniona kopia raportu';
    oczekuj(stan).toEqual(przed);
  },
);

sprawdz(
  'po zmianie wcześniejszej odpowiedzi eksportuje wyłącznie aktualną decyzję',
  () => {
    let stan = wartosc(utworzSesje(quizTekstowy, 'sesja', czas));
    stan = dalej(wybierz(stan, odpowiedz()));
    const stara = stan.sesja.decyzje[0]!;
    stan = wstecz(stan);
    stan = dalej(wybierz(stan, odpowiedz('szczegolowy')));
    oczekuj(stan.sesja.historiaDecyzji).toContainEqual(stara);
    const raport = utworzRaport(
      quizTekstowy,
      wartosc(wznowSesje(quizTekstowy, stan.sesja)).sesja,
    );
    oczekuj(raport.specyfikacja[0]?.decyzja.id).not.toBe(stara.id);
    oczekuj(generujEksport(raport, 'json').tresc).not.toContain(stara.id);
    oczekuj(raport).not.toHaveProperty('historiaDecyzji');
  },
);

sprawdz(
  'odłożone pytanie i niezapisana własna odpowiedź nie stają się decyzją',
  () => {
    let stan = wartosc(utworzSesje(quizTekstowy, 'sesja', czas));
    stan = wartosc(odlozPytanie(stan, czas));
    stan = wartosc(
      aktualizujSesje(stan, { stan: 'gotowy', wartosc: stan.przebieg }, czas),
    );
    const raport = utworzRaport(quizTekstowy, {
      ...stan.sesja,
      szkiceWlasnychOdpowiedzi: [
        {
          pytanieId: 'podzial',
          stan: 'szkic',
          tekst: 'Niepotwierdzona propozycja',
        },
      ],
    });
    oczekuj(raport.specyfikacja).toEqual([]);
    oczekuj(raport.nierozstrzygniete[0]).toMatchObject({
      stan: 'odlozone',
      pytanie: quizTekstowy.pytania[0],
    });
    oczekuj(generujEksport(raport, 'txt').tresc).toContain(
      'Niezatwierdzony szkic (nie stanowi specyfikacji)',
    );
  },
);

sprawdz(
  'sprawdza replay i nie eksportuje sesji w trakcie ani uszkodzonej projekcji',
  () => {
    const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja', czas));
    oczekuj(() => utworzRaport(quizTekstowy, poczatek.sesja)).toThrow(
      'zakończenia',
    );
    const koniec = dalej(wybierz(poczatek, odpowiedz()));
    oczekuj(() =>
      utworzRaport(quizTekstowy, { ...koniec.sesja, decyzje: [] }),
    ).toThrow();
  },
);

sprawdz(
  'zachowuje aktualne dodanie, pominięcie i modyfikację oraz usuwa osieroconą decyzję po zmianie reguły',
  () => {
    const pierwsze = quizTekstowy.pytania[0];
    const quiz: Quiz = {
      ...quizTekstowy,
      liczbaPytan: 3,
      pytania: [
        pierwsze,
        { ...pierwsze, id: 'zmieniane', tresc: 'Przed modyfikacją' },
        { ...pierwsze, id: 'pomijane' },
      ],
      pytaniaDodatkowe: [{ ...pierwsze, id: 'dodatkowe' }],
      reguly: [
        {
          id: 'dodaj',
          powod: 'Powód dodania',
          warunek: {
            pytanieId: 'podzial',
            sposobId: 'wybor',
            operator: 'rowne',
            wartosc: 'szczegolowy',
          },
          operacja: {
            rodzaj: 'dodaj',
            pytanieId: 'dodatkowe',
            poPytaniuId: 'podzial',
          },
        },
        {
          id: 'pomin',
          powod: 'Powód pominięcia',
          warunek: {
            pytanieId: 'podzial',
            sposobId: 'wybor',
            operator: 'rowne',
            wartosc: 'szczegolowy',
          },
          operacja: { rodzaj: 'pomin', pytanieId: 'pomijane' },
        },
        {
          id: 'modyfikuj',
          powod: 'Powód modyfikacji',
          warunek: {
            pytanieId: 'podzial',
            sposobId: 'wybor',
            operator: 'rowne',
            wartosc: 'szczegolowy',
          },
          operacja: {
            rodzaj: 'modyfikuj',
            pytanieId: 'zmieniane',
            zmiany: {
              tresc: 'Po modyfikacji',
              wyjasnienie: 'Nowe wyjaśnienie',
            },
          },
        },
      ],
    };
    let stan = wartosc(utworzSesje(quiz, 'sesja', czas));
    stan = dalej(wybierz(stan, odpowiedz('szczegolowy')));
    stan = dalej(wybierz(stan, odpowiedz()));
    stan = dalej(wybierz(stan, odpowiedz()));
    const raport = utworzRaport(quiz, stan.sesja);
    oczekuj(raport.zmianyAdaptacyjne).toHaveLength(3);
    oczekuj(raport.specyfikacja.map((wpis) => wpis.pytanie.tresc)).toContain(
      'Po modyfikacji',
    );
    oczekuj(
      raport.specyfikacja.some((wpis) => wpis.pytanie.id === 'pomijane'),
    ).toBe(false);
    oczekuj(
      sekcjeRaportu(raport).some(
        (sekcja) => sekcja.tytul === 'Zmiana adaptacyjna: pominięcie',
      ),
    ).toBe(true);
    stan = wstecz(wstecz(wstecz(stan)));
    stan = dalej(wybierz(stan, odpowiedz()));
    stan = dalej(stan);
    stan = dalej(wybierz(stan, odpowiedz()));
    const aktualny = utworzRaport(quiz, stan.sesja);
    oczekuj(aktualny.zmianyAdaptacyjne).toEqual([]);
    oczekuj(
      aktualny.specyfikacja.some((wpis) => wpis.pytanie.id === 'dodatkowe'),
    ).toBe(false);
    oczekuj(aktualny.specyfikacja.map((wpis) => wpis.pytanie.tresc)).toContain(
      'Przed modyfikacją',
    );
  },
);

sprawdz(
  'Markdown zabezpiecza treść użytkownika, TXT zachowuje ją dosłownie, brakujących pól nie dopisuje',
  () => {
    const bezRekomendacji: Pytanie = { ...quizTekstowy.pytania[0] };
    delete bezRekomendacji.rekomendacja;
    const quiz: Quiz = {
      ...quizTekstowy,
      tytul: '# [link](https://example.org)',
      pytania: [bezRekomendacji],
    };
    const koniec = dalej(
      wybierz(
        wartosc(utworzSesje(quiz, 'sesja', czas)),
        odpowiedz('szczegolowy'),
      ),
    );
    const raport = utworzRaport(quiz, koniec.sesja);
    oczekuj(generujEksport(raport, 'md').tresc).toContain('\\# \\[link\\]');
    oczekuj(generujEksport(raport, 'txt').tresc).toContain(quiz.tytul);
    oczekuj(raport.specyfikacja[0]?.pytanie.warianty[1]).not.toHaveProperty(
      'konsekwencje',
    );
    oczekuj(generujEksport(raport, 'txt').tresc).not.toContain(
      'Konsekwencje wariantu',
    );
  },
);
