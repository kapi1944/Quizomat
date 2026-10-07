import type { Quiz } from '../domena/quiz';
import { schematSesji } from '../domena/sesja';
import type { MigawkaSesji, Sesja, ZdarzenieSesji } from '../domena/sesja';
import {
  biezacePytanie,
  przejdzDalej,
  przejdzWstecz,
  rozpocznijQuiz,
  zatwierdzDecyzje,
} from './runtime';
import type { Wynik } from './runtime';

export function migawkaSesji(sesja: Sesja): MigawkaSesji {
  return {
    zmieniono: sesja.zmieniono,
    stan: sesja.stan,
    biezacePytanieId: sesja.biezacePytanieId,
    decyzje: sesja.decyzje,
    historiaDecyzji: sesja.historiaDecyzji,
    odlozonePytaniaId: sesja.odlozonePytaniaId,
  };
}

export function uzupelnijDziennik(sesja: Sesja): Sesja {
  if (sesja.dziennikSesji) return sesja;
  return {
    ...sesja,
    dziennikSesji: {
      wersja: 1,
      baza: structuredClone(migawkaSesji(sesja)),
      zdarzenia: [],
    },
  };
}

export function odtworzSesje(quiz: Quiz, dane: Sesja): Wynik<Sesja> {
  const wynik = schematSesji.safeParse(uzupelnijDziennik(dane));
  if (!wynik.success)
    return { stan: 'blad', opis: 'Niepoprawny dziennik sesji.' };
  const sesja = wynik.data;
  const dziennik = sesja.dziennikSesji!;
  if (!schematSesji.safeParse({ ...sesja, ...dziennik.baza }).success)
    return { stan: 'blad', opis: 'Niepoprawna migawka początkowa dziennika.' };
  const poczatek = rozpocznijQuiz(quiz);
  if (poczatek.stan !== 'gotowy') return poczatek;
  if (sesja.quizId !== quiz.id || sesja.wersjaQuizu !== quiz.wersjaQuizu)
    return {
      stan: 'blad',
      opis: 'Sesja wymaga tej samej wersji definicji quizu.',
    };
  let migawka = structuredClone(dziennik.baza);
  for (const [indeks, zdarzenie] of dziennik.zdarzenia.entries()) {
    if (
      zdarzenie.kolejnosc !== indeks + 1 ||
      Date.parse(zdarzenie.czas) < Date.parse(migawka.zmieniono)
    )
      return {
        stan: 'blad',
        opis: 'Niepoprawna kolejność lub czas zdarzeń sesji.',
      };
    const indeksPytania =
      migawka.biezacePytanieId === null
        ? quiz.pytania.length
        : quiz.pytania.findIndex(
            (pytanie) => pytanie.id === migawka.biezacePytanieId,
          );
    if (indeksPytania < 0)
      return { stan: 'blad', opis: 'Dziennik wskazuje nieistniejące pytanie.' };
    const stan = {
      ...poczatek.wartosc,
      indeksPytania,
      decyzje: migawka.decyzje,
      historiaDecyzji: migawka.historiaDecyzji,
    };
    if (zdarzenie.rodzaj === 'nawigacja') {
      if (zdarzenie.poprzedniePytanieId !== migawka.biezacePytanieId)
        return {
          stan: 'blad',
          opis: 'Nawigacja nie odpowiada poprzedniemu miejscu sesji.',
        };
      const cel =
        zdarzenie.biezacePytanieId === null
          ? quiz.pytania.length
          : quiz.pytania.findIndex(
              (pytanie) => pytanie.id === zdarzenie.biezacePytanieId,
            );
      if (cel < 0)
        return {
          stan: 'blad',
          opis: 'Nawigacja wskazuje nieistniejące pytanie.',
        };
      if (
        cel === indeksPytania + 1 &&
        !migawka.odlozonePytaniaId.includes(zdarzenie.biezacePytanieId ?? '')
      ) {
        const dalej = przejdzDalej(stan);
        if (dalej.stan !== 'gotowy') return dalej;
      } else if (
        cel !== przejdzWstecz(stan).indeksPytania &&
        !migawka.odlozonePytaniaId.includes(zdarzenie.biezacePytanieId ?? '')
      )
        return {
          stan: 'blad',
          opis: 'Niedozwolona nawigacja w dzienniku sesji.',
        };
      migawka = { ...migawka, biezacePytanieId: zdarzenie.biezacePytanieId };
    } else {
      const pytanie = biezacePytanie(stan);
      const poprzednia =
        migawka.decyzje.find(
          (decyzja) => decyzja.pytanieId === zdarzenie.pytanieId,
        ) ?? null;
      if (
        !pytanie ||
        pytanie.id !== zdarzenie.pytanieId ||
        JSON.stringify(poprzednia) !==
          JSON.stringify(zdarzenie.poprzedniaDecyzja)
      )
        return {
          stan: 'blad',
          opis: 'Zmiana decyzji nie odpowiada poprzedniemu stanowi pytania.',
        };
      if (zdarzenie.rodzaj === 'decyzja') {
        if (zdarzenie.nowaDecyzja.zatwierdzono !== zdarzenie.czas)
          return {
            stan: 'blad',
            opis: 'Czas decyzji nie odpowiada zdarzeniu.',
          };
        const wybor = zatwierdzDecyzje(stan, zdarzenie.nowaDecyzja);
        if (wybor.stan !== 'gotowy') return wybor;
        migawka = {
          ...migawka,
          decyzje: [...wybor.wartosc.decyzje],
          historiaDecyzji: [...wybor.wartosc.historiaDecyzji],
          odlozonePytaniaId: migawka.odlozonePytaniaId.filter(
            (id) => id !== pytanie.id,
          ),
        };
      } else {
        migawka = {
          ...migawka,
          decyzje: migawka.decyzje.filter(
            (decyzja) => decyzja.pytanieId !== pytanie.id,
          ),
          historiaDecyzji: [
            ...migawka.historiaDecyzji,
            ...(poprzednia ? [poprzednia] : []),
          ],
          odlozonePytaniaId: [
            ...new Set([...migawka.odlozonePytaniaId, pytanie.id]),
          ],
          biezacePytanieId: quiz.pytania[indeksPytania + 1]?.id ?? null,
        };
      }
    }
    migawka = {
      ...migawka,
      zmieniono: zdarzenie.czas,
      stan:
        migawka.biezacePytanieId === null &&
        migawka.odlozonePytaniaId.length === 0 &&
        migawka.decyzje.length === quiz.pytania.length
          ? 'zakonczona'
          : 'wTrakcie',
    };
  }
  const odtworzona = schematSesji.safeParse({ ...sesja, ...migawka });
  if (!odtworzona.success)
    return { stan: 'blad', opis: 'Dziennik odtwarza niepoprawny stan sesji.' };
  return { stan: 'gotowy', wartosc: odtworzona.data };
}

export function dopiszZdarzenie(
  quiz: Quiz,
  sesja: Sesja,
  zdarzenie: ZdarzenieSesji,
): Wynik<Sesja> {
  const zDziennikiem = uzupelnijDziennik(sesja);
  const dziennik = zDziennikiem.dziennikSesji!;
  return odtworzSesje(quiz, {
    ...zDziennikiem,
    dziennikSesji: {
      ...dziennik,
      zdarzenia: [...dziennik.zdarzenia, zdarzenie],
    },
  });
}

export function zachowujeAudyt(poprzednia: Sesja, nowa: Sesja): boolean {
  const stary = uzupelnijDziennik(poprzednia).dziennikSesji!;
  const nowy = nowa.dziennikSesji;
  return (
    nowy !== undefined &&
    JSON.stringify(stary.baza) === JSON.stringify(nowy.baza) &&
    JSON.stringify(stary.zdarzenia) ===
      JSON.stringify(nowy.zdarzenia.slice(0, stary.zdarzenia.length))
  );
}
