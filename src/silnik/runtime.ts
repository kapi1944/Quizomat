import type { Pytanie, Quiz } from '../domena/quiz';
import { schematQuizu } from '../domena/quiz';
import { przeliczAdaptacje } from './adaptacja';
import { schematDecyzji, schematOdpowiedzi } from '../domena/sesja';
import type { Decyzja, Odpowiedz, ZmianaAdaptacyjna } from '../domena/sesja';

export type Wynik<T> =
  | { stan: 'gotowy'; wartosc: T }
  | { stan: 'blad' | 'nieobslugiwane'; opis: string };

export interface StanQuizu {
  readonly quiz: Quiz;
  readonly pytania: readonly Pytanie[];
  readonly zmianyAdaptacyjne: readonly ZmianaAdaptacyjna[];
  readonly indeksPytania: number;
  readonly decyzje: readonly Decyzja[];
  readonly historiaDecyzji: readonly Decyzja[];
}

export function sprawdzObslugePytania(pytanie: Pytanie): Wynik<Pytanie> {
  if (
    pytanie.prezentacja.rodzaj !== 'tekstowa' ||
    (pytanie.prezentacja.obrazy?.length ?? 0) > 0 ||
    pytanie.warianty.some((wariant) => (wariant.obrazy?.length ?? 0) > 0)
  )
    return {
      stan: 'nieobslugiwane',
      opis: 'Pytania wizualne są nieobsługiwane w aktualnej wersji.',
    };
  if (
    pytanie.sposobyOdpowiedzi.length !== 1 ||
    pytanie.sposobyOdpowiedzi.some(
      (sposob) => sposob.rodzaj !== 'pojedynczyWybor',
    )
  )
    return {
      stan: 'nieobslugiwane',
      opis: 'Ten zestaw sposobów odpowiedzi jest nieobsługiwany w aktualnej wersji. Dostępny jest pojedynczy wybór.',
    };
  return { stan: 'gotowy', wartosc: pytanie };
}

export function walidujOdpowiedz(
  pytanie: Pytanie,
  dane: unknown,
): Wynik<Odpowiedz> {
  const wynik = schematOdpowiedzi.safeParse(dane);
  if (!wynik.success)
    return { stan: 'blad', opis: 'Niepoprawna struktura odpowiedzi.' };
  const odpowiedz = wynik.data;
  if (odpowiedz.rodzaj === 'wlasna')
    return {
      stan: 'nieobslugiwane',
      opis: 'Odpowiedź własna jest nieobsługiwana w aktualnej wersji. Wymaga osobnego przebiegu analizy i potwierdzenia.',
    };
  const obsluga = sprawdzObslugePytania(pytanie);
  if (obsluga.stan !== 'gotowy') return obsluga;
  for (const wartosc of odpowiedz.wartosci) {
    const sposob = pytanie.sposobyOdpowiedzi.find(
      (sposob) => sposob.id === wartosc.sposobId,
    );
    if (!sposob || sposob.rodzaj !== wartosc.rodzaj)
      return {
        stan: 'blad',
        opis: 'Odpowiedź nie odpowiada sposobowi odpowiedzi tego pytania.',
      };
    if (wartosc.rodzaj !== 'pojedynczyWybor')
      return {
        stan: 'nieobslugiwane',
        opis: 'Ten sposób odpowiedzi jest nieobsługiwany w aktualnej wersji.',
      };
    if (!pytanie.warianty.some((wariant) => wariant.id === wartosc.wariantId))
      return {
        stan: 'blad',
        opis: 'Wybrany wariant nie istnieje w tym pytaniu.',
      };
  }
  if (
    pytanie.sposobyOdpowiedzi.some(
      (sposob) =>
        sposob.wymagany &&
        !odpowiedz.wartosci.some((wartosc) => wartosc.sposobId === sposob.id),
    )
  )
    return { stan: 'blad', opis: 'Uzupełnij wymagane sposoby odpowiedzi.' };
  return { stan: 'gotowy', wartosc: odpowiedz };
}

export function rozpocznijQuiz(quiz: Quiz): Wynik<StanQuizu> {
  if (quiz.reguly.length > 0 && !schematQuizu.safeParse(quiz).success)
    return {
      stan: 'blad',
      opis: 'Niepoprawna definicja quizu lub konflikt reguł.',
    };
  return {
    stan: 'gotowy',
    wartosc: {
      quiz: structuredClone(quiz),
      pytania: structuredClone(quiz.pytania),
      zmianyAdaptacyjne: [],
      indeksPytania: 0,
      decyzje: [],
      historiaDecyzji: [],
    },
  };
}

export function biezacePytanie(stan: StanQuizu): Pytanie | null {
  return stan.pytania[stan.indeksPytania] ?? null;
}

export function zatwierdzDecyzje(
  stan: StanQuizu,
  dane: unknown,
): Wynik<StanQuizu> {
  const wynik = schematDecyzji.safeParse(dane);
  if (!wynik.success)
    return { stan: 'blad', opis: 'Niepoprawna struktura decyzji.' };
  const decyzja = wynik.data;
  const pytanie = biezacePytanie(stan);
  if (!pytanie || decyzja.pytanieId !== pytanie.id)
    return { stan: 'blad', opis: 'Decyzja musi dotyczyć bieżącego pytania.' };
  if (
    [...stan.decyzje, ...stan.historiaDecyzji].some(
      (poprzednia) => poprzednia.id === decyzja.id,
    )
  )
    return { stan: 'blad', opis: 'ID zdarzenia decyzji musi być unikalne.' };
  if (
    decyzja.adnotacje.some(
      (adnotacja) =>
        adnotacja.wariantId !== undefined &&
        !pytanie.warianty.some((wariant) => wariant.id === adnotacja.wariantId),
    )
  )
    return { stan: 'blad', opis: 'Adnotacja wskazuje nieistniejący wariant.' };
  const odpowiedz = walidujOdpowiedz(pytanie, decyzja.odpowiedz);
  if (odpowiedz.stan !== 'gotowy') return odpowiedz;
  return {
    stan: 'gotowy',
    wartosc: przeliczAdaptacje({
      ...stan,
      decyzje: [
        ...stan.decyzje.filter(
          (poprzednia) => poprzednia.pytanieId !== pytanie.id,
        ),
        decyzja,
      ],
      historiaDecyzji: [
        ...stan.historiaDecyzji,
        ...stan.decyzje.filter(
          (poprzednia) => poprzednia.pytanieId === pytanie.id,
        ),
      ],
    }),
  };
}

export function przejdzDalej(stan: StanQuizu): Wynik<StanQuizu> {
  const pytanie = biezacePytanie(stan);
  if (!pytanie) return { stan: 'blad', opis: 'Quiz jest już zakończony.' };
  const obsluga = sprawdzObslugePytania(pytanie);
  if (obsluga.stan !== 'gotowy') return obsluga;
  const decyzja = stan.decyzje.find(
    (decyzja) => decyzja.pytanieId === pytanie.id,
  );
  if (!decyzja)
    return { stan: 'blad', opis: 'Wybierz odpowiedź przed przejściem dalej.' };
  const odpowiedz = walidujOdpowiedz(pytanie, decyzja.odpowiedz);
  if (odpowiedz.stan !== 'gotowy') return odpowiedz;
  return {
    stan: 'gotowy',
    wartosc: { ...stan, indeksPytania: stan.indeksPytania + 1 },
  };
}

export function przejdzWstecz(stan: StanQuizu): StanQuizu {
  return { ...stan, indeksPytania: Math.max(0, stan.indeksPytania - 1) };
}

export function wybierzWariant(
  stan: StanQuizu,
  wariantId: string,
  zdarzenie: { id: string; zatwierdzono: string },
): Wynik<StanQuizu> {
  const pytanie = biezacePytanie(stan);
  if (!pytanie) return { stan: 'blad', opis: 'Quiz jest już zakończony.' };
  const obsluga = sprawdzObslugePytania(pytanie);
  if (obsluga.stan !== 'gotowy') return obsluga;
  return zatwierdzDecyzje(stan, {
    ...zdarzenie,
    pytanieId: pytanie.id,
    odpowiedz: {
      rodzaj: 'standardowa',
      wartosci: [
        {
          sposobId: pytanie.sposobyOdpowiedzi[0]!.id,
          rodzaj: 'pojedynczyWybor',
          wariantId,
        },
      ],
    },
    adnotacje: [],
  });
}

export function wybranyWariant(stan: StanQuizu): string | null {
  const odpowiedz = stan.decyzje.find(
    (decyzja) => decyzja.pytanieId === biezacePytanie(stan)?.id,
  )?.odpowiedz;
  if (odpowiedz?.rodzaj !== 'standardowa') return null;
  const wartosc = odpowiedz.wartosci[0];
  return wartosc?.rodzaj === 'pojedynczyWybor' ? wartosc.wariantId : null;
}
