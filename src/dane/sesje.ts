import { schematSesji } from '../domena/sesja';
import type { Sesja } from '../domena/sesja';
import { wznowSesje } from '../silnik/sesja';
import { uzupelnijDziennik, zachowujeAudyt } from '../silnik/replay';
import { otworzBiblioteke } from './biblioteka';
import type { WpisBiblioteki } from './biblioteka';

export async function odczytajSesje(): Promise<Sesja[]> {
  const baza = await otworzBiblioteke();
  try {
    return await new Promise((zakoncz, odrzuc) => {
      const transakcja = baza.transaction('sesje', 'readonly');
      const zadanie = transakcja.objectStore('sesje').getAll();
      transakcja.onabort = () => odrzuc(new Error('Nie można odczytać sesji.'));
      transakcja.oncomplete = () => {
        const wynik = schematSesji.array().safeParse(zadanie.result);
        if (wynik.success) zakoncz(wynik.data);
        else odrzuc(new Error('Niepoprawne dane zapisanych sesji.'));
      };
    });
  } finally {
    baza.close();
  }
}

export async function zapiszSesje(
  sesja: Sesja,
  poprzednia: Sesja | null,
): Promise<void> {
  const poprawna = uzupelnijDziennik(schematSesji.parse(sesja));
  const baza = await otworzBiblioteke();
  try {
    await new Promise<void>((zakoncz, odrzuc) => {
      const transakcja = baza.transaction(['quizy', 'sesje'], 'readwrite');
      let opis =
        'Nie zapisano sesji. Poprzedni poprawny stan pozostał w magazynie.';
      transakcja.oncomplete = () => zakoncz();
      transakcja.onabort = () => odrzuc(new Error(opis));
      const magazyn = transakcja.objectStore('sesje');
      const quiz = transakcja.objectStore('quizy').get(poprawna.quizId);
      quiz.onsuccess = () => {
        try {
          const wpis = quiz.result as WpisBiblioteki | undefined;
          if (!wpis)
            throw new Error('Nie znaleziono definicji quizu dla sesji.');
          const wynik = wznowSesje(wpis.quiz, poprawna);
          if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
          const odczyt = magazyn.get(poprawna.id);
          odczyt.onsuccess = () => {
            const odczytane = schematSesji.safeParse(odczyt.result);
            const zapisane = odczytane.success ? odczytane.data : undefined;
            if (
              (poprzednia === null && odczyt.result !== undefined) ||
              (poprzednia !== null &&
                (JSON.stringify(zapisane) !== JSON.stringify(poprzednia) ||
                  poprawna.id !== poprzednia.id ||
                  poprawna.quizId !== poprzednia.quizId ||
                  poprawna.wersjaQuizu !== poprzednia.wersjaQuizu ||
                  poprawna.utworzono !== poprzednia.utworzono))
            ) {
              opis =
                'Sesja zmieniła się w innej karcie. Wczytaj ją ponownie przed dalszą edycją.';
              transakcja.abort();
              return;
            }
            if (poprzednia && !zachowujeAudyt(poprzednia, poprawna)) {
              opis =
                'Zapis nie może usuwać ani zmieniać wcześniejszego audytu sesji.';
              transakcja.abort();
              return;
            }
            try {
              magazyn.put(poprawna);
            } catch {
              transakcja.abort();
            }
          };
        } catch (blad) {
          opis = blad instanceof Error ? blad.message : opis;
          transakcja.abort();
        }
      };
    });
  } finally {
    baza.close();
  }
}
