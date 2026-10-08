import type { Pytanie } from '../domena/quiz';
import { walidujImportQuizu } from './walidator';
import type { WynikImportu } from './walidator';

export interface ProblemTekstu {
  od: number;
  do: number;
  pytanieId: string | null;
  kategoria: 'normalizacja' | 'interpretacja' | 'struktura' | 'rekomendacja';
  poziom: 'informacja' | 'ostrzezenie' | 'blad';
  opis: string;
  rozwiazanie: string;
}

export interface PytanieTekstu {
  id: string;
  numer: string | null;
  od: number;
  do: number;
  tresc: string;
  warianty: {
    id: string;
    litera: string;
    etykieta: string;
    gwiazdka: boolean;
  }[];
  sugestie: { litera: string; uzasadnienie: string }[];
}

export interface RaportTekstu {
  id: string;
  oryginal: string;
  pytania: PytanieTekstu[];
  problemy: ProblemTekstu[];
}

function normalizuj(wiersz: string): string {
  return wiersz
    .replace(/^\uFEFF/, '')
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/([*_`])([^*_`]+)\1/g, '$2')
    .replace(/^[*_`]+|[*_`]+$/g, '')
    .replace(/\\\s*$/, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function parsujTekst(oryginal: string): RaportTekstu {
  const raport: RaportTekstu = {
    id: crypto.randomUUID(),
    oryginal,
    pytania: [],
    problemy: [],
  };
  let pytanie: PytanieTekstu | undefined;
  let poSugestii = false;
  const wiersze = oryginal.split(/\r\n|\n|\r/);
  function problem(
    od: number,
    doWiersza: number,
    kategoria: ProblemTekstu['kategoria'],
    poziom: ProblemTekstu['poziom'],
    opis: string,
    rozwiazanie: string,
    pytanieId: string | null = pytanie?.id ?? null,
  ) {
    raport.problemy.push({
      od,
      do: doWiersza,
      pytanieId,
      kategoria,
      poziom,
      opis,
      rozwiazanie,
    });
  }
  wiersze.forEach((surowy, indeks) => {
    const wiersz = normalizuj(surowy);
    const numerWiersza = indeks + 1;
    if (surowy !== wiersz && wiersz)
      problem(
        numerWiersza,
        numerWiersza,
        'normalizacja',
        'informacja',
        'Usunięto formatowanie Markdown lub nadmiarowe odstępy.',
        'Sprawdź podgląd.',
        null,
      );
    if (!wiersz) return;
    const naglowek = /^(\d+)[.)]\s*(.*)$/u.exec(wiersz);
    const wariant = /^(?:[-+]\s+)?([A-Z])[.)]\s*(.*)$/u.exec(wiersz);
    const sugestia =
      /^(?:Sugestia|Rekomendacja)\s*:\s*([A-Z])\b\s*(?:[—–-]\s*)?(.*)$/iu.exec(
        wiersz,
      );
    const oznaczenieSugestii = /^(?:Sugestia|Rekomendacja)\s*:/iu.test(wiersz);
    if (
      naglowek ||
      (!wariant &&
        !oznaczenieSugestii &&
        (!pytanie || (wiersz.endsWith('?') && pytanie.warianty.length > 0)))
    ) {
      pytanie = {
        id: crypto.randomUUID(),
        numer: naglowek?.[1] ?? null,
        od: numerWiersza,
        do: numerWiersza,
        tresc: naglowek?.[2] ?? wiersz,
        warianty: [],
        sugestie: [],
      };
      raport.pytania.push(pytanie);
      poSugestii = false;
      problem(
        numerWiersza,
        numerWiersza,
        'interpretacja',
        'ostrzezenie',
        'Rozpoznano pytanie z domyślnym pojedynczym wyborem.',
        'Potwierdź granice pytania i mechanikę w podglądzie.',
      );
      return;
    }
    if (!pytanie) {
      problem(
        numerWiersza,
        numerWiersza,
        'struktura',
        'blad',
        'Fragment poza pytaniem.',
        'Dodaj pytanie albo jawnie pomiń fragment.',
      );
      return;
    }
    pytanie.do = numerWiersza;
    if (wariant) {
      pytanie.warianty.push({
        id: crypto.randomUUID(),
        litera: wariant[1]!,
        etykieta: wariant[2]!.replace(/⭐\uFE0F?/gu, '').trim(),
        gwiazdka: wariant[2]!.includes('⭐'),
      });
      poSugestii = false;
    } else if (sugestia) {
      pytanie.sugestie.push({
        litera: sugestia[1]!.toUpperCase(),
        uzasadnienie: sugestia[2]!.trim(),
      });
      poSugestii = true;
    } else if (oznaczenieSugestii) {
      problem(
        numerWiersza,
        numerWiersza,
        'rekomendacja',
        'blad',
        'Nie rozpoznano zapisu rekomendacji.',
        'Użyj „Sugestia: A — uzasadnienie” albo usuń oznaczenie.',
      );
      poSugestii = false;
    } else {
      if (poSugestii) {
        const ostatnia = pytanie.sugestie.at(-1)!;
        ostatnia.uzasadnienie = `${ostatnia.uzasadnienie} ${wiersz}`.trim();
      } else if (pytanie.warianty.length) {
        const ostatni = pytanie.warianty.at(-1)!;
        ostatni.etykieta += `${ostatni.etykieta ? ' ' : ''}${wiersz.replace(/⭐\uFE0F?/gu, '').trim()}`;
        ostatni.gwiazdka ||= wiersz.includes('⭐');
      } else pytanie.tresc += ` ${wiersz}`;
      problem(
        numerWiersza,
        numerWiersza,
        'interpretacja',
        'ostrzezenie',
        'Dołączono kontynuację wiersza do poprzedniej treści.',
        'Sprawdź granice i treść; popraw tekst, jeśli to osobny fragment.',
      );
    }
  });
  for (const element of raport.pytania) {
    pytanie = element;
    const blad = (
      kategoria: ProblemTekstu['kategoria'],
      opis: string,
      rozwiazanie: string,
    ) => problem(element.od, element.do, kategoria, 'blad', opis, rozwiazanie);
    if (!element.tresc.trim())
      blad('struktura', 'Puste pytanie.', 'Uzupełnij treść pytania.');
    if (element.warianty.length < 2)
      blad(
        'struktura',
        'Pojedynczy wybór wymaga co najmniej dwóch wariantów.',
        'Dodaj brakujące warianty lub pomiń pytanie.',
      );
    if (element.warianty.some((wariant) => !wariant.etykieta.trim()))
      blad(
        'struktura',
        'Przerwany lub pusty wariant.',
        'Uzupełnij treść wariantu.',
      );
    if (
      new Set(element.warianty.map((wariant) => wariant.litera)).size !==
      element.warianty.length
    )
      blad(
        'struktura',
        'Powtórzone oznaczenie wariantu.',
        'Nadaj wariantom różne litery.',
      );
    const wskazania = [
      ...element.warianty
        .filter((wariant) => wariant.gwiazdka)
        .map((wariant) => wariant.litera),
      ...element.sugestie.map((sugestia) => sugestia.litera),
    ];
    if (new Set(wskazania).size > 1 || element.sugestie.length > 1)
      blad(
        'rekomendacja',
        'Sprzeczne lub wielokrotne rekomendacje.',
        'Popraw oznaczenia ⭐ i Sugestia tak, aby wskazywały jeden wariant.',
      );
    if (
      wskazania.some(
        (litera) =>
          !element.warianty.some((wariant) => wariant.litera === litera),
      )
    )
      blad(
        'rekomendacja',
        'Rekomendacja wskazuje brakujący wariant.',
        'Popraw literę sugestii lub dodaj wariant.',
      );
    if (wskazania.length && !element.sugestie[0]?.uzasadnienie.trim())
      blad(
        'rekomendacja',
        'Brak uzasadnienia rekomendacji wymaganego przez JSON 1.0.0.',
        'Uzupełnij „Sugestia: X — uzasadnienie” albo usuń wszystkie oznaczenia rekomendacji.',
      );
  }
  if (!raport.pytania.length)
    problem(
      1,
      wiersze.length,
      'struktura',
      'blad',
      'Nie rozpoznano żadnego pytania.',
      'Wpisz pytanie i warianty A. / B.',
      null,
    );
  return raport;
}

export function przygotujImportTekstu(
  raport: RaportTekstu,
  metadane: { tytul: string; jezyk: string },
  zakres: string[],
  potwierdzonoInterpretacje: boolean,
  potwierdzonoCzesciowy: boolean,
  oryginal = raport.oryginal,
  potwierdzonoPelnyZakresKorekty = false,
): WynikImportu {
  if (!metadane.tytul.trim() || !metadane.jezyk.trim())
    throw new Error('Podaj tytuł i język quizu.');
  if (!potwierdzonoInterpretacje)
    throw new Error('Potwierdź interpretację tekstu.');
  const wybrane = raport.pytania.filter((pytanie) =>
    zakres.includes(pytanie.id),
  );
  if (
    !wybrane.length ||
    new Set(zakres).size !== zakres.length ||
    wybrane.length !== zakres.length
  )
    throw new Error('Wybierz poprawny, niepusty zakres pytań.');
  if (
    raport.problemy.some(
      (problem) =>
        problem.poziom === 'blad' &&
        problem.pytanieId !== null &&
        zakres.includes(problem.pytanieId),
    )
  )
    throw new Error('Popraw błędy wybranych pytań albo wyłącz je z zakresu.');
  const raportOryginalu =
    oryginal === raport.oryginal ? raport : parsujTekst(oryginal);
  const niekompletny =
    (oryginal !== raport.oryginal && !potwierdzonoPelnyZakresKorekty) ||
    wybrane.length !== raport.pytania.length ||
    raportOryginalu.pytania.length > raport.pytania.length ||
    raport.problemy.some(
      (problem) => problem.poziom === 'blad' && problem.pytanieId === null,
    );
  if (niekompletny && !potwierdzonoCzesciowy)
    throw new Error('Jawnie zatwierdź częściowy zakres importu.');
  const pytania: Pytanie[] = wybrane.map((pytanie) => {
    const litera =
      pytanie.sugestie[0]?.litera ??
      pytanie.warianty.find((wariant) => wariant.gwiazdka)?.litera;
    return {
      id: pytanie.id,
      tresc: pytanie.tresc,
      prezentacja: { rodzaj: 'tekstowa' },
      warianty: pytanie.warianty.map((wariant) => ({
        id: wariant.id,
        etykieta: wariant.etykieta,
      })),
      sposobyOdpowiedzi: [
        {
          id: `${pytanie.id}-wybor`,
          rodzaj: 'pojedynczyWybor',
          wymagany: true,
        },
      ],
      ...(litera
        ? {
            rekomendacja: {
              wariantId: pytanie.warianty.find(
                (wariant) => wariant.litera === litera,
              )!.id,
              uzasadnienie: pytanie.sugestie[0]!.uzasadnienie,
            },
          }
        : {}),
    };
  });
  const wynik = walidujImportQuizu(
    JSON.stringify({
      schemaVersion: '1.0.0',
      id: raport.id,
      wersjaQuizu: '1.0.0',
      tytul: metadane.tytul.trim(),
      jezyk: metadane.jezyk.trim(),
      liczbaPytan: pytania.length,
      pytania,
      pytaniaDodatkowe: [],
      reguly: [],
    }),
  );
  return {
    ...wynik,
    daneZrodlowe: {
      rodzaj: 'tekst',
      oryginal,
      tekstPoKorekcie: raport.oryginal,
      raport,
      raportOryginalu,
      zakres: [...zakres],
      niekompletny,
      potwierdzonoInterpretacje,
      potwierdzonoCzesciowy,
      potwierdzonoPelnyZakresKorekty,
      kanoniczny: wynik.daneZrodlowe,
    },
  };
}
