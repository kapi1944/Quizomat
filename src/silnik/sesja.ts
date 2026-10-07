import type { Quiz } from '../domena/quiz';
import { schematSesji } from '../domena/sesja';
import type { Sesja } from '../domena/sesja';
import { biezacePytanie, rozpocznijQuiz, walidujOdpowiedz } from './runtime';
import type { StanQuizu, Wynik } from './runtime';

export interface PrzebiegSesji {
  sesja: Sesja;
  przebieg: StanQuizu;
}

export function utworzSesje(
  quiz: Quiz,
  id: string,
  czas: string,
): Wynik<PrzebiegSesji> {
  const poczatek = rozpocznijQuiz(quiz);
  if (poczatek.stan !== 'gotowy') return poczatek;
  const sesja = schematSesji.safeParse({
    schemaVersion: '1.0.0',
    id,
    quizId: quiz.id,
    wersjaQuizu: quiz.wersjaQuizu,
    utworzono: czas,
    zmieniono: czas,
    stan: 'wTrakcie',
    biezacePytanieId: quiz.pytania[0]!.id,
    decyzje: [],
    historiaDecyzji: [],
    odlozonePytaniaId: [],
    szkiceWlasnychOdpowiedzi: [],
    zmianyAdaptacyjne: [],
    historiaZmianAdaptacyjnych: [],
  });
  if (!sesja.success)
    return { stan: 'blad', opis: 'Niepoprawne dane nowej sesji.' };
  return {
    stan: 'gotowy',
    wartosc: { sesja: sesja.data, przebieg: poczatek.wartosc },
  };
}

export function wznowSesje(quiz: Quiz, dane: unknown): Wynik<PrzebiegSesji> {
  const wynik = schematSesji.safeParse(dane);
  if (!wynik.success)
    return { stan: 'blad', opis: 'Niepoprawne dane zapisanej sesji.' };
  const sesja = wynik.data;
  if (sesja.quizId !== quiz.id || sesja.wersjaQuizu !== quiz.wersjaQuizu)
    return {
      stan: 'blad',
      opis: 'Sesja wymaga tej samej wersji definicji quizu.',
    };
  const poczatek = rozpocznijQuiz(quiz);
  if (poczatek.stan !== 'gotowy') return poczatek;
  if (
    sesja.szkiceWlasnychOdpowiedzi.length ||
    sesja.zmianyAdaptacyjne.length ||
    sesja.historiaZmianAdaptacyjnych.length
  )
    return {
      stan: 'nieobslugiwane',
      opis: 'Sesje ze szkicami lub adaptacją są nieobsługiwane w aktualnej wersji.',
    };
  const indeks =
    sesja.biezacePytanieId === null
      ? quiz.pytania.length
      : quiz.pytania.findIndex(
          (pytanie) => pytanie.id === sesja.biezacePytanieId,
        );
  if (
    indeks < 0 ||
    sesja.odlozonePytaniaId.some(
      (id) => !quiz.pytania.some((pytanie) => pytanie.id === id),
    )
  )
    return { stan: 'blad', opis: 'Sesja wskazuje nieistniejące pytanie.' };
  for (const decyzja of [...sesja.decyzje, ...sesja.historiaDecyzji]) {
    const pytanie = quiz.pytania.find(
      (pytanie) => pytanie.id === decyzja.pytanieId,
    );
    if (!pytanie)
      return {
        stan: 'blad',
        opis: 'Decyzja sesji wskazuje nieistniejące pytanie.',
      };
    const odpowiedz = walidujOdpowiedz(pytanie, decyzja.odpowiedz);
    if (odpowiedz.stan !== 'gotowy') return odpowiedz;
    if (
      decyzja.adnotacje.some(
        (adnotacja) =>
          adnotacja.wariantId !== undefined &&
          !pytanie.warianty.some(
            (wariant) => wariant.id === adnotacja.wariantId,
          ),
      )
    )
      return {
        stan: 'blad',
        opis: 'Adnotacja sesji wskazuje nieistniejący wariant.',
      };
  }
  if (
    sesja.stan === 'zakonczona' &&
    (sesja.biezacePytanieId !== null ||
      sesja.odlozonePytaniaId.length > 0 ||
      sesja.decyzje.length !== quiz.pytania.length)
  )
    return {
      stan: 'blad',
      opis: 'Sesja nie może być zakończona z nierozstrzygniętymi pytaniami.',
    };
  if (
    indeks === quiz.pytania.length &&
    quiz.pytania.some(
      (pytanie) =>
        !sesja.decyzje.some((decyzja) => decyzja.pytanieId === pytanie.id) &&
        !sesja.odlozonePytaniaId.includes(pytanie.id),
    )
  )
    return {
      stan: 'blad',
      opis: 'Koniec zestawu wymaga odpowiedzi lub odłożenia każdego pytania.',
    };
  return {
    stan: 'gotowy',
    wartosc: {
      sesja,
      przebieg: {
        ...poczatek.wartosc,
        indeksPytania: indeks,
        decyzje: sesja.decyzje,
        historiaDecyzji: sesja.historiaDecyzji,
      },
    },
  };
}

export function aktualizujSesje(
  stan: PrzebiegSesji,
  wynik: Wynik<StanQuizu>,
  czas: string,
): Wynik<PrzebiegSesji> {
  if (wynik.stan !== 'gotowy') return wynik;
  const przebieg = wynik.wartosc;
  const odlozonePytaniaId = stan.sesja.odlozonePytaniaId.filter(
    (id) => !przebieg.decyzje.some((decyzja) => decyzja.pytanieId === id),
  );
  const biezacePytanieId = biezacePytanie(przebieg)?.id ?? null;
  const sesja = {
    ...stan.sesja,
    zmieniono: czas,
    biezacePytanieId,
    decyzje: [...przebieg.decyzje],
    historiaDecyzji: [...przebieg.historiaDecyzji],
    odlozonePytaniaId,
    stan:
      biezacePytanieId === null &&
      odlozonePytaniaId.length === 0 &&
      przebieg.decyzje.length === przebieg.quiz.pytania.length
        ? ('zakonczona' as const)
        : ('wTrakcie' as const),
  };
  return wznowSesje(przebieg.quiz, sesja);
}

export function odlozPytanie(
  stan: PrzebiegSesji,
  czas: string,
): Wynik<PrzebiegSesji> {
  const pytanie = biezacePytanie(stan.przebieg);
  if (!pytanie) return { stan: 'blad', opis: 'Wybierz pytanie do odłożenia.' };
  const poprzednie = stan.przebieg.decyzje.filter(
    (decyzja) => decyzja.pytanieId === pytanie.id,
  );
  const przebieg = {
    ...stan.przebieg,
    indeksPytania: stan.przebieg.indeksPytania + 1,
    decyzje: stan.przebieg.decyzje.filter(
      (decyzja) => decyzja.pytanieId !== pytanie.id,
    ),
    historiaDecyzji: [...stan.przebieg.historiaDecyzji, ...poprzednie],
  };
  const sesja = {
    ...stan.sesja,
    odlozonePytaniaId: [
      ...new Set([...stan.sesja.odlozonePytaniaId, pytanie.id]),
    ],
  };
  return aktualizujSesje(
    { ...stan, sesja },
    { stan: 'gotowy', wartosc: przebieg },
    czas,
  );
}

export function wrocDoPytania(
  stan: PrzebiegSesji,
  pytanieId: string,
  czas: string,
): Wynik<PrzebiegSesji> {
  const indeks = stan.przebieg.quiz.pytania.findIndex(
    (pytanie) => pytanie.id === pytanieId,
  );
  if (indeks < 0 || !stan.sesja.odlozonePytaniaId.includes(pytanieId))
    return {
      stan: 'blad',
      opis: 'Nie znaleziono tego pytania na liście odłożonych.',
    };
  return aktualizujSesje(
    stan,
    { stan: 'gotowy', wartosc: { ...stan.przebieg, indeksPytania: indeks } },
    czas,
  );
}
