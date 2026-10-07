import { describe as opisz, expect as oczekuj, it as sprawdz } from 'vitest';
import { readFileSync as przeczytajPlik } from 'node:fs';
import {
  schematMechanikiOdpowiedzi,
  schematObrazu,
  schematPytania,
  schematQuizu,
  schematRegulyAdaptacyjnej,
} from '../../src/domena/quiz';
import type { Quiz } from '../../src/domena/quiz';
import {
  pytanieDodatkowe,
  pytanieKompozycyjne,
  pytanieWizualne,
  quizAdaptacyjny,
  quizTekstowy,
} from './przyklady';

opisz('Definicja quizu 1.0.0', () => {
  sprawdz('przykłady JSON w dokumentacji są zgodne ze schematami', async () => {
    const dokument = przeczytajPlik('docs/FORMAT_QUIZU.md', 'utf8');
    const przyklady = [...dokument.matchAll(/```json\s*([\s\S]*?)```/g)].map(
      (dopasowanie) => JSON.parse(dopasowanie[1]!),
    );
    oczekuj(przyklady).toHaveLength(2);
    oczekuj(schematQuizu.safeParse(przyklady[0]).success).toBe(true);
    const { schematOdpowiedzi } = await import('../../src/domena/sesja');
    oczekuj(schematOdpowiedzi.safeParse(przyklady[1]).success).toBe(true);
  });
  sprawdz.each([quizTekstowy, quizAdaptacyjny])(
    'przyjmuje poprawny neutralny quiz $id',
    (quiz) => {
      oczekuj(schematQuizu.parse(quiz)).toEqual(quiz);
    },
  );

  sprawdz.each([pytanieWizualne, pytanieKompozycyjne])(
    'przyjmuje prezentację wizualną niezależnie od mechanik',
    (pytanie) => {
      oczekuj(schematPytania.parse(pytanie)).toEqual(pytanie);
    },
  );

  sprawdz('nie ogranicza liczby wariantów do trzech', () => {
    const quiz = schematQuizu.parse(quizTekstowy);
    quiz.pytania[0]!.warianty.push(
      { id: 'trzeci', etykieta: 'Trzeci' },
      { id: 'czwarty', etykieta: 'Czwarty' },
    );
    oczekuj(schematQuizu.safeParse(quiz).success).toBe(true);
  });

  sprawdz('zachowuje nieznane pola źródła zamiast je usuwać', () => {
    const quiz = {
      ...quizTekstowy,
      rozszerzenieAutora: { informacja: 'Do raportu importu' },
    };
    oczekuj(schematQuizu.parse(quiz)).toEqual(quiz);
    const pytanie = { ...pytanieWizualne, rozszerzenie: ['Dodatkowy opis'] };
    oczekuj(schematPytania.parse(pytanie)).toEqual(pytanie);
  });

  sprawdz.each([
    null,
    [],
    'quiz',
    42,
    {},
    { ...quizTekstowy, schemaVersion: '2.0.0' },
    { ...quizTekstowy, schemaVersion: undefined },
    { ...quizTekstowy, id: '' },
    { ...quizTekstowy, id: 'id ze spacją' },
    { ...quizTekstowy, wersjaQuizu: 'nowa' },
    { ...quizTekstowy, liczbaPytan: '1' },
    { ...quizTekstowy, liczbaPytan: 1.5 },
    { ...quizTekstowy, liczbaPytan: 2 },
    { ...quizTekstowy, tytul: '  ' },
    { ...quizTekstowy, pytania: [] },
    { ...quizTekstowy, pytaniaDodatkowe: undefined },
    { ...quizTekstowy, reguly: undefined },
  ])('odrzuca błędną strukturę bez konwersji typów (%#)', (dane) => {
    oczekuj(schematQuizu.safeParse(dane).success).toBe(false);
  });

  const bledyPytania: [string, (quiz: Quiz) => void][] = [
    [
      'brak stabilnego ID',
      (quiz) => {
        quiz.pytania[0]!.id = '';
      },
    ],
    [
      'powtórzone ID pytań',
      (quiz) => {
        quiz.pytania.push(structuredClone(quiz.pytania[0]!));
        quiz.liczbaPytan = 2;
      },
    ],
    [
      'ID powtórzone między pulami',
      (quiz) => {
        quiz.pytaniaDodatkowe.push(structuredClone(quiz.pytania[0]!));
      },
    ],
    [
      'powtórzone ID wariantów',
      (quiz) => {
        quiz.pytania[0]!.warianty[1]!.id = 'prosty';
      },
    ],
    [
      'powtórzone ID mechanik',
      (quiz) => {
        quiz.pytania[0]!.sposobyOdpowiedzi.push({
          id: 'wybor',
          rodzaj: 'takNie',
          wymagany: false,
        });
      },
    ],
    [
      'nieistniejąca rekomendacja',
      (quiz) => {
        quiz.pytania[0]!.rekomendacja!.wariantId = 'nieznany';
      },
    ],
    [
      'puste uzasadnienie rekomendacji',
      (quiz) => {
        quiz.pytania[0]!.rekomendacja!.uzasadnienie = ' ';
      },
    ],
    [
      'pusta lista mechanik',
      (quiz) => {
        quiz.pytania[0]!.sposobyOdpowiedzi = [];
      },
    ],
    [
      'pojedynczy wybór bez dwóch wariantów',
      (quiz) => {
        quiz.pytania[0]!.warianty.pop();
      },
    ],
    [
      'wizualna bez obrazu',
      (quiz) => {
        quiz.pytania[0]!.prezentacja.rodzaj = 'wizualna';
      },
    ],
    [
      'mieszana bez obrazu',
      (quiz) => {
        quiz.pytania[0]!.prezentacja.rodzaj = 'mieszana';
      },
    ],
    [
      'wybór większy niż pula',
      (quiz) => {
        quiz.pytania[0]!.sposobyOdpowiedzi = [
          {
            id: 'wiele',
            rodzaj: 'wielokrotnyWybor',
            wymagany: true,
            minimum: 1,
            maksimum: 3,
          },
        ];
      },
    ],
    [
      'ranking większy niż pula',
      (quiz) => {
        quiz.pytania[0]!.sposobyOdpowiedzi = [
          {
            id: 'ranking',
            rodzaj: 'ranking',
            wymagany: true,
            minimum: 1,
            maksimum: 3,
          },
        ];
      },
    ],
    [
      'ocena wariantów bez wariantów',
      (quiz) => {
        quiz.pytania[0]!.warianty = [];
        delete quiz.pytania[0]!.rekomendacja;
        quiz.pytania[0]!.sposobyOdpowiedzi = [
          {
            id: 'ocena',
            rodzaj: 'skala',
            wymagany: true,
            minimum: 0,
            maksimum: 10,
            krok: 1,
            cel: 'warianty',
          },
        ];
      },
    ],
    [
      'kombinacja bez dwóch wariantów',
      (quiz) => {
        quiz.pytania[0]!.warianty.pop();
        quiz.pytania[0]!.sposobyOdpowiedzi = [
          {
            id: 'kombinacja',
            rodzaj: 'kombinacjaWariantow',
            wymagany: true,
            minimumElementow: 1,
          },
        ];
      },
    ],
  ];
  sprawdz.each(bledyPytania)('odrzuca błąd semantyczny: %s', (_, zmien) => {
    const quiz = schematQuizu.parse(quizTekstowy);
    zmien(quiz);
    oczekuj(schematQuizu.safeParse(quiz).success).toBe(false);
  });

  sprawdz('podaje ścieżkę problemu liczby pytań i nie zmienia źródła', () => {
    const quiz = { ...quizTekstowy, liczbaPytan: 9 };
    const wynik = schematQuizu.safeParse(quiz);
    oczekuj(wynik.success).toBe(false);
    if (!wynik.success)
      oczekuj(wynik.error.issues).toEqual(
        oczekuj.arrayContaining([
          oczekuj.objectContaining({ path: ['liczbaPytan'] }),
        ]),
      );
    oczekuj(quiz.liczbaPytan).toBe(9);
  });
});

opisz('Mechaniki i zasoby', () => {
  const podstawa = { id: 'odpowiedz', wymagany: true };
  sprawdz.each([
    { rodzaj: 'pojedynczyWybor' },
    { rodzaj: 'wielokrotnyWybor', minimum: 0, maksimum: 5 },
    { rodzaj: 'takNie' },
    { rodzaj: 'prawdaFalsz' },
    { rodzaj: 'otwarta', maksymalnaDlugosc: 1000 },
    { rodzaj: 'skala', minimum: -1, maksimum: 1, krok: 0.25, cel: 'pytanie' },
    { rodzaj: 'ranking', minimum: 1, maksimum: 4 },
    { rodzaj: 'kombinacjaWariantow', minimumElementow: 1 },
  ])('obsługuje $rodzaj', (mechanika) => {
    const pytanie = {
      ...quizTekstowy.pytania[0],
      warianty: Array.from({ length: 5 }, (_, indeks) => ({
        id: `wariant-${indeks}`,
        etykieta: `Wariant ${indeks}`,
      })),
      rekomendacja: undefined,
      sposobyOdpowiedzi: [{ ...podstawa, ...mechanika }],
    };
    oczekuj(schematPytania.safeParse(pytanie).success).toBe(true);
  });
  sprawdz.each([
    { rodzaj: 'TEXT' },
    { rodzaj: 'VISUAL' },
    { rodzaj: 'MULTISELECT' },
    { rodzaj: 'wielokrotnyWybor', minimum: 3, maksimum: 2 },
    { rodzaj: 'ranking', minimum: 0, maksimum: 2 },
    { rodzaj: 'skala', minimum: 2, maksimum: 2, krok: 1, cel: 'pytanie' },
    { rodzaj: 'skala', minimum: 0, maksimum: 1, krok: 0, cel: 'pytanie' },
    {
      rodzaj: 'skala',
      minimum: 0,
      maksimum: Infinity,
      krok: 1,
      cel: 'pytanie',
    },
    { rodzaj: 'otwarta', maksymalnaDlugosc: 0 },
  ])('odrzuca błędną mechanikę (%#)', (mechanika) =>
    oczekuj(
      schematMechanikiOdpowiedzi.safeParse({ ...podstawa, ...mechanika })
        .success,
    ).toBe(false),
  );

  sprawdz('przyjmuje obraz HTTPS oraz lokalny obraz z fixture', () => {
    oczekuj(
      schematObrazu.safeParse({
        id: 'obraz',
        opisAlternatywny: 'Podgląd',
        url: 'https://example.invalid/obraz.png',
      }).success,
    ).toBe(true);
    oczekuj(schematPytania.safeParse(pytanieWizualne).success).toBe(true);
  });
  sprawdz.each([
    { url: 'http://example.invalid/a.png' },
    { url: 'javascript:alert(1)' },
    { url: 'C:\\obrazy\\a.png' },
    { dane: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { dane: 'data:image/png;base64,' },
    { dane: 'data:image/png;base64,@@@' },
    {
      url: 'https://example.invalid/a.png',
      dane: 'data:image/png;base64,YQ==',
    },
  ])('odrzuca niepoprawne źródło obrazu (%#)', (zrodlo) =>
    oczekuj(
      schematObrazu.safeParse({
        id: 'obraz',
        opisAlternatywny: 'Podgląd',
        ...zrodlo,
      }).success,
    ).toBe(false),
  );
  sprawdz('odrzuca pusty opis i powtórzone ID obrazów', () => {
    oczekuj(
      schematObrazu.safeParse({
        id: 'obraz',
        opisAlternatywny: ' ',
        url: 'https://example.invalid/a.png',
      }).success,
    ).toBe(false);
    const pytanie = structuredClone(pytanieWizualne);
    pytanie.warianty[1]!.obrazy[0]!.id = 'szkic-a';
    oczekuj(schematPytania.safeParse(pytanie).success).toBe(false);
  });
  sprawdz('nie ogranicza booleanu i tekstu do wariantów', () => {
    for (const rodzaj of ['takNie', 'prawdaFalsz', 'otwarta'] as const)
      oczekuj(
        schematPytania.safeParse({
          ...pytanieDodatkowe,
          sposobyOdpowiedzi: [{ ...podstawa, rodzaj, maksymalnaDlugosc: 100 }],
        }).success,
      ).toBe(true);
  });
});

opisz('Deklaratywne reguły adaptacji', () => {
  const bledyRegul: [string, (quiz: Quiz) => void][] = [
    [
      'nieznane źródło',
      (quiz) => {
        quiz.reguly[0]!.warunek.pytanieId = 'brak';
      },
    ],
    [
      'nieznany cel',
      (quiz) => {
        quiz.reguly[0]!.operacja.pytanieId = 'brak';
      },
    ],
    [
      'nieznana mechanika',
      (quiz) => {
        quiz.reguly[0]!.warunek.sposobId = 'brak';
      },
    ],
    [
      'niewłaściwy wariant warunku',
      (quiz) => {
        quiz.reguly[0]!.warunek = {
          pytanieId: 'podzial',
          sposobId: 'wybor',
          operator: 'rowne',
          wartosc: 'brak',
        };
      },
    ],
    [
      'niewłaściwy operator',
      (quiz) => {
        quiz.reguly[0]!.warunek = {
          pytanieId: 'podzial',
          sposobId: 'wybor',
          operator: 'coNajmniej',
          wartosc: 2,
        };
      },
    ],
    [
      'niewłaściwy typ wartości',
      (quiz) => {
        quiz.reguly[0]!.warunek = {
          pytanieId: 'podzial',
          sposobId: 'wybor',
          operator: 'rowne',
          wartosc: true,
        };
      },
    ],
    [
      'dodanie bazowego pytania',
      (quiz) => {
        quiz.reguly[0]!.operacja = {
          rodzaj: 'dodaj',
          pytanieId: 'podzial',
          poPytaniuId: 'podzial',
        };
      },
    ],
    [
      'nieznane miejsce dodania',
      (quiz) => {
        quiz.reguly[0]!.operacja = {
          rodzaj: 'dodaj',
          pytanieId: 'nazwy',
          poPytaniuId: 'brak',
        };
      },
    ],
    [
      'cykl dodawania',
      (quiz) => {
        quiz.reguly[0]!.operacja = {
          rodzaj: 'dodaj',
          pytanieId: 'nazwy',
          poPytaniuId: 'nazwy',
        };
      },
    ],
    [
      'powtórzone ID reguł',
      (quiz) => {
        quiz.reguly.push(structuredClone(quiz.reguly[0]!));
      },
    ],
    [
      'sprzeczne operacje na celu',
      (quiz) => {
        quiz.reguly.push({
          ...quiz.reguly[0]!,
          id: 'druga',
          operacja: { rodzaj: 'pomin', pytanieId: 'nazwy' },
        });
      },
    ],
  ];
  sprawdz.each(bledyRegul)('odrzuca: %s', (_, zmien) => {
    const quiz = schematQuizu.parse(quizAdaptacyjny);
    zmien(quiz);
    oczekuj(schematQuizu.safeParse(quiz).success).toBe(false);
  });
  sprawdz.each(['pomin', 'modyfikuj'] as const)(
    'przyjmuje operację %s na późniejszym pytaniu',
    (rodzaj) => {
      const quiz = schematQuizu.parse(quizAdaptacyjny);
      quiz.pytania.push(pytanieDodatkowe);
      quiz.liczbaPytan = 2;
      quiz.pytaniaDodatkowe = [];
      quiz.reguly[0]!.operacja =
        rodzaj === 'pomin'
          ? { rodzaj, pytanieId: 'nazwy' }
          : { rodzaj, pytanieId: 'nazwy', zmiany: { tresc: 'Podaj nazwy.' } };
      oczekuj(schematQuizu.safeParse(quiz).success).toBe(true);
    },
  );
  sprawdz(
    'odrzuca zależność wcześniejszego pytania od późniejszej odpowiedzi',
    () => {
      const quiz = schematQuizu.parse(quizAdaptacyjny);
      quiz.pytania.push(pytanieDodatkowe);
      quiz.liczbaPytan = 2;
      quiz.pytaniaDodatkowe = [];
      quiz.reguly[0]!.warunek = {
        pytanieId: 'nazwy',
        sposobId: 'tekst',
        operator: 'rowne',
        wartosc: 'Kategorie',
      };
      quiz.reguly[0]!.operacja = { rodzaj: 'pomin', pytanieId: 'podzial' };
      oczekuj(schematQuizu.safeParse(quiz).success).toBe(false);
    },
  );
  sprawdz('odrzuca pustą modyfikację i wykonywalne operacje', () => {
    const regula = quizAdaptacyjny.reguly[0];
    for (const operacja of [
      { rodzaj: 'modyfikuj', pytanieId: 'nazwy', zmiany: {} },
      { rodzaj: 'modyfikuj', pytanieId: 'nazwy', zmiany: { id: 'inne-id' } },
      { rodzaj: 'uruchomKod', kod: 'alert(1)' },
    ])
      oczekuj(
        schematRegulyAdaptacyjnej.safeParse({ ...regula, operacja }).success,
      ).toBe(false);
  });
  sprawdz.each(['wielokrotnyWybor', 'ranking', 'kombinacjaWariantow'] as const)(
    'sprawdza zawieraWariant dla %s',
    (rodzaj) => {
      const quiz = schematQuizu.parse(quizAdaptacyjny);
      quiz.pytania[0]!.sposobyOdpowiedzi =
        rodzaj === 'kombinacjaWariantow'
          ? [{ id: 'wybor', rodzaj, wymagany: true, minimumElementow: 1 }]
          : [{ id: 'wybor', rodzaj, wymagany: true, minimum: 1, maksimum: 2 }];
      quiz.reguly[0]!.warunek = {
        pytanieId: 'podzial',
        sposobId: 'wybor',
        operator: 'zawieraWariant',
        wartosc: 'szczegolowy',
      };
      oczekuj(schematQuizu.safeParse(quiz).success).toBe(true);
      quiz.reguly[0]!.warunek.wartosc = 'nieznany';
      oczekuj(schematQuizu.safeParse(quiz).success).toBe(false);
    },
  );
  sprawdz.each(['takNie', 'prawdaFalsz', 'otwarta', 'skala'] as const)(
    'sprawdza wartość warunku dla %s',
    (rodzaj) => {
      const quiz = schematQuizu.parse(quizAdaptacyjny);
      quiz.pytania[0]!.sposobyOdpowiedzi =
        rodzaj === 'skala'
          ? [
              {
                id: 'wybor',
                rodzaj,
                wymagany: true,
                minimum: 0,
                maksimum: 5,
                krok: 1,
                cel: 'pytanie',
              },
            ]
          : rodzaj === 'otwarta'
            ? [{ id: 'wybor', rodzaj, wymagany: true, maksymalnaDlugosc: 1000 }]
            : [{ id: 'wybor', rodzaj, wymagany: true }];
      quiz.reguly[0]!.warunek =
        rodzaj === 'skala'
          ? {
              pytanieId: 'podzial',
              sposobId: 'wybor',
              operator: 'coNajmniej',
              wartosc: 3,
            }
          : {
              pytanieId: 'podzial',
              sposobId: 'wybor',
              operator: 'rowne',
              wartosc: rodzaj === 'otwarta' ? 'Kategorie' : true,
            };
      oczekuj(schematQuizu.safeParse(quiz).success).toBe(true);
    },
  );
  sprawdz('odrzuca operację na niewprowadzonym pytaniu dodatkowym', () => {
    const quiz = schematQuizu.parse(quizAdaptacyjny);
    quiz.reguly[0]!.operacja = { rodzaj: 'pomin', pytanieId: 'nazwy' };
    oczekuj(schematQuizu.safeParse(quiz).success).toBe(false);
  });
  sprawdz('odrzuca nieznaną rekomendację w modyfikacji', () => {
    const quiz = schematQuizu.parse(quizAdaptacyjny);
    quiz.pytania.push({ ...quiz.pytania[0]!, id: 'drugie' });
    quiz.liczbaPytan = 2;
    quiz.reguly[0]!.operacja = {
      rodzaj: 'modyfikuj',
      pytanieId: 'drugie',
      zmiany: {
        rekomendacja: { wariantId: 'brak', uzasadnienie: 'Nowy powód' },
      },
    };
    oczekuj(schematQuizu.safeParse(quiz).success).toBe(false);
  });
  sprawdz('przyjmuje analizę autorską i wymaga jej interpretacji', () => {
    const pytanie = {
      ...quizTekstowy.pytania[0],
      innaOdpowiedz: {
        etykieta: 'Inne',
        analiza: {
          tryb: 'autorska',
          interpretacja: 'Połączenie kierunków.',
          potencjalneSkutki: ['Weryfikacja spójności.'],
        },
      },
    };
    oczekuj(schematPytania.safeParse(pytanie).success).toBe(true);
    oczekuj(
      schematPytania.safeParse({
        ...pytanie,
        innaOdpowiedz: { etykieta: 'Inne', analiza: { tryb: 'autorska' } },
      }).success,
    ).toBe(false);
  });
});
