import {
  useEffect as poZmianie,
  useRef as referencja,
  useState as stan,
} from 'react';
import { Link as Odnosnik, useParams as parametry } from 'react-router-dom';
import { odczytajBiblioteke } from '../dane/biblioteka';
import { odczytajSesje, zapiszSesje } from '../dane/sesje';
import { odczytajRekomendacje } from '../dane/ustawienia';
import {
  biezacePytanie,
  przejdzDalej,
  przejdzWstecz,
  sprawdzObslugePytania,
  wybierzWariant,
  wybranyWariant,
} from '../silnik/runtime';
import type { StanQuizu, Wynik } from '../silnik/runtime';
import {
  aktualizujSesje,
  odlozPytanie,
  wrocDoPytania,
  wznowSesje,
} from '../silnik/sesja';
import type { PrzebiegSesji } from '../silnik/sesja';
import type { Decyzja } from '../domena/sesja';
import type { Quiz } from '../domena/quiz';

function opisDecyzji(quiz: Quiz, decyzja: Decyzja | null): string {
  if (!decyzja) return 'Brak odpowiedzi';
  if (decyzja.odpowiedz.rodzaj === 'wlasna') return decyzja.odpowiedz.tekst;
  return decyzja.odpowiedz.wartosci
    .map((wartosc) => {
      if (wartosc.rodzaj !== 'pojedynczyWybor') return 'Inny sposób odpowiedzi';
      return (
        quiz.pytania
          .find((pytanie) => pytanie.id === decyzja.pytanieId)
          ?.warianty.find((wariant) => wariant.id === wartosc.wariantId)
          ?.etykieta ?? 'Nieznany wariant'
      );
    })
    .join(', ');
}

export function EkranQuizu() {
  const { sesjaId } = parametry();
  return <WczytanyQuiz key={sesjaId} sesjaId={sesjaId ?? ''} />;
}

function WczytanyQuiz({ sesjaId }: { sesjaId: string }) {
  const [wynik, ustawWynik] = stan<Wynik<PrzebiegSesji> | null>(null);
  const [proba, ustawProbe] = stan(0);
  poZmianie(() => {
    let aktualne = true;
    Promise.all([odczytajBiblioteke(), odczytajSesje()]).then(
      ([wpisy, sesje]) => {
        if (!aktualne) return;
        const sesja = sesje.find((sesja) => sesja.id === sesjaId);
        const wpis = wpisy.find(({ quiz }) => quiz.id === sesja?.quizId);
        ustawWynik(
          wpis && sesja
            ? wznowSesje(wpis.quiz, sesja)
            : {
                stan: 'blad',
                opis: 'Nie znaleziono sesji lub jej definicji quizu.',
              },
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
  }, [sesjaId, proba]);
  if (wynik?.stan === 'gotowy')
    return <PrzebiegQuizu poczatek={wynik.wartosc} />;
  return (
    <section className="panel">
      <h1>Uruchamianie quizu</h1>
      {wynik ? (
        <>
          <p role="alert">{wynik.opis}</p>
          <button
            className="przycisk"
            onClick={() => {
              ustawWynik(null);
              ustawProbe(proba + 1);
            }}
          >
            Ponów odczyt
          </button>
        </>
      ) : (
        <p role="status">Wczytywanie quizu…</p>
      )}
      <Odnosnik className="przycisk" to="/biblioteka">
        Wróć do Biblioteki
      </Odnosnik>
    </section>
  );
}

function PrzebiegQuizu({ poczatek }: { poczatek: PrzebiegSesji }) {
  const [zapisany, ustawZapisany] = stan(poczatek);
  const przebieg = zapisany.przebieg;
  const [blad, ustawBlad] = stan('');
  const [oczekujacy, ustawOczekujacy] = stan<PrzebiegSesji | null>(null);
  const [zapisywanie, ustawZapisywanie] = stan(false);
  const trwaZapis = referencja(false);
  const [pokazuj] = stan(odczytajRekomendacje);
  const naglowek = referencja<HTMLHeadingElement>(null);
  const pytanie = biezacePytanie(przebieg);
  const wybrany = wybranyWariant(przebieg);
  const obsluga = pytanie ? sprawdzObslugePytania(pytanie) : null;
  poZmianie(() => {
    naglowek.current?.focus();
  }, [przebieg.indeksPytania]);

  poZmianie(() => {
    if (!oczekujacy) return;
    function ostrzez(zdarzenie: BeforeUnloadEvent) {
      zdarzenie.preventDefault();
      zdarzenie.returnValue = '';
    }
    window.addEventListener('beforeunload', ostrzez);
    return () => window.removeEventListener('beforeunload', ostrzez);
  }, [oczekujacy]);

  async function utrwal(kandydat: PrzebiegSesji) {
    if (trwaZapis.current) return;
    trwaZapis.current = true;
    ustawOczekujacy(kandydat);
    ustawZapisywanie(true);
    ustawBlad('');
    try {
      await zapiszSesje(kandydat.sesja, zapisany.sesja);
      ustawZapisany(kandydat);
      ustawOczekujacy(null);
    } catch (blad) {
      ustawBlad(blad instanceof Error ? blad.message : 'Nie zapisano sesji.');
    } finally {
      trwaZapis.current = false;
      ustawZapisywanie(false);
    }
  }

  function zastosujSesje(wynik: Wynik<PrzebiegSesji>) {
    if (oczekujacy || trwaZapis.current) return;
    if (wynik.stan === 'gotowy') void utrwal(wynik.wartosc);
    else ustawBlad(wynik.opis);
  }

  function zastosuj(wynik: Wynik<StanQuizu>) {
    zastosujSesje(aktualizujSesje(zapisany, wynik, new Date().toISOString()));
  }

  return (
    <section className="panel ekran-quizu" aria-label={przebieg.quiz.tytul}>
      <p className="nadtytul">{przebieg.quiz.tytul}</p>
      <h1 ref={naglowek} tabIndex={-1}>
        {pytanie?.tresc ??
          (zapisany.sesja.stan === 'zakonczona'
            ? 'Quiz zakończony'
            : 'Pytania odłożone')}
      </h1>
      <p className="informacja" role="status">
        {zapisywanie
          ? 'Zapisywanie postępu…'
          : oczekujacy
            ? 'Zmiana nie została zapisana. Ekran pokazuje poprzedni poprawny stan.'
            : 'Postęp zapisany lokalnie.'}
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
                        aria-disabled={oczekujacy !== null}
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
          {zapisany.sesja.stan === 'zakonczona'
            ? 'Odpowiedzi na wszystkie pytania zostały zapisane.'
            : 'Zestaw został przejrzany. Przed zakończeniem wróć do odłożonych pytań.'}
        </p>
      )}
      {blad && <p role="alert">{blad}</p>}
      <details className="historia-decyzji">
        <summary>Historia decyzji</summary>
        <p>
          Historia pokazuje, jak powstały decyzje. Aktualny wybór jest oznaczony
          osobno przy wariancie.
        </p>
        {(zapisany.sesja.dziennikSesji?.baza.historiaDecyzji.length ?? 0) >
          0 && (
          <>
            <h2>Audyt sprzed migracji</h2>
            <p>
              Zachowano wcześniejsze decyzje. Dawny zapis nie zawierał pełnej
              kolejności zmian.
            </p>
            <ul>
              {zapisany.sesja.dziennikSesji?.baza.historiaDecyzji.map(
                (decyzja) => (
                  <li key={decyzja.id}>
                    {
                      przebieg.quiz.pytania.find(
                        (pytanie) => pytanie.id === decyzja.pytanieId,
                      )?.tresc
                    }
                    : {opisDecyzji(przebieg.quiz, decyzja)} —{' '}
                    {new Date(decyzja.zatwierdzono).toLocaleString('pl-PL')}
                  </li>
                ),
              )}
            </ul>
          </>
        )}
        <ol>
          {zapisany.sesja.dziennikSesji?.zdarzenia
            .filter((zdarzenie) => zdarzenie.rodzaj !== 'nawigacja')
            .map((zdarzenie) => (
              <li key={zdarzenie.kolejnosc} value={zdarzenie.kolejnosc}>
                <p>
                  {
                    przebieg.quiz.pytania.find(
                      (pytanie) => pytanie.id === zdarzenie.pytanieId,
                    )?.tresc
                  }
                </p>
                <p>
                  Poprzednio:{' '}
                  {opisDecyzji(przebieg.quiz, zdarzenie.poprzedniaDecyzja)}.
                  Teraz:{' '}
                  {zdarzenie.rodzaj === 'decyzja'
                    ? opisDecyzji(przebieg.quiz, zdarzenie.nowaDecyzja)
                    : 'Odłożone'}
                  .
                </p>
                <p>
                  Operacja {zdarzenie.kolejnosc} ·{' '}
                  {new Date(zdarzenie.czas).toLocaleString('pl-PL')}
                </p>
              </li>
            ))}
        </ol>
      </details>
      {oczekujacy && !zapisywanie && (
        <button className="przycisk" onClick={() => void utrwal(oczekujacy)}>
          Ponów zapis
        </button>
      )}
      {zapisany.sesja.odlozonePytaniaId.length > 0 && (
        <section aria-label="Lista odłożonych pytań">
          <h2>Odłożone pytania</h2>
          <ul>
            {przebieg.quiz.pytania
              .filter((pytanie) =>
                zapisany.sesja.odlozonePytaniaId.includes(pytanie.id),
              )
              .map((pytanie) => (
                <li key={pytanie.id}>
                  <button
                    className="przycisk drugorzedny"
                    disabled={oczekujacy !== null}
                    onClick={() =>
                      zastosujSesje(
                        wrocDoPytania(
                          zapisany,
                          pytanie.id,
                          new Date().toISOString(),
                        ),
                      )
                    }
                  >
                    Wróć do pytania: {pytanie.tresc}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
      <div className="nawigacja-quizu">
        <button
          className="przycisk"
          disabled={przebieg.indeksPytania === 0 || oczekujacy !== null}
          onClick={() => {
            zastosuj({ stan: 'gotowy', wartosc: przejdzWstecz(przebieg) });
          }}
        >
          Wstecz
        </button>
        {pytanie && (
          <button
            className="przycisk"
            disabled={
              obsluga?.stan !== 'gotowy' ||
              wybrany === null ||
              oczekujacy !== null
            }
            onClick={() => zastosuj(przejdzDalej(przebieg))}
          >
            Dalej
          </button>
        )}
        {pytanie && (
          <button
            className="przycisk drugorzedny"
            disabled={oczekujacy !== null}
            onClick={() =>
              zastosujSesje(odlozPytanie(zapisany, new Date().toISOString()))
            }
          >
            Wróć później
          </button>
        )}
      </div>
      <Odnosnik className="przycisk drugorzedny" to="/biblioteka">
        Wróć do Biblioteki
      </Odnosnik>
    </section>
  );
}
