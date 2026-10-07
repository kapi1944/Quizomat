import { readFileSync as przeczytajPlik } from 'node:fs';
import {
  describe as opisz,
  expect as oczekuj,
  it as sprawdz,
  vi as atrapy,
} from 'vitest';
import { walidujImportQuizu } from '../../src/import/walidator';
import { znajdzPowtorzonePola } from '../../src/import/json';
import { schematQuizu } from '../../src/domena/quiz';
import { pytanieKompozycyjne, quizAdaptacyjny } from '../domena/przyklady';

function odczytajPrzyklad(nazwa: string): string {
  return przeczytajPlik(`testy/import/pliki/${nazwa}.json`, 'utf8');
}

function poprawnyQuiz() {
  return schematQuizu.parse(JSON.parse(odczytajPrzyklad('poprawny')));
}

opisz('Standard importu JSON', () => {
  sprawdz(
    'zwraca kandydata i strukturalne podsumowanie bez automatycznego zatwierdzenia',
    () => {
      const wynik = walidujImportQuizu(odczytajPrzyklad('poprawny'));
      oczekuj(wynik.stan).toBe('gotowyDoZatwierdzenia');
      oczekuj(wynik.quiz).toEqual(poprawnyQuiz());
      oczekuj(wynik.raport).toMatchObject({
        schemaVersion: '1.0.0',
        quizId: 'organizacja-pracy',
        nazwaQuizu: 'Wybierz sposób pracy',
        deklarowanePytania: 1,
        faktycznePytania: 1,
        poprawnePytania: 1,
        liczbaPytanDodatkowych: 0,
        poprawnePytaniaDodatkowe: 0,
        bledy: [],
        ostrzezenia: [],
        pytania: [
          {
            pula: 'bazowa',
            indeks: 0,
            id: 'podzial',
            liczbaWariantow: 2,
            poprawne: true,
          },
        ],
      });
      oczekuj(wynik.raport.informacje).toEqual([
        oczekuj.objectContaining({
          poziom: 'informacja',
          kod: 'PODSUMOWANIE_KONTROLI',
        }),
      ]);
    },
  );

  sprawdz.each([
    ['brak-id', 0, ['pytania', 0, 'id']],
    ['duplikat-id', 0, ['pytania', 1, 'id']],
    ['zla-liczba-pytan', 1, ['liczbaPytan']],
    ['bledna-rekomendacja', 0, ['pytania', 0, 'rekomendacja', 'wariantId']],
    ['nieistniejace-odwolanie', 1, ['reguly', 0, 'warunek', 'pytanieId']],
    ['nieprawidlowy-typ-pytania', 0, ['pytania', 0, 'prezentacja', 'rodzaj']],
    ['uszkodzona-skala', 0, ['pytania', 0, 'sposobyOdpowiedzi', 0, 'krok']],
  ] as const)(
    'blokuje fixture %s i wskazuje pole problemu',
    (nazwa, poprawnePytania, sciezka) => {
      const wynik = walidujImportQuizu(odczytajPrzyklad(nazwa));
      oczekuj(wynik.stan).toBe('zablokowany');
      oczekuj(wynik.quiz).toBeNull();
      oczekuj(wynik.raport.poprawnePytania).toBe(poprawnePytania);
      oczekuj(wynik.raport.bledy).toEqual(
        oczekuj.arrayContaining([
          oczekuj.objectContaining({ poziom: 'bladKrytyczny', sciezka }),
        ]),
      );
    },
  );

  sprawdz('nie powiela błędu wykrytego w kilku kontrolach', () => {
    const wynik = walidujImportQuizu(odczytajPrzyklad('zla-liczba-pytan'));
    oczekuj(wynik.raport.bledy).toHaveLength(1);
    oczekuj(wynik.raport.bledy[0]?.kod).toBe('NIEZGODNA_LICZBA_PYTAN');
    oczekuj(wynik.raport.deklarowanePytania).toBe(2);
    oczekuj(wynik.raport.faktycznePytania).toBe(1);
  });

  sprawdz.each([
    '',
    '{',
    '{"id":1,}',
    '# Quiz\n- A\n- B',
    '// komentarz\n{}',
    '```json\n{}\n```',
  ])('odrzuca uszkodzony JSON lub tekst autorski (%#)', (tekst) => {
    const wynik = walidujImportQuizu(tekst);
    oczekuj(wynik.stan).toBe('zablokowany');
    oczekuj(wynik.raport.bledy).toEqual([
      oczekuj.objectContaining({ kod: 'NIEPOPRAWNY_JSON', sciezka: [] }),
    ]);
    oczekuj(wynik.raport.faktycznePytania).toBeNull();
  });
  sprawdz.each(['null', '[]', '42', '"Quiz"'])(
    'odrzuca JSON, który nie jest definicją quizu (%s)',
    (tekst) => {
      const wynik = walidujImportQuizu(tekst);
      oczekuj(wynik.stan).toBe('zablokowany');
      oczekuj(wynik.raport.bledy.length).toBeGreaterThan(0);
      oczekuj(wynik.raport.pytania).toEqual([]);
    },
  );
  sprawdz.each([undefined, '0.1.0', '2.0.0', 1])(
    'nie zgaduje ani nie konwertuje schemaVersion (%#)',
    (schemaVersion) => {
      const wynik = walidujImportQuizu(
        JSON.stringify({ ...poprawnyQuiz(), schemaVersion }),
      );
      oczekuj(wynik.stan).toBe('zablokowany');
      oczekuj(wynik.raport.bledy).toEqual(
        oczekuj.arrayContaining([
          oczekuj.objectContaining({
            kod: 'NIEOBSLUGIWANA_WERSJA',
            sciezka: ['schemaVersion'],
          }),
        ]),
      );
    },
  );
  sprawdz.each([
    { id: undefined },
    { id: 'nie stabilne' },
    { tytul: '' },
    { tytul: '  ' },
    { liczbaPytan: '1' },
    { liczbaPytan: 1.5 },
    { pytania: {} },
  ])('weryfikuje obowiązkowe metadane bez napraw (%#)', (zmiany) => {
    const wynik = walidujImportQuizu(
      JSON.stringify({ ...poprawnyQuiz(), ...zmiany }),
    );
    oczekuj(wynik.stan).toBe('zablokowany');
    oczekuj(wynik.quiz).toBeNull();
  });
  sprawdz(
    'liczy poprawne pytania mimo błędu metadanych i zachowuje null dla złej deklaracji',
    () => {
      const wynik = walidujImportQuizu(
        JSON.stringify({
          ...poprawnyQuiz(),
          schemaVersion: '2.0.0',
          liczbaPytan: '1',
        }),
      );
      oczekuj(wynik.raport.poprawnePytania).toBe(1);
      oczekuj(wynik.raport.faktycznePytania).toBe(1);
      oczekuj(wynik.raport.deklarowanePytania).toBeNull();
      oczekuj(wynik.stan).toBe('zablokowany');
    },
  );
  sprawdz('raportuje kilka niezależnych błędów w jednym przebiegu', () => {
    const quiz = poprawnyQuiz();
    quiz.liczbaPytan = 20;
    quiz.tytul = '';
    quiz.pytania[0]!.id = '';
    quiz.pytania[0]!.rekomendacja!.wariantId = 'nieznany';
    const wynik = walidujImportQuizu(JSON.stringify(quiz));
    oczekuj(wynik.raport.bledy.map((blad) => blad.sciezka)).toEqual(
      oczekuj.arrayContaining([
        ['tytul'],
        ['liczbaPytan'],
        ['pytania', 0, 'id'],
        ['pytania', 0, 'rekomendacja', 'wariantId'],
      ]),
    );
  });
});

opisz('Jawne ostrzeżenia i deterministyczność', () => {
  sprawdz('nieznane pola są zachowane i wymagają potwierdzenia', () => {
    const quiz = {
      ...poprawnyQuiz(),
      rozszerzenie: { notatkaAutora: 'Pozostaje w źródle' },
    };
    quiz.pytania[0]!.warianty[0]!.poleAutora = 'Dodatkowe objaśnienie';
    const wynik = walidujImportQuizu(JSON.stringify(quiz));
    oczekuj(wynik.stan).toBe('wymagaPotwierdzeniaOstrzezen');
    oczekuj(wynik.quiz).toEqual(quiz);
    oczekuj(wynik.daneZrodlowe).toEqual(quiz);
    oczekuj(wynik.raport.ostrzezenia).toEqual([
      oczekuj.objectContaining({
        kod: 'NIEZNANE_POLE',
        sciezka: ['pytania', 0, 'warianty', 0, 'poleAutora'],
      }),
      oczekuj.objectContaining({
        kod: 'NIEZNANE_POLE',
        sciezka: ['rozszerzenie'],
      }),
    ]);
  });
  sprawdz('dla mechaniki sprawdza pola właściwe tej konfiguracji', () => {
    const quiz = poprawnyQuiz();
    quiz.pytania[0]!.sposobyOdpowiedzi[0]!.minimum = 2;
    const wynik = walidujImportQuizu(JSON.stringify(quiz));
    oczekuj(wynik.raport.ostrzezenia).toEqual([
      oczekuj.objectContaining({
        kod: 'NIEZNANE_POLE',
        sciezka: ['pytania', 0, 'sposobyOdpowiedzi', 0, 'minimum'],
      }),
    ]);
  });
  sprawdz('zabronione pola modyfikacji są błędem, a nie ostrzeżeniem', () => {
    const quiz = schematQuizu.parse(quizAdaptacyjny);
    const dane = {
      ...quiz,
      reguly: [
        {
          ...quiz.reguly[0],
          operacja: {
            rodzaj: 'modyfikuj',
            pytanieId: 'nazwy',
            zmiany: { id: 'nowy' },
          },
        },
      ],
    };
    const wynik = walidujImportQuizu(JSON.stringify(dane));
    oczekuj(wynik.stan).toBe('zablokowany');
    oczekuj(wynik.raport.bledy).toEqual(
      oczekuj.arrayContaining([
        oczekuj.objectContaining({
          kod: 'NIEDOZWOLONE_POLE',
          sciezka: ['reguly', 0, 'operacja', 'zmiany', 'id'],
        }),
      ]),
    );
    oczekuj(wynik.raport.ostrzezenia).toEqual([]);
  });
  sprawdz('ostrzega o wariantach bez odnoszącej się do nich mechaniki', () => {
    const quiz = poprawnyQuiz();
    quiz.pytania[0]!.sposobyOdpowiedzi = [
      { id: 'tak', rodzaj: 'takNie', wymagany: true },
    ];
    const wynik = walidujImportQuizu(JSON.stringify(quiz));
    oczekuj(wynik.stan).toBe('wymagaPotwierdzeniaOstrzezen');
    oczekuj(wynik.raport.ostrzezenia[0]?.kod).toBe('NIEWYKORZYSTANE_WARIANTY');
  });
  sprawdz(
    'import pytania wizualnego nie gwarantuje integralności obrazów',
    () => {
      const quiz = { ...poprawnyQuiz(), pytania: [pytanieKompozycyjne] };
      const wynik = walidujImportQuizu(JSON.stringify(quiz));
      oczekuj(wynik.stan).toBe('wymagaPotwierdzeniaOstrzezen');
      oczekuj(wynik.raport.poprawnePytania).toBe(1);
      oczekuj(wynik.raport.ostrzezenia).toHaveLength(2);
      oczekuj(
        wynik.raport.ostrzezenia.every(
          (problem) => problem.kod === 'ZASOB_NIEZDEKODOWANY',
        ),
      ).toBe(true);
    },
  );
  sprawdz('nie pobiera zasobów i ostrzega o niepotwierdzonym offline', () => {
    const pobierz = atrapy.spyOn(globalThis, 'fetch');
    const quiz = poprawnyQuiz();
    quiz.pytania[0]!.prezentacja = {
      rodzaj: 'wizualna',
      obrazy: [
        {
          id: 'podglad',
          opisAlternatywny: 'Podgląd',
          url: 'https://example.invalid/podglad.png',
        },
      ],
    };
    const wynik = walidujImportQuizu(JSON.stringify(quiz));
    oczekuj(wynik.raport.ostrzezenia).toEqual([
      oczekuj.objectContaining({ kod: 'ZASOB_ZDALNY' }),
    ]);
    oczekuj(pobierz).not.toHaveBeenCalled();
    pobierz.mockRestore();
  });
  sprawdz(
    'powtarzalny wynik nie zawiera czasu, losowych ID ani skutków ubocznych',
    () => {
      const tekst = odczytajPrzyklad('uszkodzona-skala');
      oczekuj(walidujImportQuizu(tekst)).toEqual(walidujImportQuizu(tekst));
      const zapis = atrapy.spyOn(Storage.prototype, 'setItem');
      const quiz = poprawnyQuiz();
      const przed = JSON.stringify(quiz);
      walidujImportQuizu(przed);
      oczekuj(JSON.stringify(quiz)).toBe(przed);
      oczekuj(zapis).not.toHaveBeenCalled();
      zapis.mockRestore();
    },
  );
  sprawdz('kolejność pól obiektu nie zmienia raportu', () => {
    const quiz = poprawnyQuiz();
    const pierwszy = { ...quiz, zPole: 'z', aPole: 'a' };
    const drugi = Object.fromEntries(Object.entries(pierwszy).reverse());
    oczekuj(walidujImportQuizu(JSON.stringify(pierwszy)).raport).toEqual(
      walidujImportQuizu(JSON.stringify(drugi)).raport,
    );
  });
  sprawdz('zachowuje treść z odstępami bez normalizacji', () => {
    const quiz = poprawnyQuiz();
    quiz.tytul = '  Tytuł autora  ';
    oczekuj(walidujImportQuizu(JSON.stringify(quiz)).quiz?.tytul).toBe(
      quiz.tytul,
    );
  });
  sprawdz('ostrzega o dodatkowym pytaniu bez reguły dodania', () => {
    const quiz = schematQuizu.parse(quizAdaptacyjny);
    quiz.reguly = [];
    const wynik = walidujImportQuizu(JSON.stringify(quiz));
    oczekuj(wynik.stan).toBe('wymagaPotwierdzeniaOstrzezen');
    oczekuj(wynik.raport.ostrzezenia).toEqual([
      oczekuj.objectContaining({
        kod: 'NIEWYKORZYSTANE_PYTANIE_DODATKOWE',
        sciezka: ['pytaniaDodatkowe', 0],
      }),
    ]);
  });
});

opisz('Kontrola pytań i odwołań', () => {
  sprawdz(
    'duplikat między pulami unieważnia oba pytania, lecz nie zmienia ich liczby',
    () => {
      const quiz = poprawnyQuiz();
      quiz.pytaniaDodatkowe.push(structuredClone(quiz.pytania[0]!));
      const wynik = walidujImportQuizu(JSON.stringify(quiz));
      oczekuj(wynik.raport).toMatchObject({
        faktycznePytania: 1,
        liczbaPytanDodatkowych: 1,
        poprawnePytania: 0,
        poprawnePytaniaDodatkowe: 0,
      });
      oczekuj(wynik.stan).toBe('zablokowany');
    },
  );
  sprawdz('raportuje liczbę wariantów bez limitu trzech', () => {
    const quiz = poprawnyQuiz();
    quiz.pytania[0]!.warianty.push(
      { id: 'trzeci', etykieta: 'Trzeci' },
      { id: 'czwarty', etykieta: 'Czwarty' },
    );
    const wynik = walidujImportQuizu(JSON.stringify(quiz));
    oczekuj(wynik.stan).toBe('gotowyDoZatwierdzenia');
    oczekuj(wynik.raport.pytania[0]?.liczbaWariantow).toBe(4);
  });
  sprawdz.each(['', 'niestabilne id', 'prosty'])(
    'odrzuca brak stabilności lub duplikat ID wariantu (%s)',
    (id) => {
      const quiz = poprawnyQuiz();
      quiz.pytania[0]!.warianty[1]!.id = id;
      oczekuj(walidujImportQuizu(JSON.stringify(quiz)).stan).toBe(
        'zablokowany',
      );
    },
  );
  sprawdz.each([
    {
      id: 'ranking',
      rodzaj: 'ranking',
      wymagany: true,
      minimum: 0,
      maksimum: 2,
    },
    {
      id: 'ranking',
      rodzaj: 'ranking',
      wymagany: true,
      minimum: 2,
      maksimum: 1,
    },
    {
      id: 'ranking',
      rodzaj: 'ranking',
      wymagany: true,
      minimum: 1,
      maksimum: 3,
    },
    {
      id: 'skala',
      rodzaj: 'skala',
      wymagany: true,
      minimum: 0,
      maksimum: 5,
      krok: '1',
      cel: 'pytanie',
    },
    {
      id: 'skala',
      rodzaj: 'skala',
      wymagany: true,
      minimum: 1,
      maksimum: 1,
      krok: 1,
      cel: 'pytanie',
    },
    { id: 'wybor', rodzaj: 'VISUAL', wymagany: true },
  ])('odrzuca złą konfigurację mechaniki (%#)', (mechanika) => {
    const quiz = poprawnyQuiz();
    const dane = {
      ...quiz,
      pytania: [{ ...quiz.pytania[0], sposobyOdpowiedzi: [mechanika] }],
    };
    oczekuj(walidujImportQuizu(JSON.stringify(dane)).stan).toBe('zablokowany');
  });
  sprawdz('odrzuca pytanie wizualne bez zasobów', () => {
    const quiz = poprawnyQuiz();
    quiz.pytania[0]!.prezentacja.rodzaj = 'wizualna';
    oczekuj(
      walidujImportQuizu(JSON.stringify(quiz)).raport.poprawnePytania,
    ).toBe(0);
  });
  sprawdz('przyjmuje poprawną regułę bez wykonania jej operacji', () => {
    const wynik = walidujImportQuizu(JSON.stringify(quizAdaptacyjny));
    oczekuj(wynik.stan).toBe('gotowyDoZatwierdzenia');
    oczekuj(wynik.quiz?.pytania).toHaveLength(1);
    oczekuj(wynik.raport.poprawnePytaniaDodatkowe).toBe(1);
  });
  sprawdz.each(['pytanie', 'mechanika', 'wariant'])(
    'odrzuca nieistniejące odwołanie reguły: %s',
    (rodzaj) => {
      const quiz = schematQuizu.parse(quizAdaptacyjny);
      if (rodzaj === 'pytanie') quiz.reguly[0]!.operacja.pytanieId = 'nieznany';
      else if (rodzaj === 'mechanika')
        quiz.reguly[0]!.warunek.sposobId = 'nieznany';
      else
        quiz.reguly[0]!.warunek = {
          pytanieId: 'podzial',
          sposobId: 'wybor',
          operator: 'rowne',
          wartosc: 'nieznany',
        };
      oczekuj(walidujImportQuizu(JSON.stringify(quiz)).stan).toBe(
        'zablokowany',
      );
    },
  );
});

opisz('Brak cichego nadpisywania pól JSON', () => {
  sprawdz.each([
    ['{"a":1,"a":2}', [['a']]],
    ['{"a":1,"\\u0061":2}', [['a']]],
    ['{"x":[{"a":1,"a":2}]}', [['x', 0, 'a']]],
    ['{"x":{"a":[],"a":{}}}', [['x', 'a']]],
    ['{"a":"tekst z } i \\"a\\":2","b":{"a":1}}', []],
    ['[{"a":1},{"a":2}]', []],
  ] as const)('rozpoznaje powtórzenia w %s', (tekst, sciezki) => {
    JSON.parse(tekst);
    oczekuj(znajdzPowtorzonePola(tekst)).toEqual(sciezki);
  });
  sprawdz(
    'blokuje powtórzone pole quizu zamiast wybierać ostatnią wartość',
    () => {
      const tekst = odczytajPrzyklad('poprawny').replace(
        '"id": "organizacja-pracy"',
        '"id": "pierwszy", "id": "organizacja-pracy"',
      );
      const wynik = walidujImportQuizu(tekst);
      oczekuj(wynik.stan).toBe('zablokowany');
      oczekuj(wynik.quiz).toBeNull();
      oczekuj(wynik.raport.bledy[0]).toMatchObject({
        kod: 'POWTORZONE_POLE_JSON',
        sciezka: ['id'],
      });
    },
  );
  sprawdz('nie oznacza pytania z nadpisanym polem jako poprawne', () => {
    const tekst = odczytajPrzyklad('poprawny').replace(
      '"id": "podzial"',
      '"id": "pierwszy", "id": "podzial"',
    );
    oczekuj(walidujImportQuizu(tekst).raport.poprawnePytania).toBe(0);
  });
});
