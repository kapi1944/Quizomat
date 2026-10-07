import {
  useEffect as poZmianie,
  useRef as referencja,
  useState as stan,
} from 'react';
import { Link as Odnosnik, useParams as parametry } from 'react-router-dom';
import { odczytajBiblioteke } from '../dane/biblioteka';
import { odczytajRekomendacje } from '../dane/ustawienia';
import {
  biezacePytanie,
  przejdzDalej,
  przejdzWstecz,
  rozpocznijQuiz,
  sprawdzObslugePytania,
  wybierzWariant,
  wybranyWariant,
} from '../silnik/runtime';
import type { StanQuizu, Wynik } from '../silnik/runtime';

export function EkranQuizu() {
  const { quizId } = parametry();
  return <WczytanyQuiz key={quizId} quizId={quizId ?? ''} />;
}

function WczytanyQuiz({ quizId }: { quizId: string }) {
  const [wynik, ustawWynik] = stan<Wynik<StanQuizu> | null>(null);
  poZmianie(() => {
    let aktualne = true;
    odczytajBiblioteke().then(
      (wpisy) => {
        if (!aktualne) return;
        const wpis = wpisy.find(({ quiz }) => quiz.id === quizId);
        ustawWynik(
          wpis
            ? rozpocznijQuiz(wpis.quiz)
            : { stan: 'blad', opis: 'Nie znaleziono tego quizu w Bibliotece.' },
        );
      },
      () => {
        if (aktualne)
          ustawWynik({
            stan: 'blad',
            opis: 'Nie można odczytać lokalnej biblioteki.',
          });
      },
    );
    return () => {
      aktualne = false;
    };
  }, [quizId]);
  if (wynik?.stan === 'gotowy')
    return <PrzebiegQuizu poczatek={wynik.wartosc} />;
  return (
    <section className="panel">
      <h1>Uruchamianie quizu</h1>
      {wynik ? (
        <p role="alert">{wynik.opis}</p>
      ) : (
        <p role="status">Wczytywanie quizu…</p>
      )}
      <Odnosnik className="przycisk" to="/biblioteka">
        Wróć do Biblioteki
      </Odnosnik>
    </section>
  );
}

function PrzebiegQuizu({ poczatek }: { poczatek: StanQuizu }) {
  const [przebieg, ustawPrzebieg] = stan(poczatek);
  const [blad, ustawBlad] = stan('');
  const [pokazuj] = stan(odczytajRekomendacje);
  const naglowek = referencja<HTMLHeadingElement>(null);
  const pytanie = biezacePytanie(przebieg);
  const wybrany = wybranyWariant(przebieg);
  const obsluga = pytanie ? sprawdzObslugePytania(pytanie) : null;
  poZmianie(() => {
    naglowek.current?.focus();
  }, [przebieg.indeksPytania]);

  function zastosuj(wynik: Wynik<StanQuizu>) {
    if (wynik.stan === 'gotowy') {
      ustawPrzebieg(wynik.wartosc);
      ustawBlad('');
    } else ustawBlad(wynik.opis);
  }

  return (
    <section className="panel ekran-quizu" aria-label={przebieg.quiz.tytul}>
      <p className="nadtytul">{przebieg.quiz.tytul}</p>
      <h1 ref={naglowek} tabIndex={-1}>
        {pytanie?.tresc ?? 'Quiz zakończony'}
      </h1>
      <p className="informacja">
        Postęp jest roboczy. Opuszczenie ekranu lub odświeżenie strony
        rozpocznie quiz od nowa.
      </p>
      {pytanie ? (
        <>
          <p>
            Pytanie {przebieg.indeksPytania + 1} z{' '}
            {przebieg.quiz.pytania.length}
          </p>
          {pytanie.wyjasnienie && <p>{pytanie.wyjasnienie}</p>}
          {obsluga?.stan !== 'gotowy' ? (
            <p role="status">{obsluga?.opis}</p>
          ) : (
            <>
              <div
                className="warianty"
                role="group"
                aria-label="Warianty odpowiedzi"
              >
                {pytanie.warianty.map((wariant) => {
                  const rekomendowany =
                    pokazuj && pytanie.rekomendacja?.wariantId === wariant.id;
                  const zaznaczony = wybrany === wariant.id;
                  return (
                    <article
                      key={wariant.id}
                      className={`wariant${rekomendowany ? ' rekomendowany' : ''}${zaznaczony ? ' wybrany' : ''}`}
                    >
                      <h2>{wariant.etykieta}</h2>
                      {rekomendowany && (
                        <p className="oznaczenie-rekomendacji">
                          Rekomendacja autora:{' '}
                          {pytanie.rekomendacja?.uzasadnienie}
                        </p>
                      )}
                      {wariant.opis && <p>{wariant.opis}</p>}
                      {(['zalety', 'wady', 'konsekwencje'] as const).map(
                        (pole) =>
                          wariant[pole]?.length ? (
                            <div key={pole}>
                              <h3>
                                {
                                  {
                                    zalety: 'Zalety',
                                    wady: 'Wady',
                                    konsekwencje: 'Konsekwencje',
                                  }[pole]
                                }
                              </h3>
                              <ul>
                                {wariant[pole].map((tekst, indeks) => (
                                  <li key={indeks}>{tekst}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null,
                      )}
                      {wariant.wyjasnienie && <p>{wariant.wyjasnienie}</p>}
                      <button
                        className="przycisk"
                        aria-pressed={zaznaczony}
                        aria-label={`Wybierz: ${wariant.etykieta}`}
                        onClick={() =>
                          zastosuj(
                            wybierzWariant(przebieg, wariant.id, {
                              id: crypto.randomUUID(),
                              zatwierdzono: new Date().toISOString(),
                            }),
                          )
                        }
                      >
                        {zaznaczony ? 'Twój wybór' : 'Wybierz'}
                      </button>
                    </article>
                  );
                })}
              </div>
              {pytanie.innaOdpowiedz && (
                <p>
                  {pytanie.innaOdpowiedz.etykieta}: odpowiedź własna jest
                  nieobsługiwana w aktualnej wersji. Wymaga analizy i
                  potwierdzenia.
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <p role="status">
          Odpowiedzi na wszystkie pytania zostały wybrane. Wynik pozostaje w
          pamięci do opuszczenia ekranu.
        </p>
      )}
      {blad && <p role="alert">{blad}</p>}
      <div className="nawigacja-quizu">
        <button
          className="przycisk"
          disabled={przebieg.indeksPytania === 0}
          onClick={() => {
            ustawPrzebieg(przejdzWstecz(przebieg));
            ustawBlad('');
          }}
        >
          Wstecz
        </button>
        {pytanie && (
          <button
            className="przycisk"
            disabled={obsluga?.stan !== 'gotowy' || wybrany === null}
            onClick={() => zastosuj(przejdzDalej(przebieg))}
          >
            Dalej
          </button>
        )}
      </div>
      <Odnosnik className="przycisk drugorzedny" to="/biblioteka">
        Wróć do Biblioteki
      </Odnosnik>
    </section>
  );
}
