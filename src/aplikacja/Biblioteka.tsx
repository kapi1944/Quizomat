import {
  useEffect as poZmianie,
  useRef as referencja,
  useState as stan,
} from 'react';
import { Link as Odnosnik, useNavigate as nawigacja } from 'react-router-dom';
import { odczytajBiblioteke } from '../dane/biblioteka';
import type { WpisBiblioteki } from '../dane/biblioteka';
import { odczytajSesje, zapiszSesje } from '../dane/sesje';
import type { Sesja } from '../domena/sesja';
import type { Quiz } from '../domena/quiz';
import { utworzSesje } from '../silnik/sesja';

export function Biblioteka() {
  const [wpisy, ustawWpisy] = stan<WpisBiblioteki[] | null>(null);
  const [blad, ustawBlad] = stan('');
  const [proba, ustawProbe] = stan(0);
  const [sesje, ustawSesje] = stan<Sesja[]>([]);
  const [tworzenie, ustawTworzenie] = stan(false);
  const trwaTworzenie = referencja(false);
  const przejdz = nawigacja();
  poZmianie(() => {
    let aktualne = true;
    Promise.all([odczytajBiblioteke(), odczytajSesje()]).then(
      ([dane, zapisaneSesje]) => {
        if (aktualne) {
          ustawWpisy(dane);
          ustawSesje(zapisaneSesje);
        }
      },
      () => {
        if (aktualne) ustawBlad('Nie można odczytać lokalnej biblioteki.');
      },
    );
    return () => {
      aktualne = false;
    };
  }, [proba]);

  async function rozpocznijNowa(quiz: Quiz) {
    if (trwaTworzenie.current) return;
    trwaTworzenie.current = true;
    ustawTworzenie(true);
    try {
      const wynik = utworzSesje(
        quiz,
        crypto.randomUUID(),
        new Date().toISOString(),
      );
      if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
      await zapiszSesje(wynik.wartosc.sesja, null);
      przejdz(`/sesja/${encodeURIComponent(wynik.wartosc.sesja.id)}`);
    } catch (blad) {
      ustawBlad(
        blad instanceof Error ? blad.message : 'Nie można utworzyć sesji.',
      );
    } finally {
      trwaTworzenie.current = false;
      ustawTworzenie(false);
    }
  }
  return (
    <section className="panel">
      <h1>Biblioteka</h1>
      {blad ? (
        <div role="alert">
          <p>{blad}</p>
          <button
            className="przycisk"
            onClick={() => {
              ustawBlad('');
              ustawProbe(proba + 1);
            }}
          >
            Ponów odczyt
          </button>
        </div>
      ) : wpisy === null ? (
        <p role="status">Wczytywanie biblioteki…</p>
      ) : wpisy.length === 0 ? (
        <p>Biblioteka jest pusta. Zaimportuj i zatwierdź pierwszy quiz.</p>
      ) : (
        <ul>
          {wpisy.map(({ quiz }) => (
            <li key={quiz.id}>
              <h2>{quiz.tytul}</h2>
              {quiz.opis && <p>{quiz.opis}</p>}
              <p>{quiz.pytania.length} pytań</p>
              <button
                className="przycisk"
                disabled={tworzenie}
                onClick={() => void rozpocznijNowa(quiz)}
              >
                Rozpocznij nową
              </button>
              {sesje.some(
                (sesja) =>
                  sesja.quizId === quiz.id && sesja.stan === 'wTrakcie',
              ) ? (
                <ul aria-label={`Niedokończone sesje: ${quiz.tytul}`}>
                  {sesje
                    .filter(
                      (sesja) =>
                        sesja.quizId === quiz.id && sesja.stan === 'wTrakcie',
                    )
                    .sort((pierwsza, druga) =>
                      druga.zmieniono.localeCompare(pierwsza.zmieniono),
                    )
                    .map((sesja) => (
                      <li key={sesja.id}>
                        <p>
                          Rozpoczęta:{' '}
                          {new Date(sesja.utworzono).toLocaleString('pl-PL')}.
                          Ostatni zapis:{' '}
                          {new Date(sesja.zmieniono).toLocaleString('pl-PL')}.
                        </p>
                        <Odnosnik
                          className="przycisk"
                          to={`/sesja/${encodeURIComponent(sesja.id)}`}
                        >
                          Kontynuuj
                        </Odnosnik>
                      </li>
                    ))}
                </ul>
              ) : (
                <p>Brak niedokończonej sesji.</p>
              )}
              {sesje.some(
                (sesja) =>
                  sesja.quizId === quiz.id && sesja.stan === 'zakonczona',
              ) && (
                <ul aria-label={`Zakończone sesje: ${quiz.tytul}`}>
                  {sesje
                    .filter(
                      (sesja) =>
                        sesja.quizId === quiz.id && sesja.stan === 'zakonczona',
                    )
                    .map((sesja) => (
                      <li key={sesja.id}>
                        <p>
                          Zakończona ·{' '}
                          {new Date(sesja.zmieniono).toLocaleString('pl-PL')} ·
                          Nierozstrzygnięte: {sesja.odlozonePytaniaId.length}
                        </p>
                        <Odnosnik
                          className="przycisk"
                          to={`/sesja/${encodeURIComponent(sesja.id)}`}
                        >
                          Otwórz zakończoną sesję
                        </Odnosnik>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <Odnosnik className="przycisk" to="/import">
        Importuj quiz
      </Odnosnik>
      <p className="informacja">
        Każda sesja ma niezależny postęp zapisywany lokalnie.
      </p>
      {tworzenie && <p role="status">Zapisywanie nowej sesji…</p>}
    </section>
  );
}
