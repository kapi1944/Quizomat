import { przeliczAdaptacje } from './adaptacja';
import type { Quiz } from '../domena/quiz';
import { schematSesji } from '../domena/sesja';
import type { Sesja } from '../domena/sesja';
import { biezacePytanie, rozpocznijQuiz, walidujOdpowiedz } from './runtime';
import type { StanQuizu, Wynik } from './runtime';
import {
  dopiszZdarzenie,
  migawkaSesji,
  odtworzSesje,
  uzupelnijDziennik,
} from './replay';

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
    wartosc: {
      sesja: uzupelnijDziennik(sesja.data),
      przebieg: poczatek.wartosc,
    },
  };
}

export function wznowSesje(quiz: Quiz, dane: unknown): Wynik<PrzebiegSesji> {
  const wynik = schematSesji.safeParse(dane);
  if (!wynik.success)
    return { stan: 'blad', opis: 'Niepoprawne dane zapisanej sesji.' };
  const odtworzona = odtworzSesje(quiz, wynik.data);
  if (odtworzona.stan !== 'gotowy') return odtworzona;
  if (
    JSON.stringify(migawkaSesji(wynik.data)) !==
    JSON.stringify(migawkaSesji(odtworzona.wartosc))
  )
    return {
      stan: 'blad',
      opis: 'Aktualny stan sesji nie odpowiada jej dziennikowi.',
    };
  const sesja = odtworzona.wartosc;
  if (
    JSON.stringify(wynik.data.zmianyAdaptacyjne) !==
      JSON.stringify(sesja.zmianyAdaptacyjne) ||
    JSON.stringify(wynik.data.historiaZmianAdaptacyjnych) !==
      JSON.stringify(sesja.historiaZmianAdaptacyjnych)
  )
    return { stan: 'blad', opis: 'Adaptacja nie odpowiada dziennikowi sesji.' };
  if (sesja.quizId !== quiz.id || sesja.wersjaQuizu !== quiz.wersjaQuizu)
    return {
      stan: 'blad',
      opis: 'Sesja wymaga tej samej wersji definicji quizu.',
    };
  const poczatek = rozpocznijQuiz(quiz);
  if (poczatek.stan !== 'gotowy') return poczatek;
  for (const szkic of sesja.szkiceWlasnychOdpowiedzi) {
    const pytanie = [...quiz.pytania, ...quiz.pytaniaDodatkowe].find(
      (pytanie) => pytanie.id === szkic.pytanieId,
    );
    if (!pytanie?.innaOdpowiedz)
      return {
        stan: 'blad',
        opis: 'Szkic dotyczy pytania bez własnej odpowiedzi.',
      };
  }
  const projekcja = przeliczAdaptacje({
    ...poczatek.wartosc,
    decyzje: sesja.decyzje,
    historiaDecyzji: sesja.historiaDecyzji,
  });
  const pytania = projekcja.pytania;
  const indeks =
    sesja.biezacePytanieId === null
      ? pytania.length
      : pytania.findIndex((pytanie) => pytanie.id === sesja.biezacePytanieId);
  if (
    indeks < 0 ||
    sesja.odlozonePytaniaId.some(
      (id) => !pytania.some((pytanie) => pytanie.id === id),
    )
  )
    return { stan: 'blad', opis: 'Sesja wskazuje nieistniejące pytanie.' };
  for (const decyzja of [...sesja.decyzje, ...sesja.historiaDecyzji]) {
    const pytanie = [...quiz.pytania, ...quiz.pytaniaDodatkowe].find(
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
      pytania.some(
        (pytanie) =>
          !sesja.decyzje.some((decyzja) => decyzja.pytanieId === pytanie.id) &&
          !sesja.odlozonePytaniaId.includes(pytanie.id),
      ))
  )
    return {
      stan: 'blad',
      opis: 'Zakończenie wymaga odpowiedzi lub świadomego odłożenia każdego pytania.',
    };
  if (
    indeks === pytania.length &&
    pytania.some(
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
        ...projekcja,
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
  const zmienione = przebieg.decyzje.filter(
    (decyzja) =>
      !stan.sesja.decyzje.some(
        (stara) => JSON.stringify(stara) === JSON.stringify(decyzja),
      ),
  );
  const pytanieId = biezacePytanie(stan.przebieg)?.id;
  const nowa = zmienione[0];
  const kolejnosc = (stan.sesja.dziennikSesji?.zdarzenia.length ?? 0) + 1;
  const wynikZdarzenia =
    zmienione.length === 1 &&
    nowa &&
    nowa.pytanieId === pytanieId &&
    biezacePytanie(przebieg)?.id === pytanieId
      ? dopiszZdarzenie(przebieg.quiz, stan.sesja, {
          rodzaj: 'decyzja',
          kolejnosc,
          czas: nowa.zatwierdzono,
          pytanieId: nowa.pytanieId,
          poprzedniaDecyzja:
            stan.sesja.decyzje.find(
              (decyzja) => decyzja.pytanieId === nowa.pytanieId,
            ) ?? null,
          nowaDecyzja: nowa,
        })
      : zmienione.length === 0
        ? dopiszZdarzenie(przebieg.quiz, stan.sesja, {
            rodzaj: 'nawigacja',
            kolejnosc,
            czas,
            poprzedniePytanieId: stan.sesja.biezacePytanieId,
            biezacePytanieId: biezacePytanie(przebieg)?.id ?? null,
          })
        : {
            stan: 'blad' as const,
            opis: 'Operacja nie odpowiada pojedynczemu zdarzeniu sesji.',
          };
  if (wynikZdarzenia.stan !== 'gotowy') return wynikZdarzenia;
  if (
    JSON.stringify(wynikZdarzenia.wartosc.decyzje) !==
      JSON.stringify(przebieg.decyzje) ||
    JSON.stringify(wynikZdarzenia.wartosc.historiaDecyzji) !==
      JSON.stringify(przebieg.historiaDecyzji)
  )
    return {
      stan: 'blad',
      opis: 'Wynik operacji zawiera dane niepochodzące z dziennika.',
    };
  return wznowSesje(przebieg.quiz, wynikZdarzenia.wartosc);
}

export function odlozPytanie(
  stan: PrzebiegSesji,
  czas: string,
): Wynik<PrzebiegSesji> {
  const pytanie = biezacePytanie(stan.przebieg);
  if (!pytanie) return { stan: 'blad', opis: 'Wybierz pytanie do odłożenia.' };
  const wynik = dopiszZdarzenie(stan.przebieg.quiz, stan.sesja, {
    rodzaj: 'odlozenie',
    kolejnosc: (stan.sesja.dziennikSesji?.zdarzenia.length ?? 0) + 1,
    czas,
    pytanieId: pytanie.id,
    poprzedniaDecyzja:
      stan.sesja.decyzje.find((decyzja) => decyzja.pytanieId === pytanie.id) ??
      null,
  });
  return wynik.stan === 'gotowy'
    ? wznowSesje(stan.przebieg.quiz, wynik.wartosc)
    : wynik;
}

export function wrocDoPytania(
  stan: PrzebiegSesji,
  pytanieId: string,
  czas: string,
): Wynik<PrzebiegSesji> {
  const indeks = stan.przebieg.pytania.findIndex(
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
