import {
  IDBFactory as FabrykaBazy,
  IDBObjectStore as Magazyn,
} from 'fake-indexeddb';
import {
  afterEach as poKazdym,
  beforeEach as przedKazdym,
  describe as opisz,
  expect as oczekuj,
  it as sprawdz,
  vi as atrapy,
} from 'vitest';
import {
  odczytajBiblioteke,
  otworzBiblioteke,
  zapiszZatwierdzonyQuiz,
} from '../../src/dane/biblioteka';
import { odczytajSesje, zapiszSesje } from '../../src/dane/sesje';
import { walidujImportQuizu } from '../../src/import/walidator';
import {
  aktualizujSesje,
  utworzSesje,
  wznowSesje,
} from '../../src/silnik/sesja';
import {
  migawkaSesji,
  odtworzSesje,
  uzupelnijDziennik,
} from '../../src/silnik/replay';
import { wybierzWariant } from '../../src/silnik/runtime';
import type { Wynik } from '../../src/silnik/runtime';
import { quizTekstowy } from '../domena/przyklady';

const czas = '2026-10-08T10:00:00.000Z';
function wartosc<T>(wynik: Wynik<T>): T {
  if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
  return wynik.wartosc;
}
przedKazdym(() => atrapy.stubGlobal('indexedDB', new FabrykaBazy()));
poKazdym(() => {
  atrapy.restoreAllMocks();
  atrapy.unstubAllGlobals();
});
async function zapiszQuiz() {
  await zapiszZatwierdzonyQuiz(
    walidujImportQuizu(JSON.stringify(quizTekstowy)),
  );
}

opisz('Ten sam magazyn IndexedDB: migracja i sesje', () => {
  sprawdz(
    'nieudana migracja wycofuje wszystkie zmiany i zachowuje stare rekordy',
    async () => {
      const stara = {
        ...wartosc(utworzSesje(quizTekstowy, 'a-poprawna', czas)).sesja,
      };
      delete stara.dziennikSesji;
      const uszkodzona = {
        ...stara,
        id: 'z-uszkodzona',
        decyzje: 'niepoprawny typ',
      };
      await new Promise<void>((zakoncz, odrzuc) => {
        const zadanie = indexedDB.open('quizomat', 2);
        zadanie.onupgradeneeded = () => {
          zadanie.result.createObjectStore('quizy', { keyPath: 'quiz.id' });
          zadanie.result
            .createObjectStore('sesje', { keyPath: 'id' })
            .createIndex('quizId', 'quizId');
        };
        zadanie.onerror = () => odrzuc(zadanie.error);
        zadanie.onsuccess = () => {
          const baza = zadanie.result;
          const transakcja = baza.transaction(['quizy', 'sesje'], 'readwrite');
          transakcja
            .objectStore('quizy')
            .add({ quiz: quizTekstowy, daneZrodlowe: quizTekstowy });
          transakcja.objectStore('sesje').add(stara);
          transakcja.objectStore('sesje').add(uszkodzona);
          transakcja.oncomplete = () => {
            baza.close();
            zakoncz();
          };
          transakcja.onabort = () => {
            baza.close();
            odrzuc(transakcja.error);
          };
        };
      });
      await oczekuj(otworzBiblioteke()).rejects.toThrow('Nie można otworzyć');
      await new Promise<void>((zakoncz, odrzuc) => {
        const zadanie = indexedDB.open('quizomat', 2);
        zadanie.onerror = () => odrzuc(zadanie.error);
        zadanie.onsuccess = () => {
          const baza = zadanie.result;
          oczekuj(baza.version).toBe(2);
          const transakcja = baza.transaction(['quizy', 'sesje'], 'readonly');
          const sesje = transakcja.objectStore('sesje').getAll();
          const quizy = transakcja.objectStore('quizy').getAll();
          transakcja.oncomplete = () => {
            try {
              oczekuj(sesje.result).toEqual([stara, uszkodzona]);
              oczekuj(quizy.result).toHaveLength(1);
              zakoncz();
            } catch (blad) {
              odrzuc(blad);
            } finally {
              baza.close();
            }
          };
        };
      });
    },
  );
  sprawdz(
    'migruje sesję v2 z pełnym dawnym audytem i rozszerzeniami, bez zgadywania zdarzeń',
    async () => {
      const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja-stara', czas));
      const pierwsza = wartosc(
        aktualizujSesje(
          poczatek,
          wybierzWariant(poczatek.przebieg, 'prosty', {
            id: 'decyzja-1',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      const druga = wartosc(
        aktualizujSesje(
          pierwsza,
          wybierzWariant(pierwsza.przebieg, 'szczegolowy', {
            id: 'decyzja-2',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      const stara = {
        ...druga.sesja,
        rozszerzenie: { uwaga: 'Zachowaj dane' },
      };
      delete stara.dziennikSesji;
      await new Promise<void>((zakoncz, odrzuc) => {
        const zadanie = indexedDB.open('quizomat', 2);
        zadanie.onupgradeneeded = () => {
          zadanie.result.createObjectStore('quizy', { keyPath: 'quiz.id' });
          zadanie.result
            .createObjectStore('sesje', { keyPath: 'id' })
            .createIndex('quizId', 'quizId');
        };
        zadanie.onerror = () => odrzuc(zadanie.error);
        zadanie.onsuccess = () => {
          const baza = zadanie.result;
          const transakcja = baza.transaction(['quizy', 'sesje'], 'readwrite');
          transakcja
            .objectStore('quizy')
            .add({ quiz: quizTekstowy, daneZrodlowe: quizTekstowy });
          transakcja.objectStore('sesje').add(stara);
          transakcja.oncomplete = () => {
            baza.close();
            zakoncz();
          };
          transakcja.onabort = () => {
            baza.close();
            odrzuc(transakcja.error);
          };
        };
      });
      const zapisana = (await odczytajSesje())[0]!;
      oczekuj(zapisana).toEqual(uzupelnijDziennik(stara));
      oczekuj(zapisana.dziennikSesji?.zdarzenia).toEqual([]);
      oczekuj(zapisana.dziennikSesji?.baza).toEqual(migawkaSesji(stara));
      oczekuj(wartosc(wznowSesje(quizTekstowy, zapisana)).sesja).toEqual(
        zapisana,
      );
      const wznowiona = wartosc(wznowSesje(quizTekstowy, zapisana));
      const zmiana = wartosc(
        aktualizujSesje(
          wznowiona,
          wybierzWariant(wznowiona.przebieg, 'prosty', {
            id: 'decyzja-3',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      await zapiszSesje(zmiana.sesja, zapisana);
      const poZmianie = (await odczytajSesje())[0]!;
      oczekuj(poZmianie.historiaDecyzji).toHaveLength(2);
      oczekuj(poZmianie.dziennikSesji?.zdarzenia).toHaveLength(1);
      oczekuj(poZmianie).toHaveProperty('rozszerzenie', stara.rozszerzenie);
      const ponownyOdczyt = await odczytajSesje();
      oczekuj(ponownyOdczyt).toEqual([poZmianie]);
      oczekuj(await odczytajBiblioteke()).toHaveLength(1);
    },
  );

  sprawdz(
    'nie pozwala usuwać ani przepisywać już zapisanego audytu',
    async () => {
      await zapiszQuiz();
      const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
      await zapiszSesje(poczatek.sesja, null);
      const pierwsza = wartosc(
        aktualizujSesje(
          poczatek,
          wybierzWariant(poczatek.przebieg, 'prosty', {
            id: 'decyzja-1',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      await zapiszSesje(pierwsza.sesja, poczatek.sesja);
      const druga = wartosc(
        aktualizujSesje(
          pierwsza,
          wybierzWariant(pierwsza.przebieg, 'szczegolowy', {
            id: 'decyzja-2',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      await zapiszSesje(druga.sesja, pierwsza.sesja);
      const bezDziennika = { ...druga.sesja };
      delete bezDziennika.dziennikSesji;
      await oczekuj(
        zapiszSesje(uzupelnijDziennik(bezDziennika), druga.sesja),
      ).rejects.toThrow('audytu');
      const obcieta = wartosc(
        odtworzSesje(quizTekstowy, {
          ...druga.sesja,
          dziennikSesji: {
            ...druga.sesja.dziennikSesji!,
            zdarzenia: druga.sesja.dziennikSesji!.zdarzenia.slice(0, 1),
          },
        }),
      );
      await oczekuj(zapiszSesje(obcieta, druga.sesja)).rejects.toThrow(
        'audytu',
      );
      oczekuj(await odczytajSesje()).toEqual([druga.sesja]);
      oczekuj(
        wartosc(wznowSesje(quizTekstowy, (await odczytajSesje())[0])).sesja,
      ).toEqual(druga.sesja);
    },
  );
  sprawdz(
    'migruje prawdziwą bazę v1 do v3 bez utraty definicji ani rozszerzeń źródła',
    async () => {
      const wpis = {
        quiz: quizTekstowy,
        daneZrodlowe: { ...quizTekstowy, rozszerzenieAutora: 'Zachowaj' },
      };
      await new Promise<void>((zakoncz, odrzuc) => {
        const zadanie = indexedDB.open('quizomat', 1);
        zadanie.onupgradeneeded = () =>
          zadanie.result.createObjectStore('quizy', { keyPath: 'quiz.id' });
        zadanie.onerror = () => odrzuc(zadanie.error);
        zadanie.onsuccess = () => {
          const baza = zadanie.result;
          const transakcja = baza.transaction('quizy', 'readwrite');
          transakcja.objectStore('quizy').add(wpis);
          transakcja.oncomplete = () => {
            baza.close();
            zakoncz();
          };
          transakcja.onabort = () => {
            baza.close();
            odrzuc(transakcja.error);
          };
        };
      });
      oczekuj(await odczytajBiblioteke()).toEqual([wpis]);
      oczekuj(await odczytajSesje()).toEqual([]);
      const baza = await otworzBiblioteke();
      oczekuj(baza.name).toBe('quizomat');
      oczekuj(baza.version).toBe(3);
      oczekuj([...baza.objectStoreNames]).toEqual(['quizy', 'sesje']);
      baza.close();
      const nowa = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
      await zapiszSesje(nowa.sesja, null);
      oczekuj(await odczytajSesje()).toEqual([nowa.sesja]);
      oczekuj(await odczytajBiblioteke()).toEqual([wpis]);
    },
  );

  sprawdz(
    'przechowuje wiele niezależnych sesji jednego quizu bez kopiowania definicji',
    async () => {
      await zapiszQuiz();
      const pierwsza = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
      const druga = wartosc(utworzSesje(quizTekstowy, 'sesja-2', czas));
      await zapiszSesje(pierwsza.sesja, null);
      await zapiszSesje(druga.sesja, null);
      const wybrana = wartosc(
        aktualizujSesje(
          pierwsza,
          wybierzWariant(pierwsza.przebieg, 'prosty', {
            id: 'decyzja-1',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      await zapiszSesje(wybrana.sesja, pierwsza.sesja);
      oczekuj(await odczytajSesje()).toEqual([wybrana.sesja, druga.sesja]);
      oczekuj(wybrana.sesja).not.toHaveProperty('quiz');
      oczekuj(await odczytajBiblioteke()).toHaveLength(1);
    },
  );

  sprawdz(
    'abort po zgłoszeniu zapisu przywraca poprzedni stan i pozwala ponowić',
    async () => {
      await zapiszQuiz();
      const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
      await zapiszSesje(poczatek.sesja, null);
      const wybrana = wartosc(
        aktualizujSesje(
          poczatek,
          wybierzWariant(poczatek.przebieg, 'prosty', {
            id: 'decyzja-1',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      const oryginalnyZapis = Magazyn.prototype.put;
      const awaria = atrapy
        .spyOn(Magazyn.prototype, 'put')
        .mockImplementation(function (this: IDBObjectStore, dane: unknown) {
          const zadanie = oryginalnyZapis.call(this, dane);
          this.transaction.abort();
          return zadanie;
        });
      await oczekuj(zapiszSesje(wybrana.sesja, poczatek.sesja)).rejects.toThrow(
        'Nie zapisano sesji',
      );
      oczekuj(await odczytajSesje()).toEqual([poczatek.sesja]);
      awaria.mockRestore();
      await zapiszSesje(wybrana.sesja, poczatek.sesja);
      oczekuj(await odczytajSesje()).toEqual([wybrana.sesja]);
    },
  );

  sprawdz(
    'nie nadpisuje tej samej sesji nieaktualnym stanem z innej karty',
    async () => {
      await zapiszQuiz();
      const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
      await zapiszSesje(poczatek.sesja, null);
      const pierwsza = wartosc(
        aktualizujSesje(
          poczatek,
          wybierzWariant(poczatek.przebieg, 'prosty', {
            id: 'decyzja-1',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      const druga = wartosc(
        aktualizujSesje(
          poczatek,
          wybierzWariant(poczatek.przebieg, 'szczegolowy', {
            id: 'decyzja-2',
            zatwierdzono: czas,
          }),
          czas,
        ),
      );
      await zapiszSesje(pierwsza.sesja, poczatek.sesja);
      await oczekuj(zapiszSesje(druga.sesja, poczatek.sesja)).rejects.toThrow(
        'innej karcie',
      );
      await oczekuj(zapiszSesje(poczatek.sesja, null)).rejects.toThrow(
        'innej karcie',
      );
      oczekuj(await odczytajSesje()).toEqual([pierwsza.sesja]);
    },
  );

  sprawdz(
    'odrzuca niezgodną wersję oraz nieistniejącą definicję przed zapisem',
    async () => {
      await zapiszQuiz();
      const poczatek = wartosc(utworzSesje(quizTekstowy, 'sesja-1', czas));
      await oczekuj(
        zapiszSesje({ ...poczatek.sesja, wersjaQuizu: '2.0.0' }, null),
      ).rejects.toThrow('tej samej wersji');
      await oczekuj(
        zapiszSesje({ ...poczatek.sesja, quizId: 'obcy' }, null),
      ).rejects.toThrow('Nie znaleziono definicji');
      oczekuj(await odczytajSesje()).toEqual([]);
    },
  );
});
