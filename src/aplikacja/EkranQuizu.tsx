import { OdpowiedzWlasna } from './OdpowiedzWlasna';
import { OdpowiedzStandardowa } from './OdpowiedzStandardowa';
import { PodsumowanieQuizu } from './PodsumowanieQuizu';
import { analizatorAutorski } from '../ai/analizator';
import type { Analizator } from '../ai/analizator';
import {
  useCallback as pamietajFunkcje,
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
  przejdzDoPytania,
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
      const etykieta = (id: string) =>
        [...quiz.pytania, ...quiz.pytaniaDodatkowe]
          .find((pytanie) => pytanie.id === decyzja.pytanieId)
          ?.warianty.find((wariant) => wariant.id === id)?.etykieta ?? id;
      switch (wartosc.rodzaj) {
        case 'pojedynczyWybor':
          return etykieta(wartosc.wariantId);
        case 'wielokrotnyWybor':
          return wartosc.wariantyId.map(etykieta).join(', ');
        case 'ranking':
          return wartosc.wariantyId
            .map((id, indeks) => `${indeks + 1}. ${etykieta(id)}`)
            .join(', ');
        case 'takNie':
          return wartosc.wartosc ? 'TAK' : 'NIE';
        case 'prawdaFalsz':
          return wartosc.wartosc ? 'PRAWDA' : 'FAŁSZ';
        case 'otwarta':
          return wartosc.tekst;
        case 'skala':
          return wartosc.cel === 'pytanie'
            ? String(wartosc.wartosc)
            : wartosc.oceny
                .map(
                  (ocena) => `${etykieta(ocena.wariantId)}: ${ocena.wartosc}`,
                )
                .join(', ');
        case 'kombinacjaWariantow':
          return wartosc.elementy
            .map(
              (element) =>
                `${etykieta(element.wariantId)}: ${element.fragment}`,
            )
            .join('; ');
      }
    })
    .join(', ');
}

export function EkranQuizu({
  analizator = analizatorAutorski,
}: { analizator?: Analizator } = {}) {
  const { sesjaId } = parametry();
  return (
    <WczytanyQuiz
      key={sesjaId}
      sesjaId={sesjaId ?? ''}
      analizator={analizator}
    />
  );
}

function WczytanyQuiz({
  sesjaId,
  analizator,
}: {
  sesjaId: string;
  analizator: Analizator;
}) {
  const [wynik, ustawWynik] = stan<Wynik<PrzebiegSesji> | null>(null);
  const [proba, ustawProbe] = stan(0);
  const [niekompletnyImport, ustawNiekompletnyImport] = stan(false);
  poZmianie(() => {
    let aktualne = true;
    Promise.all([odczytajBiblioteke(), odczytajSesje()]).then(
      ([wpisy, sesje]) => {
        if (!aktualne) return;
        const sesja = sesje.find((sesja) => sesja.id === sesjaId);
        const wpis = wpisy.find(({ quiz }) => quiz.id === sesja?.quizId);
        ustawNiekompletnyImport(
          typeof wpis?.daneZrodlowe === 'object' &&
            wpis.daneZrodlowe !== null &&
            'niekompletny' in wpis.daneZrodlowe &&
            wpis.daneZrodlowe.niekompletny === true,
        );
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
    return (
      <PrzebiegQuizu
        poczatek={wynik.wartosc}
        analizator={analizator}
        niekompletnyImport={niekompletnyImport}
      />
    );
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

function PrzebiegQuizu({
  poczatek,
  analizator,
  niekompletnyImport,
}: {
  poczatek: PrzebiegSesji;
  analizator: Analizator;
  niekompletnyImport: boolean;
}) {
  const [zapisany, ustawZapisany] = stan(poczatek);
  const aktualnyZapis = referencja(poczatek);
  const [tryb, ustawTryb] = stan<'pojedynczy' | 'pelny'>('pojedynczy');
  const [blokady, ustawBlokady] = stan<Record<string, boolean>>({});
  const blokadaSzkicu = Object.entries(blokady).some(
    ([klucz, wartosc]) => klucz.endsWith('-wlasna') && wartosc,
  );
  const blokadaStandardowa = Object.entries(blokady).some(
    ([klucz, wartosc]) => klucz.endsWith('-standardowa') && wartosc,
  );
  const ustawBlokadePytania = pamietajFunkcje(
    (klucz: string, blokada: boolean) => {
      ustawBlokady((poprzednie) =>
        poprzednie[klucz] === blokada
          ? poprzednie
          : { ...poprzednie, [klucz]: blokada },
      );
    },
    [],
  );
  const przebieg = zapisany.przebieg;
  const [blad, ustawBlad] = stan('');
  const [oczekujacy, ustawOczekujacy] = stan<PrzebiegSesji | null>(null);
  const [zapisywanie, ustawZapisywanie] = stan(false);
  const trwaZapis = referencja(false);
  const [pokazuj] = stan(odczytajRekomendacje);
  const naglowek = referencja<HTMLHeadingElement>(null);
  const pytanie = biezacePytanie(przebieg);
  const obsluga = pytanie ? sprawdzObslugePytania(pytanie) : null;
  poZmianie(() => {
    if (tryb === 'pojedynczy') naglowek.current?.focus();
  }, [przebieg.indeksPytania, tryb]);

  poZmianie(() => {
    if (!oczekujacy) return;
    function ostrzez(zdarzenie: BeforeUnloadEvent) {
      zdarzenie.preventDefault();
      zdarzenie.returnValue = '';
    }
    window.addEventListener('beforeunload', ostrzez);
    return () => window.removeEventListener('beforeunload', ostrzez);
  }, [oczekujacy]);

  poZmianie(() => {
    if (!blokadaStandardowa && !blokadaSzkicu && !oczekujacy) return;
    function zatrzymajWyjscie(zdarzenie: MouseEvent) {
      if (
        zdarzenie.target instanceof Element &&
        zdarzenie.target.closest('a[href]')
      ) {
        zdarzenie.preventDefault();
        ustawBlad(
          'Zapisz szkic lub poczekaj na zakończenie zapisu przed opuszczeniem sesji.',
        );
      }
    }
    document.addEventListener('click', zatrzymajWyjscie, true);
    return () => document.removeEventListener('click', zatrzymajWyjscie, true);
  }, [blokadaStandardowa, blokadaSzkicu, oczekujacy]);

  async function utrwal(kandydat: PrzebiegSesji) {
    if (trwaZapis.current) return false;
    trwaZapis.current = true;
    ustawOczekujacy(kandydat);
    ustawZapisywanie(true);
    ustawBlad('');
    try {
      await zapiszSesje(kandydat.sesja, aktualnyZapis.current.sesja);
      aktualnyZapis.current = kandydat;
      ustawZapisany(kandydat);
      ustawOczekujacy(null);
      return true;
    } catch (blad) {
      ustawBlad(blad instanceof Error ? blad.message : 'Nie zapisano sesji.');
      return false;
    } finally {
      trwaZapis.current = false;
      ustawZapisywanie(false);
    }
  }

  async function zapiszWlasna(wynik: Wynik<PrzebiegSesji>): Promise<boolean> {
    if (oczekujacy || trwaZapis.current) return false;
    if (wynik.stan !== 'gotowy') {
      ustawBlad(wynik.opis);
      return false;
    }
    return utrwal(wynik.wartosc);
  }

  function zastosujSesje(wynik: Wynik<PrzebiegSesji>) {
    if (oczekujacy || trwaZapis.current || blokadaSzkicu || blokadaStandardowa)
      return;
    if (wynik.stan === 'gotowy') void utrwal(wynik.wartosc);
    else ustawBlad(wynik.opis);
  }

  function zastosuj(wynik: Wynik<StanQuizu>) {
    zastosujSesje(aktualizujSesje(zapisany, wynik, new Date().toISOString()));
  }

  return (
    <section className="panel ekran-quizu" aria-label={przebieg.quiz.tytul}>
      <p className="nadtytul">{przebieg.quiz.tytul}</p>
      <div className="tryb-widoku" role="group" aria-label="Tryb widoku quizu">
        {(['pojedynczy', 'pelny'] as const).map((wartosc) => (
          <button
            key={wartosc}
            className="przycisk"
            aria-pressed={tryb === wartosc}
            disabled={
              oczekujacy !== null || blokadaSzkicu || blokadaStandardowa
            }
            onClick={() => ustawTryb(wartosc)}
          >
            {wartosc === 'pojedynczy' ? 'Pojedyncze pytania' : 'Widok pełny'}
          </button>
        ))}
      </div>
      {pytanie && tryb === 'pojedynczy' && (
        <p className="licznik-pytan">
          Pytanie {przebieg.indeksPytania + 1} z {przebieg.pytania.length}
        </p>
      )}
      <h1 ref={naglowek} tabIndex={-1}>
        {tryb === 'pelny'
          ? 'Widok pełny'
          : (pytanie?.tresc ??
            (zapisany.sesja.stan === 'zakonczona'
              ? 'Quiz zakończony'
              : 'Pytania odłożone'))}
      </h1>
      <p className="informacja" role="status">
        {zapisywanie
          ? 'Zapisywanie postępu…'
          : oczekujacy
            ? 'Zmiana nie została zapisana. Ekran pokazuje poprzedni poprawny stan.'
            : 'Postęp zapisany lokalnie.'}
      </p>
      {zapisany.sesja.zmianyAdaptacyjne.length > 0 && (
        <section aria-label="Zmiany adaptacyjne" aria-live="polite">
          <h2>Zmiany adaptacyjne</h2>
          <ul>
            {zapisany.sesja.zmianyAdaptacyjne.map((zmiana) => (
              <li key={zmiana.id}>
                <p>
                  {
                    {
                      dodaj: 'Pytanie dodane',
                      modyfikuj: 'Pytanie zmodyfikowane',
                      pomin: 'Pytanie pominięte',
                    }[zmiana.rodzaj]
                  }
                  : {(zmiana.po ?? zmiana.przed)?.tresc}
                </p>
                <details>
                  <summary>Dlaczego?</summary>
                  <p>{zmiana.powod}</p>
                  <p>Reguła: {zmiana.regulaId}</p>
                  <p>Pytanie źródłowe: {zmiana.zrodlo.pytanie.tresc}</p>
                  <p>
                    Odpowiedź źródłowa:{' '}
                    {opisDecyzji(przebieg.quiz, zmiana.zrodlo.decyzja)}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(tryb === 'pelny' ? przebieg.pytania : pytanie ? [pytanie] : []).map(
        (widocznePytanie) => {
          const wynik = przejdzDoPytania(
            zapisany,
            widocznePytanie.id,
            new Date().toISOString(),
          );
          if (wynik.stan !== 'gotowy') return null;
          const indeks = przebieg.pytania.findIndex(
            (element) => element.id === widocznePytanie.id,
          );
          const inneBlokady = Object.entries(blokady).some(
            ([klucz, wartosc]) =>
              wartosc &&
              klucz !== `${widocznePytanie.id}-wlasna` &&
              klucz !== `${widocznePytanie.id}-standardowa`,
          );
          return (
            <section
              className="pytanie-quizu"
              key={widocznePytanie.id}
              aria-label={`Pytanie ${indeks + 1}`}
            >
              {tryb === 'pelny' && (
                <>
                  <p className="licznik-pytan">
                    {indeks + 1} / {przebieg.pytania.length}
                  </p>
                  <h2>{widocznePytanie.tresc}</h2>
                </>
              )}
              <fieldset
                className="zawartosc-pytania"
                disabled={inneBlokady || oczekujacy !== null}
              >
                <legend className="tylko-czytnik">
                  Odpowiedź na pytanie {indeks + 1}
                </legend>
                <PytanieQuizu
                  zapisany={wynik.wartosc}
                  analizator={analizator}
                  pokazuj={pokazuj}
                  oczekujacy={oczekujacy}
                  blokadaSzkicu={blokadaSzkicu}
                  blokadaStandardowa={blokadaStandardowa}
                  ustawBlokadePytania={ustawBlokadePytania}
                  zapiszWlasna={zapiszWlasna}
                  zastosuj={(wynikDecyzji) =>
                    zastosujSesje(
                      aktualizujSesje(
                        wynik.wartosc,
                        wynikDecyzji,
                        new Date().toISOString(),
                      ),
                    )
                  }
                />
              </fieldset>
            </section>
          );
        },
      )}
      {!pytanie && (
        <>
          <p role="status">
            {zapisany.sesja.stan === 'zakonczona'
              ? zapisany.sesja.odlozonePytaniaId.length
                ? 'Sesja zakończona. Odłożone pytania pozostają nierozstrzygnięte.'
                : 'Odpowiedzi na wszystkie pytania zostały zapisane.'
              : 'Zestaw został przejrzany. Możesz wrócić do odłożonych pytań lub zakończyć sesję z nierozstrzygniętymi pytaniami.'}
          </p>
        </>
      )}
      {blad && <p role="alert">{blad}</p>}
      {zapisany.sesja.stan === 'zakonczona' && !pytanie && (
        <PodsumowanieQuizu
          quiz={przebieg.quiz}
          sesja={zapisany.sesja}
          niekompletnyImport={niekompletnyImport}
        />
      )}
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
                      [
                        ...przebieg.quiz.pytania,
                        ...przebieg.quiz.pytaniaDodatkowe,
                      ].find((pytanie) => pytanie.id === decyzja.pytanieId)
                        ?.tresc
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
                    [
                      ...przebieg.quiz.pytania,
                      ...przebieg.quiz.pytaniaDodatkowe,
                    ].find((pytanie) => pytanie.id === zdarzenie.pytanieId)
                      ?.tresc
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
                {zdarzenie.rodzaj === 'decyzja' &&
                  !zapisany.sesja.decyzje.some(
                    (decyzja) => decyzja.id === zdarzenie.nowaDecyzja.id,
                  ) && <p>Zapis historyczny — nie jest aktualną decyzją.</p>}
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
          <h2>Odłożone pytania — nierozstrzygnięte</h2>
          <ul>
            {przebieg.pytania
              .filter((pytanie) =>
                zapisany.sesja.odlozonePytaniaId.includes(pytanie.id),
              )
              .map((pytanie) => (
                <li key={pytanie.id}>
                  <button
                    className="przycisk drugorzedny"
                    disabled={
                      oczekujacy !== null || blokadaSzkicu || blokadaStandardowa
                    }
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
      {tryb === 'pojedynczy' && (
        <div className="nawigacja-quizu">
          <button
            className="przycisk"
            disabled={
              przebieg.indeksPytania === 0 ||
              oczekujacy !== null ||
              blokadaSzkicu ||
              blokadaStandardowa
            }
            onClick={() => {
              zastosuj({ stan: 'gotowy', wartosc: przejdzWstecz(przebieg) });
            }}
          >
            ← Poprzednie pytanie
          </button>
          {pytanie && (
            <button
              className="przycisk"
              disabled={
                obsluga?.stan !== 'gotowy' ||
                !zapisany.sesja.decyzje.some(
                  (decyzja) => decyzja.pytanieId === pytanie.id,
                ) ||
                blokadaSzkicu ||
                blokadaStandardowa ||
                oczekujacy !== null
              }
              onClick={() => zastosuj(przejdzDalej(przebieg))}
            >
              Następne pytanie →
            </button>
          )}
          {pytanie && (
            <button
              className="przycisk drugorzedny"
              disabled={
                oczekujacy !== null || blokadaSzkicu || blokadaStandardowa
              }
              onClick={() =>
                zastosujSesje(odlozPytanie(zapisany, new Date().toISOString()))
              }
            >
              Wróć później
            </button>
          )}
        </div>
      )}
      {!pytanie && zapisany.sesja.stan !== 'zakonczona' && (
        <button
          className="przycisk"
          disabled={oczekujacy !== null}
          onClick={() => zastosuj({ stan: 'gotowy', wartosc: przebieg })}
        >
          Zakończ z nierozstrzygniętymi pytaniami
        </button>
      )}
      <Odnosnik className="przycisk drugorzedny" to="/biblioteka">
        Wróć do Biblioteki
      </Odnosnik>
    </section>
  );
}

function PytanieQuizu({
  zapisany,
  analizator,
  pokazuj,
  oczekujacy,
  blokadaSzkicu,
  blokadaStandardowa,
  ustawBlokadePytania,
  zapiszWlasna,
  zastosuj,
}: {
  zapisany: PrzebiegSesji;
  analizator: Analizator;
  pokazuj: boolean;
  oczekujacy: PrzebiegSesji | null;
  blokadaSzkicu: boolean;
  blokadaStandardowa: boolean;
  ustawBlokadePytania: (klucz: string, blokada: boolean) => void;
  zapiszWlasna: (wynik: Wynik<PrzebiegSesji>) => Promise<boolean>;
  zastosuj: (wynik: Wynik<StanQuizu>) => void;
}) {
  const przebieg = zapisany.przebieg;
  const pytanie = biezacePytanie(przebieg)!;
  const ustawBlokadeSzkicu = pamietajFunkcje(
    (blokada: boolean) => ustawBlokadePytania(`${pytanie.id}-wlasna`, blokada),
    [pytanie.id, ustawBlokadePytania],
  );
  const ustawBlokadeStandardowa = pamietajFunkcje(
    (blokada: boolean) =>
      ustawBlokadePytania(`${pytanie.id}-standardowa`, blokada),
    [pytanie.id, ustawBlokadePytania],
  );
  const wybrany = wybranyWariant(przebieg);
  const obsluga = sprawdzObslugePytania(pytanie);
  const pojedynczy =
    pytanie.sposobyOdpowiedzi.length === 1 &&
    pytanie.sposobyOdpowiedzi[0]?.rodzaj === 'pojedynczyWybor';
  return (
    <>
      {pytanie.wyjasnienie && <p>{pytanie.wyjasnienie}</p>}
      {pytanie.prezentacja.obrazy?.map((obraz) => (
        <img
          className="obraz-quizu"
          key={obraz.id}
          src={obraz.dane ?? obraz.url}
          alt={obraz.opisAlternatywny}
        />
      ))}
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
                      Rekomendacja autora: {pytanie.rekomendacja?.uzasadnienie}
                    </p>
                  )}
                  {wariant.opis && <p>{wariant.opis}</p>}
                  {wariant.obrazy?.map((obraz) => (
                    <img
                      className="obraz-quizu"
                      key={obraz.id}
                      src={obraz.dane ?? obraz.url}
                      alt={obraz.opisAlternatywny}
                    />
                  ))}
                  {(['zalety', 'wady'] as const).map((pole) =>
                    wariant[pole]?.length ? (
                      <ul key={pole} className={`bilans-wariantu ${pole}`}>
                        {wariant[pole].map((tekst, indeks) => (
                          <li key={indeks}>
                            <span aria-hidden="true">
                              {pole === 'zalety' ? '+' : '−'}
                            </span>{' '}
                            <span className="tylko-czytnik">
                              {pole === 'zalety' ? 'Zaleta: ' : 'Wada: '}
                            </span>
                            {tekst}
                          </li>
                        ))}
                      </ul>
                    ) : null,
                  )}
                  {!!wariant.konsekwencje?.length && (
                    <div>
                      <h3>Konsekwencje</h3>
                      <ul>
                        {wariant.konsekwencje.map((tekst, indeks) => (
                          <li key={indeks}>{tekst}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {wariant.wyjasnienie && <p>{wariant.wyjasnienie}</p>}
                  {pojedynczy && (
                    <button
                      className="przycisk"
                      disabled={
                        oczekujacy !== null ||
                        blokadaSzkicu ||
                        blokadaStandardowa
                      }
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
                  )}
                </article>
              );
            })}
          </div>
          <OdpowiedzStandardowa
            key={`standardowa-${pytanie.id}-${zapisany.sesja.decyzje.find((decyzja) => decyzja.pytanieId === pytanie.id)?.id ?? 'brak'}`}
            przebieg={zapisany}
            zapisz={zapiszWlasna}
            zablokowany={oczekujacy !== null || blokadaSzkicu}
            ustawBlokade={ustawBlokadeStandardowa}
            tylkoKomentarz={pojedynczy}
          />
          {pytanie.innaOdpowiedz && (
            <OdpowiedzWlasna
              key={`${pytanie.id}-${zapisany.sesja.decyzje.find((decyzja) => decyzja.pytanieId === pytanie.id)?.id ?? 'brak'}`}
              przebieg={zapisany}
              analizator={analizator}
              zapisz={zapiszWlasna}
              zablokowany={oczekujacy !== null || blokadaStandardowa}
              ustawBlokade={ustawBlokadeSzkicu}
            />
          )}
        </>
      )}
    </>
  );
}
