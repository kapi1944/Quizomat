import { describe as opisz, it as sprawdz, expect as oczekuj } from 'vitest';
import { IDBFactory as FabrykaBazy } from 'fake-indexeddb';
import { parsujTekst, przygotujImportTekstu } from '../../src/import/tekst';
import { odczytajTekstPliku } from '../../src/import/plik';
import { walidujImportQuizu } from '../../src/import/walidator';
import {
  odczytajBiblioteke,
  zapiszZatwierdzonyQuiz,
} from '../../src/dane/biblioteka';
import {
  rozpocznijQuiz,
  wybierzWariant,
  przejdzDalej,
  biezacePytanie,
} from '../../src/silnik/runtime';

const przykladUzytkownika = `**1. Czy aktualizacja powinna mieć własny tytuł?**

A. Nie — tylko data i treść.\\
B. Tak, obowiązkowo.\\
C. Tak, ale opcjonalnie. ⭐

**Sugestia: C** — drobna aktualizacja może nie potrzebować tytułu.`;

// Użytkownik przekazał jedno pytanie; cztery dalsze są neutralnymi danymi testowymi.
const piecPytan = `${przykladUzytkownika}

2) Czy pokazać opis?
A) Tak
B) Nie

### 3. Który rozmiar wybrać?
**A. Mały**
B. Średni
C. Duży
D. Większy
E. Największy
Sugestia: B — Średni mieści opis.

4. Czy użyć polskich znaków?
A. Zażółć gęślą jaźń.
B. Łódź, źródło i ścieżka.

5. Która kolejność?
A. Najpierw tytuł
   potem treść.
B. Najpierw treść.`;

function przygotuj(tekst: string) {
  const raport = parsujTekst(tekst);
  return przygotujImportTekstu(
    raport,
    { tytul: 'Pakiet', jezyk: 'pl' },
    raport.pytania.map((pytanie) => pytanie.id),
    true,
    false,
  );
}

opisz('Elastyczny import tekstu', () => {
  sprawdz('rozpoznaje dokładny przykład użytkownika i uzasadnienie', () => {
    const raport = parsujTekst(przykladUzytkownika);
    oczekuj(raport.pytania[0]).toMatchObject({
      numer: '1',
      od: 1,
      do: 7,
      tresc: 'Czy aktualizacja powinna mieć własny tytuł?',
    });
    const wynik = przygotuj(przykladUzytkownika);
    oczekuj(wynik.stan).toBe('gotowyDoZatwierdzenia');
    oczekuj(wynik.quiz?.pytania[0]?.warianty).toHaveLength(3);
    oczekuj(wynik.quiz?.pytania[0]?.rekomendacja).toEqual({
      wariantId: wynik.quiz?.pytania[0]?.warianty[2]?.id,
      uzasadnienie: 'drobna aktualizacja może nie potrzebować tytułu.',
    });
  });

  sprawdz(
    'pięć pytań przechodzi kanoniczną walidację i cały istniejący silnik',
    () => {
      const wynik = przygotuj(piecPytan);
      oczekuj(wynik.quiz?.pytania).toHaveLength(5);
      if (!wynik.quiz) throw new Error('Brak quizu');
      oczekuj(
        wynik.quiz.pytania.map((pytanie) => pytanie.warianty.length),
      ).toEqual([3, 2, 5, 2, 2]);
      oczekuj(walidujImportQuizu(JSON.stringify(wynik.quiz)).stan).toBe(
        'gotowyDoZatwierdzenia',
      );
      let przebieg = rozpocznijQuiz(wynik.quiz);
      for (let indeks = 0; indeks < 5; indeks++) {
        if (przebieg.stan !== 'gotowy') throw new Error('Błąd silnika');
        const pytanie = biezacePytanie(przebieg.wartosc)!;
        przebieg = wybierzWariant(przebieg.wartosc, pytanie.warianty[0]!.id, {
          id: `decyzja-${indeks}`,
          zatwierdzono: '2026-10-08T12:00:00.000Z',
        });
        if (przebieg.stan !== 'gotowy') throw new Error('Błąd wyboru');
        przebieg = przejdzDalej(przebieg.wartosc);
      }
      if (przebieg.stan !== 'gotowy') throw new Error('Błąd przejścia');
      oczekuj(biezacePytanie(przebieg.wartosc)).toBeNull();
      oczekuj(przebieg.wartosc.decyzje).toHaveLength(5);
    },
  );

  sprawdz(
    'nie dopisuje rekomendacji, zalet, wad ani analiz; generuje metadane',
    () => {
      const wynik = przygotuj('Pytanie bez numeru?\nA. Żółty\nB. Zielony');
      oczekuj(wynik.quiz).toMatchObject({
        schemaVersion: '1.0.0',
        wersjaQuizu: '1.0.0',
        liczbaPytan: 1,
        reguly: [],
        pytaniaDodatkowe: [],
      });
      const pytanie = wynik.quiz!.pytania[0]!;
      oczekuj(pytanie).not.toHaveProperty('rekomendacja');
      oczekuj(pytanie).not.toHaveProperty('innaOdpowiedz');
      oczekuj(pytanie.warianty[0]).toEqual({
        id: oczekuj.any(String),
        etykieta: 'Żółty',
      });
      oczekuj(pytanie.sposobyOdpowiedzi[0]).toMatchObject({
        rodzaj: 'pojedynczyWybor',
        wymagany: true,
      });
    },
  );

  sprawdz.each([
    [
      'konflikt',
      '1. Pytanie?\nA. Alfa ⭐\nB. Beta\nSugestia: B — Powód.',
      'Sprzeczne',
    ],
    ['sama gwiazdka', '1. Pytanie?\nA. Alfa ⭐\nB. Beta', 'Brak uzasadnienia'],
    [
      'sama litera',
      '1. Pytanie?\nA. Alfa\nB. Beta\nSugestia: A',
      'Brak uzasadnienia',
    ],
    [
      'nieistniejący wariant',
      '1. Pytanie?\nA. Alfa\nB. Beta\nSugestia: C — Powód',
      'brakujący',
    ],
    ['przerwany wariant', '1. Pytanie?\nA. Alfa\nB.', 'Przerwany'],
    ['duplikat litery', '1. Pytanie?\nA. Alfa\nA. Beta', 'Powtórzone'],
    ['jeden wariant', '1. Pytanie?\nA. Alfa', 'dwóch'],
    ['puste pytanie', '1.\nA. Alfa\nB. Beta', 'Puste'],
  ])('blokuje %s i lokalizuje problem', (_nazwa, tekst, opis) => {
    const raport = parsujTekst(tekst);
    oczekuj(
      raport.problemy.some(
        (problem) =>
          problem.poziom === 'blad' &&
          problem.opis.includes(opis) &&
          problem.od === 1 &&
          problem.do === tekst.split('\n').length &&
          problem.rozwiazanie.length > 0,
      ),
    ).toBe(true);
    oczekuj(() => przygotuj(tekst)).toThrow('Popraw błędy');
    oczekuj(raport.oryginal).toBe(tekst);
  });

  sprawdz(
    'normalizuje CRLF, Unicode, spacje i kontynuacje z potwierdzeniem',
    () => {
      const tekst =
        '\uFEFF **1.  Zażółć gęślą jaźń?**\r\n A. Łódź\\\r\n   i źródło\r\n B. Ścieżka\r\n Sugestia: A —\r\n   łatwiejszy dostęp';
      const wynik = przygotuj(tekst);
      oczekuj(wynik.quiz?.pytania[0]).toMatchObject({
        tresc: 'Zażółć gęślą jaźń?',
        warianty: [{ etykieta: 'Łódź i źródło' }, { etykieta: 'Ścieżka' }],
        rekomendacja: { uzasadnienie: 'łatwiejszy dostęp' },
      });
      oczekuj(wynik.daneZrodlowe).toMatchObject({ oryginal: tekst });
    },
  );

  sprawdz('wymaga metadanych i potwierdzenia interpretacji', () => {
    const raport = parsujTekst(przykladUzytkownika);
    const zakres = raport.pytania.map((pytanie) => pytanie.id);
    oczekuj(() =>
      przygotujImportTekstu(
        raport,
        { tytul: '', jezyk: 'pl' },
        zakres,
        true,
        false,
      ),
    ).toThrow('tytuł');
    oczekuj(() =>
      przygotujImportTekstu(
        raport,
        { tytul: 'Quiz', jezyk: '' },
        zakres,
        true,
        false,
      ),
    ).toThrow('język');
    oczekuj(() =>
      przygotujImportTekstu(
        raport,
        { tytul: 'Quiz', jezyk: 'pl' },
        zakres,
        false,
        false,
      ),
    ).toThrow('interpretację');
  });

  sprawdz(
    'zachowuje błędne fragmenty, wymaga jawnego zakresu, odczytuje oryginał z IndexedDB',
    async () => {
      const poprzedniaBaza = globalThis.indexedDB;
      globalThis.indexedDB = new FabrykaBazy();
      try {
        const tekst = `${przykladUzytkownika}\n\n2. Uszkodzone?\nA. Jedyny\nB.`;
        const raport = parsujTekst(tekst);
        const zakres = [raport.pytania[0]!.id];
        oczekuj(() =>
          przygotujImportTekstu(
            raport,
            { tytul: 'Quiz', jezyk: 'pl' },
            zakres,
            true,
            false,
          ),
        ).toThrow('częściowy');
        const wynik = przygotujImportTekstu(
          raport,
          { tytul: 'Quiz', jezyk: 'pl' },
          zakres,
          true,
          true,
        );
        oczekuj(wynik.daneZrodlowe).toMatchObject({
          oryginal: tekst,
          niekompletny: true,
          zakres,
          raport: {
            pytania: oczekuj.arrayContaining([
              oczekuj.objectContaining({ tresc: 'Uszkodzone?' }),
            ]),
          },
        });
        await zapiszZatwierdzonyQuiz(wynik);
        oczekuj((await odczytajBiblioteke())[0]).toEqual({
          quiz: wynik.quiz,
          daneZrodlowe: wynik.daneZrodlowe,
        });
      } finally {
        globalThis.indexedDB = poprzedniaBaza;
      }
    },
  );

  sprawdz(
    'pusty i nierozpoznany tekst zachowuje się w raporcie bez importu',
    () => {
      for (const tekst of ['', 'A. Osierocony wariant\n???']) {
        const raport = parsujTekst(tekst);
        oczekuj(raport.oryginal).toBe(tekst);
        oczekuj(
          raport.problemy.some((problem) => problem.poziom === 'blad'),
        ).toBe(true);
        oczekuj(() => przygotuj(tekst)).toThrow();
      }
    },
  );

  sprawdz('ID pozostają stałe przy ponownej konwersji i zmianie tytułu', () => {
    const raport = parsujTekst(piecPytan);
    const zakres = raport.pytania.map((pytanie) => pytanie.id);
    const pierwszy = przygotujImportTekstu(
      raport,
      { tytul: 'Quiz', jezyk: 'pl' },
      zakres,
      true,
      false,
    );
    const drugi = przygotujImportTekstu(
      raport,
      { tytul: 'Inny tytuł', jezyk: 'pl' },
      zakres,
      true,
      false,
    );
    oczekuj(pierwszy.quiz?.id).toBe(drugi.quiz?.id);
    oczekuj(pierwszy.quiz?.pytania).toEqual(drugi.quiz?.pytania);
    const identyfikatory = raport.pytania.flatMap((pytanie) => [
      pytanie.id,
      ...pytanie.warianty.map((wariant) => wariant.id),
    ]);
    oczekuj(new Set(identyfikatory).size).toBe(identyfikatory.length);
  });

  sprawdz.each(['txt', 'md'])('czyta plik %s w UTF-8', async (rozszerzenie) => {
    const tekst = await odczytajTekstPliku(
      new File([piecPytan], `quiz.${rozszerzenie}`),
    );
    oczekuj(tekst).toBe(piecPytan);
    oczekuj(przygotuj(tekst).quiz?.pytania).toHaveLength(5);
  });

  sprawdz(
    'korekta wymaga potwierdzenia pełnego źródła albo częściowego importu',
    () => {
      const oryginal = '1. Pytanie?\nA. Alfa\nB. Beta';
      const raport = parsujTekst(oryginal.replace('Alfa', 'Poprawiona alfa'));
      const zakres = raport.pytania.map((pytanie) => pytanie.id);
      const metadane = { tytul: 'Quiz', jezyk: 'pl' };
      oczekuj(() =>
        przygotujImportTekstu(raport, metadane, zakres, true, false, oryginal),
      ).toThrow('częściowy');
      oczekuj(
        przygotujImportTekstu(raport, metadane, zakres, true, true, oryginal)
          .daneZrodlowe,
      ).toMatchObject({ niekompletny: true });
      oczekuj(
        przygotujImportTekstu(
          raport,
          metadane,
          zakres,
          true,
          false,
          oryginal,
          true,
        ).daneZrodlowe,
      ).toMatchObject({
        niekompletny: false,
        potwierdzonoPelnyZakresKorekty: true,
      });
      const szerszeZrodlo = `${oryginal}\n2. Drugie?\nA. Pierwszy\nB. Drugi`;
      oczekuj(() =>
        przygotujImportTekstu(
          raport,
          metadane,
          zakres,
          true,
          false,
          szerszeZrodlo,
          true,
        ),
      ).toThrow('częściowy');
    },
  );

  sprawdz('zachowuje osierocony fragment i blokuje niepoprawny zakres', () => {
    const raport = parsujTekst('A. Osierocony\n1. Pytanie?\nA. Alfa\nB. Beta');
    const zakres = raport.pytania.map((pytanie) => pytanie.id);
    const metadane = { tytul: 'Quiz', jezyk: 'pl' };
    oczekuj(() =>
      przygotujImportTekstu(raport, metadane, zakres, true, false),
    ).toThrow('częściowy');
    oczekuj(
      przygotujImportTekstu(raport, metadane, zakres, true, true).daneZrodlowe,
    ).toMatchObject({ niekompletny: true });
    for (const zlyZakres of [
      [],
      ['nieistniejace-id'],
      [...zakres, ...zakres],
    ]) {
      oczekuj(() =>
        przygotujImportTekstu(raport, metadane, zlyZakres, true, true),
      ).toThrow('zakres');
    }
  });

  sprawdz('nie dołącza uszkodzonej sugestii do treści wariantu', () => {
    const raport = parsujTekst('1. Pytanie?\nA. Alfa\nB. Beta\nSugestia: ??');
    oczekuj(raport.pytania[0]?.warianty[1]?.etykieta).toBe('Beta');
    oczekuj(raport.problemy).toContainEqual(
      oczekuj.objectContaining({
        od: 4,
        do: 4,
        poziom: 'blad',
        kategoria: 'rekomendacja',
      }),
    );
  });
});
