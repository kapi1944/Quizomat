import type { Quiz } from '../domena/quiz';
import type { WynikImportu } from '../import/walidator';
import { schematSesji } from '../domena/sesja';
import { uzupelnijDziennik } from '../silnik/replay';

export interface WpisBiblioteki {
  quiz: Quiz;
  daneZrodlowe: unknown;
}

export function otworzBiblioteke(): Promise<IDBDatabase> {
  return new Promise((zakoncz, odrzuc) => {
    if (typeof indexedDB === 'undefined') {
      odrzuc(
        new Error(
          'Lokalny magazyn jest niedostępny. Włącz zapis danych w przeglądarce i spróbuj ponownie.',
        ),
      );
      return;
    }
    let odrzucone = false;
    const zadanie = indexedDB.open('quizomat', 3);
    zadanie.onupgradeneeded = (zdarzenie) => {
      if (zdarzenie.oldVersion < 1)
        zadanie.result.createObjectStore('quizy', { keyPath: 'quiz.id' });
      if (zdarzenie.oldVersion < 2) {
        const sesje = zadanie.result.createObjectStore('sesje', {
          keyPath: 'id',
        });
        sesje.createIndex('quizId', 'quizId');
      }
      if (zdarzenie.oldVersion < 3) {
        const kursor = zadanie.transaction!.objectStore('sesje').openCursor();
        kursor.onsuccess = () => {
          if (!kursor.result) return;
          try {
            const sesja = schematSesji.parse(kursor.result.value);
            if (!sesja.dziennikSesji)
              kursor.result.update(uzupelnijDziennik(sesja));
            kursor.result.continue();
          } catch {
            zadanie.transaction!.abort();
          }
        };
      }
    };
    zadanie.onerror = () =>
      odrzuc(new Error('Nie można otworzyć lokalnej biblioteki.'));
    zadanie.onblocked = () => {
      odrzucone = true;
      odrzuc(
        new Error('Zamknij pozostałe karty Quizomatu i spróbuj ponownie.'),
      );
    };
    zadanie.onsuccess = () => {
      if (odrzucone) {
        zadanie.result.close();
        return;
      }
      zadanie.result.onversionchange = () => zadanie.result.close();
      zakoncz(zadanie.result);
    };
  });
}

export async function zapiszZatwierdzonyQuiz(
  wynik: WynikImportu,
): Promise<void> {
  if (wynik.stan === 'zablokowany' || wynik.raport.bledy.length > 0) {
    throw new Error('Błędy krytyczne blokują zapis quizu.');
  }
  const baza = await otworzBiblioteke();
  try {
    await new Promise<void>((zakoncz, odrzuc) => {
      const transakcja = baza.transaction('quizy', 'readwrite');
      transakcja.oncomplete = () => zakoncz();
      transakcja.onabort = () =>
        odrzuc(
          new Error(
            transakcja.error?.name === 'ConstraintError'
              ? 'Quiz o tym ID jest już w bibliotece. Nie zastąpiono istniejących danych.'
              : 'Nie zapisano quizu. Sprawdź dostępność lokalnego magazynu i spróbuj ponownie.',
          ),
        );
      transakcja.objectStore('quizy').add({
        quiz: wynik.quiz,
        daneZrodlowe: wynik.daneZrodlowe,
      } satisfies WpisBiblioteki);
    });
  } finally {
    baza.close();
  }
}

export async function odczytajBiblioteke(): Promise<WpisBiblioteki[]> {
  const baza = await otworzBiblioteke();
  try {
    return await new Promise((zakoncz, odrzuc) => {
      const transakcja = baza.transaction('quizy', 'readonly');
      const zadanie = transakcja.objectStore('quizy').getAll();
      transakcja.oncomplete = () => zakoncz(zadanie.result as WpisBiblioteki[]);
      transakcja.onabort = () =>
        odrzuc(new Error('Nie można odczytać biblioteki.'));
    });
  } finally {
    baza.close();
  }
}
