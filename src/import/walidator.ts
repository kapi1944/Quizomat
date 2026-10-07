import { z } from 'zod';
import {
  WERSJA_SCHEMATU,
  schematId,
  schematPytania,
  schematQuizu,
} from '../domena/quiz';
import type { Quiz } from '../domena/quiz';
import { znajdzPowtorzonePola } from './json';
import type { SciezkaDanych } from './json';

export interface ProblemImportu {
  poziom: 'bladKrytyczny' | 'ostrzezenie' | 'informacja';
  kod: string;
  sciezka: SciezkaDanych;
  opis: string;
}

export interface PodsumowaniePytania {
  pula: 'bazowa' | 'dodatkowa';
  indeks: number;
  id: string | null;
  liczbaWariantow: number | null;
  poprawne: boolean;
}

export interface RaportImportu {
  schemaVersion: string | null;
  quizId: string | null;
  nazwaQuizu: string | null;
  deklarowanePytania: number | null;
  faktycznePytania: number | null;
  poprawnePytania: number;
  liczbaPytanDodatkowych: number | null;
  poprawnePytaniaDodatkowe: number;
  pytania: PodsumowaniePytania[];
  bledy: ProblemImportu[];
  ostrzezenia: ProblemImportu[];
  informacje: ProblemImportu[];
}

export type WynikImportu =
  | {
      stan: 'zablokowany';
      raport: RaportImportu;
      quiz: null;
      daneZrodlowe: unknown;
    }
  | {
      stan: 'gotowyDoZatwierdzenia' | 'wymagaPotwierdzeniaOstrzezen';
      raport: RaportImportu;
      quiz: Quiz;
      daneZrodlowe: unknown;
    };

function jestObiektem(dane: unknown): dane is Record<string, unknown> {
  return typeof dane === 'object' && dane !== null && !Array.isArray(dane);
}

function jakoTekst(dane: unknown): string | null {
  return typeof dane === 'string' ? dane : null;
}

function przetlumaczProblem(
  problem: z.core.$ZodIssue,
  przedrostek: SciezkaDanych,
): ProblemImportu[] {
  const sciezka = [
    ...przedrostek,
    ...problem.path.filter(
      (pole): pole is string | number => typeof pole !== 'symbol',
    ),
  ];
  let kod = `SCHEMAT_${problem.code.toUpperCase()}`;
  let opis = 'Dane nie odpowiadają wymaganej strukturze quizu.';
  if (problem.code === 'custom') {
    kod =
      typeof problem.params?.kod === 'string'
        ? problem.params.kod
        : 'NIEZGODNOSC_DOMENOWA';
    opis = problem.message;
    if (kod === 'POWTORZONE_ID' && typeof sciezka.at(-1) === 'number')
      sciezka.push('id');
  } else if (problem.code === 'invalid_type') {
    kod = 'NIEPRAWIDLOWY_TYP';
    opis =
      'Brakuje wymaganej wartości lub ma ona nieprawidłowy typ. Typy nie są konwertowane.';
  } else if (problem.code === 'invalid_value') {
    opis = 'Wartość nie należy do wariantów dopuszczonych przez standard.';
  } else if (problem.code === 'invalid_format') {
    opis = 'Wartość ma nieprawidłowy format.';
  } else if (problem.code === 'too_small' || problem.code === 'too_big') {
    opis = 'Wartość lub liczba elementów wykracza poza dozwolony zakres.';
  } else if (problem.code === 'unrecognized_keys') {
    return problem.keys.map((klucz) => ({
      poziom: 'bladKrytyczny',
      kod: 'NIEDOZWOLONE_POLE',
      sciezka: [...sciezka, klucz],
      opis: 'To pole nie jest dozwolone w tej części standardu.',
    }));
  } else if (problem.code === 'invalid_union') {
    opis = 'Dane nie pasują do żadnej dopuszczonej konfiguracji.';
  }
  if (sciezka.length === 1 && sciezka[0] === 'schemaVersion') {
    kod = 'NIEOBSLUGIWANA_WERSJA';
    opis = `Wymagane jest schemaVersion ${WERSJA_SCHEMATU}. Nie wykonano migracji ani zgadywania wersji.`;
  }
  if (kod === 'NIEZGODNA_LICZBA_PYTAN')
    opis = 'Deklarowana liczba pytań różni się od faktycznej.';
  return [{ poziom: 'bladKrytyczny', kod, sciezka, opis }];
}

function znajdzNieznanePola(
  schemat: z.core.$ZodType,
  dane: unknown,
  sciezka: SciezkaDanych,
  ostrzezenia: ProblemImportu[],
) {
  if (schemat instanceof z.ZodOptional) {
    if (dane !== undefined)
      znajdzNieznanePola(schemat.unwrap(), dane, sciezka, ostrzezenia);
  } else if (schemat instanceof z.ZodArray && Array.isArray(dane)) {
    dane.forEach((element, indeks) =>
      znajdzNieznanePola(
        schemat.element,
        element,
        [...sciezka, indeks],
        ostrzezenia,
      ),
    );
  } else if (
    (schemat instanceof z.ZodUnion ||
      schemat instanceof z.ZodDiscriminatedUnion) &&
    jestObiektem(dane)
  ) {
    const opcje = schemat.options.filter((opcja) => {
      if (!(opcja instanceof z.ZodObject)) return false;
      return Object.entries(opcja.shape).every(
        ([pole, definicja]) =>
          !(definicja instanceof z.ZodLiteral) ||
          definicja.safeParse(dane[pole]).success,
      );
    });
    for (const opcja of opcje.length ? opcje : schemat.options)
      znajdzNieznanePola(opcja, dane, sciezka, ostrzezenia);
  } else if (schemat instanceof z.ZodObject && jestObiektem(dane)) {
    for (const pole of Object.keys(dane).sort()) {
      if (!Object.hasOwn(schemat.shape, pole))
        ostrzezenia.push({
          poziom: 'ostrzezenie',
          kod: 'NIEZNANE_POLE',
          sciezka: [...sciezka, pole],
          opis: 'Nieznane pole zostaje zachowane w źródle, ale aplikacja nie obsługuje jego znaczenia.',
        });
      else
        znajdzNieznanePola(
          schemat.shape[pole],
          dane[pole],
          [...sciezka, pole],
          ostrzezenia,
        );
    }
  }
}

function uporzadkujProblemy(problemy: ProblemImportu[]): ProblemImportu[] {
  const unikalne = new Map<string, ProblemImportu>();
  for (const problem of problemy)
    unikalne.set(JSON.stringify([problem.sciezka, problem.kod]), problem);
  return [...unikalne.entries()]
    .sort(([pierwszy], [drugi]) =>
      pierwszy < drugi ? -1 : pierwszy > drugi ? 1 : 0,
    )
    .map(([, problem]) => problem);
}

export function walidujImportQuizu(tekst: string): WynikImportu {
  const raport: RaportImportu = {
    schemaVersion: null,
    quizId: null,
    nazwaQuizu: null,
    deklarowanePytania: null,
    faktycznePytania: null,
    poprawnePytania: 0,
    liczbaPytanDodatkowych: null,
    poprawnePytaniaDodatkowe: 0,
    pytania: [],
    bledy: [],
    ostrzezenia: [],
    informacje: [],
  };
  let dane: unknown;
  try {
    dane = JSON.parse(tekst);
  } catch {
    raport.bledy.push({
      poziom: 'bladKrytyczny',
      kod: 'NIEPOPRAWNY_JSON',
      sciezka: [],
      opis: 'Plik nie zawiera poprawnego JSON. Nie wykonano naprawy ani interpretacji Markdown.',
    });
    return { stan: 'zablokowany', raport, quiz: null, daneZrodlowe: null };
  }
  for (const sciezka of znajdzPowtorzonePola(tekst))
    raport.bledy.push({
      poziom: 'bladKrytyczny',
      kod: 'POWTORZONE_POLE_JSON',
      sciezka,
      opis: 'Pole JSON występuje więcej niż raz. Nie można przyjąć cichego nadpisania wartości.',
    });
  const wynik = schematQuizu.safeParse(dane);
  if (!wynik.success)
    raport.bledy.push(
      ...wynik.error.issues.flatMap((problem) =>
        przetlumaczProblem(problem, []),
      ),
    );
  znajdzNieznanePola(schematQuizu, dane, [], raport.ostrzezenia);

  if (jestObiektem(dane)) {
    raport.schemaVersion = jakoTekst(dane.schemaVersion);
    raport.quizId = jakoTekst(dane.id);
    raport.nazwaQuizu = jakoTekst(dane.tytul);
    raport.deklarowanePytania =
      typeof dane.liczbaPytan === 'number' &&
      Number.isSafeInteger(dane.liczbaPytan) &&
      dane.liczbaPytan > 0
        ? dane.liczbaPytan
        : null;
    raport.faktycznePytania = Array.isArray(dane.pytania)
      ? dane.pytania.length
      : null;
    raport.liczbaPytanDodatkowych = Array.isArray(dane.pytaniaDodatkowe)
      ? dane.pytaniaDodatkowe.length
      : null;
    if (
      raport.deklarowanePytania !== null &&
      raport.faktycznePytania !== null &&
      raport.deklarowanePytania !== raport.faktycznePytania
    )
      raport.bledy.push({
        poziom: 'bladKrytyczny',
        kod: 'NIEZGODNA_LICZBA_PYTAN',
        sciezka: ['liczbaPytan'],
        opis: 'Deklarowana liczba pytań różni się od faktycznej.',
      });
    const napotkaneId = new Map<string, SciezkaDanych[]>();
    for (const [pole, pula] of [
      ['pytania', 'bazowa'],
      ['pytaniaDodatkowe', 'dodatkowa'],
    ] as const) {
      const pytania = dane[pole];
      if (!Array.isArray(pytania)) continue;
      pytania.forEach((pytanie: unknown, indeks) => {
        const kontrola = schematPytania.safeParse(pytanie);
        if (!kontrola.success)
          raport.bledy.push(
            ...kontrola.error.issues.flatMap((problem) =>
              przetlumaczProblem(problem, [pole, indeks]),
            ),
          );
        const identyfikator = jestObiektem(pytanie)
          ? jakoTekst(pytanie.id)
          : null;
        const sciezka = [pole, indeks, 'id'];
        if (
          identyfikator !== null &&
          schematId.safeParse(identyfikator).success
        )
          napotkaneId.set(identyfikator, [
            ...(napotkaneId.get(identyfikator) ?? []),
            sciezka,
          ]);
        raport.pytania.push({
          pula,
          indeks,
          id: identyfikator,
          liczbaWariantow:
            jestObiektem(pytanie) && Array.isArray(pytanie.warianty)
              ? pytanie.warianty.length
              : null,
          poprawne: kontrola.success,
        });
        if (kontrola.success) {
          const definicja = kontrola.data;
          if (
            definicja.warianty.length &&
            !definicja.sposobyOdpowiedzi.some(
              (mechanika) =>
                [
                  'pojedynczyWybor',
                  'wielokrotnyWybor',
                  'ranking',
                  'kombinacjaWariantow',
                ].includes(mechanika.rodzaj) ||
                (mechanika.rodzaj === 'skala' && mechanika.cel === 'warianty'),
            )
          )
            raport.ostrzezenia.push({
              poziom: 'ostrzezenie',
              kod: 'NIEWYKORZYSTANE_WARIANTY',
              sciezka: [pole, indeks, 'warianty'],
              opis: 'Pytanie zawiera warianty, ale żadna mechanika nie pozwala się do nich odnieść.',
            });
          const obrazy = [
            ...(definicja.prezentacja.obrazy ?? []).map(
              (obraz, indeksObrazu) => ({
                obraz,
                sciezka: [pole, indeks, 'prezentacja', 'obrazy', indeksObrazu],
              }),
            ),
            ...definicja.warianty.flatMap((wariant, indeksWariantu) =>
              (wariant.obrazy ?? []).map((obraz, indeksObrazu) => ({
                obraz,
                sciezka: [
                  pole,
                  indeks,
                  'warianty',
                  indeksWariantu,
                  'obrazy',
                  indeksObrazu,
                ],
              })),
            ),
          ];
          for (const { obraz, sciezka: sciezkaObrazu } of obrazy)
            raport.ostrzezenia.push({
              poziom: 'ostrzezenie',
              kod:
                typeof obraz.url === 'string'
                  ? 'ZASOB_ZDALNY'
                  : 'ZASOB_NIEZDEKODOWANY',
              sciezka: sciezkaObrazu,
              opis:
                typeof obraz.url === 'string'
                  ? 'Nie sprawdzono dostępności URL ani nie pobrano obrazu. Nie potwierdzono gotowości offline.'
                  : 'Sprawdzono deklarację MIME i składnię base64. Nie zdekodowano obrazu ani nie potwierdzono jego integralności.',
            });
        }
      });
    }
    for (const [identyfikator, sciezki] of napotkaneId) {
      if (sciezki.length < 2) continue;
      for (const sciezka of sciezki.slice(1))
        raport.bledy.push({
          poziom: 'bladKrytyczny',
          kod: 'POWTORZONE_ID',
          sciezka,
          opis: `Powtórzone ID: ${identyfikator}.`,
        });
      raport.pytania.forEach((pytanie) => {
        if (pytanie.id === identyfikator) pytanie.poprawne = false;
      });
    }
  }
  if (wynik.success) {
    const dodawaneId = new Set(
      wynik.data.reguly
        .filter((regula) => regula.operacja.rodzaj === 'dodaj')
        .map((regula) => regula.operacja.pytanieId),
    );
    wynik.data.pytaniaDodatkowe.forEach((pytanie, indeks) => {
      if (!dodawaneId.has(pytanie.id))
        raport.ostrzezenia.push({
          poziom: 'ostrzezenie',
          kod: 'NIEWYKORZYSTANE_PYTANIE_DODATKOWE',
          sciezka: ['pytaniaDodatkowe', indeks],
          opis: 'Żadna reguła nie dodaje tego pytania do ścieżki. Pytanie pozostaje w źródle.',
        });
    });
  }
  raport.pytania.forEach((pytanie) => {
    const pole = pytanie.pula === 'bazowa' ? 'pytania' : 'pytaniaDodatkowe';
    if (
      raport.bledy.some(
        (blad) =>
          blad.kod === 'POWTORZONE_POLE_JSON' &&
          blad.sciezka[0] === pole &&
          blad.sciezka[1] === pytanie.indeks,
      )
    )
      pytanie.poprawne = false;
  });
  raport.poprawnePytania = raport.pytania.filter(
    (pytanie) => pytanie.pula === 'bazowa' && pytanie.poprawne,
  ).length;
  raport.poprawnePytaniaDodatkowe = raport.pytania.filter(
    (pytanie) => pytanie.pula === 'dodatkowa' && pytanie.poprawne,
  ).length;
  raport.bledy = uporzadkujProblemy(raport.bledy);
  raport.ostrzezenia = uporzadkujProblemy(raport.ostrzezenia).filter(
    (ostrzezenie) =>
      !raport.bledy.some(
        (blad) =>
          blad.kod === 'NIEDOZWOLONE_POLE' &&
          JSON.stringify(blad.sciezka) === JSON.stringify(ostrzezenie.sciezka),
      ),
  );
  raport.informacje.push({
    poziom: 'informacja',
    kod: 'PODSUMOWANIE_KONTROLI',
    sciezka: [],
    opis: 'Raport dotyczy definicji quizu. Nie zapisano danych, nie wykonano reguł i nie rozpoczęto sesji.',
  });
  if (!wynik.success)
    raport.informacje.push({
      poziom: 'informacja',
      kod: 'DEFINICJA_NIEPOTWIERDZONA',
      sciezka: [],
      opis: 'Przy błędach strukturalnych nie można potwierdzić wszystkich relacji definicji. Popraw błędy i powtórz walidację.',
    });
  if (!wynik.success || raport.bledy.length)
    return { stan: 'zablokowany', raport, quiz: null, daneZrodlowe: dane };
  return {
    stan: raport.ostrzezenia.length
      ? 'wymagaPotwierdzeniaOstrzezen'
      : 'gotowyDoZatwierdzenia',
    raport,
    quiz: wynik.data,
    daneZrodlowe: dane,
  };
}
