import { useEffect as poZmianie, useState as stan } from 'react';
import { Link as Odnosnik } from 'react-router-dom';
import { odczytajBiblioteke } from '../dane/biblioteka';
import type { WpisBiblioteki } from '../dane/biblioteka';

export function Biblioteka() {
  const [wpisy, ustawWpisy] = stan<WpisBiblioteki[] | null>(null);
  const [blad, ustawBlad] = stan('');
  const [proba, ustawProbe] = stan(0);
  poZmianie(() => {
    let aktualne = true;
    odczytajBiblioteke().then(
      (dane) => {
        if (aktualne) ustawWpisy(dane);
      },
      () => {
        if (aktualne) ustawBlad('Nie można odczytać lokalnej biblioteki.');
      },
    );
    return () => {
      aktualne = false;
    };
  }, [proba]);
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
              <Odnosnik
                className="przycisk"
                to={`/quiz/${encodeURIComponent(quiz.id)}`}
              >
                Rozpocznij quiz
              </Odnosnik>
            </li>
          ))}
        </ul>
      )}
      <Odnosnik className="przycisk" to="/import">
        Importuj quiz
      </Odnosnik>
      <p className="informacja">
        Quizy uruchamiają się z roboczym postępem w pamięci. Trwałe sesje są w
        przygotowaniu.
      </p>
    </section>
  );
}
