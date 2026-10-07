import {
  useEffect as poZmianie,
  useRef as odniesienie,
  useState as stan,
} from 'react';
import { useNavigate as nawigacja } from 'react-router-dom';
import { zapiszZatwierdzonyQuiz } from '../dane/biblioteka';
import { odczytajPlikQuizu } from '../import/plik';
import type { ProblemImportu, WynikImportu } from '../import/walidator';

function identyfikatorElementu(
  wynik: WynikImportu,
  problem: ProblemImportu,
): string {
  let element: unknown = wynik.daneZrodlowe;
  let identyfikator = wynik.raport.quizId ?? 'brak ID';
  for (const pole of problem.sciezka) {
    if (typeof element !== 'object' || element === null) break;
    element = (element as Record<string | number, unknown>)[pole];
    if (typeof pole === 'number') identyfikator = 'brak ID';
    if (
      typeof element === 'object' &&
      element !== null &&
      !Array.isArray(element)
    ) {
      const dane = element as Record<string, unknown>;
      identyfikator = typeof dane.id === 'string' ? dane.id : identyfikator;
      if (typeof pole === 'number')
        identyfikator = typeof dane.id === 'string' ? dane.id : 'brak ID';
    }
  }
  return identyfikator;
}

function ListaProblemow({
  tytul,
  problemy,
  wynik,
}: {
  tytul: string;
  problemy: ProblemImportu[];
  wynik: WynikImportu;
}) {
  return (
    <section className="sekcja-raportu">
      <h3>
        {tytul} ({problemy.length})
      </h3>
      {problemy.length === 0 ? (
        <p>Brak.</p>
      ) : (
        <ul>
          {problemy.map((problem, indeks) => (
            <li key={indeks}>
              <p>{problem.opis}</p>
              <details>
                <summary>Diagnostyka elementu</summary>
                <dl>
                  <dt>ID elementu</dt>
                  <dd>{identyfikatorElementu(wynik, problem)}</dd>
                  <dt>Ścieżka</dt>
                  <dd>{problem.sciezka.join(' → ') || 'Cały plik'}</dd>
                  <dt>Kod</dt>
                  <dd>{problem.kod}</dd>
                </dl>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ImportQuizu() {
  const przejdz = nawigacja();
  const [wynik, ustawWynik] = stan<WynikImportu | null>(null);
  const [nazwaPliku, ustawNazwePliku] = stan('');
  const [zajety, ustawZajety] = stan(false);
  const [blad, ustawBlad] = stan('');
  const numerOdczytu = odniesienie(0);
  const naglowekRaportu = odniesienie<HTMLHeadingElement>(null);
  const polePliku = odniesienie<HTMLInputElement>(null);
  poZmianie(
    () => () => {
      numerOdczytu.current += 1;
    },
    [],
  );
  poZmianie(() => {
    if (wynik) naglowekRaportu.current?.focus();
    else polePliku.current?.focus();
  }, [wynik]);

  function wyczysc() {
    numerOdczytu.current += 1;
    ustawWynik(null);
    ustawBlad('');
    ustawZajety(false);
    ustawNazwePliku('');
  }

  async function wybierzPlik(plik: File) {
    const numer = ++numerOdczytu.current;
    ustawZajety(true);
    ustawBlad('');
    ustawWynik(null);
    ustawNazwePliku(plik.name);
    try {
      const odczyt = await odczytajPlikQuizu(plik);
      if (numer === numerOdczytu.current) ustawWynik(odczyt);
    } catch {
      if (numer === numerOdczytu.current)
        ustawBlad('Nie można odczytać pliku. Wybierz go ponownie.');
    } finally {
      if (numer === numerOdczytu.current) ustawZajety(false);
    }
  }

  async function zatwierdz() {
    if (!wynik || wynik.stan === 'zablokowany' || zajety) return;
    ustawZajety(true);
    ustawBlad('');
    const numer = numerOdczytu.current;
    try {
      await zapiszZatwierdzonyQuiz(wynik);
      if (numer === numerOdczytu.current) przejdz('/biblioteka');
    } catch (przyczyna) {
      if (numer !== numerOdczytu.current) return;
      ustawBlad(
        przyczyna instanceof Error
          ? przyczyna.message
          : 'Nie zapisano quizu. Spróbuj ponownie.',
      );
      ustawZajety(false);
    }
  }

  const raport = wynik?.raport;
  return (
    <section className="panel import-quizu">
      <h1>Import</h1>
      {!wynik ? (
        <>
          <p>
            Wybierz plik JSON. Najpierw sprawdzisz raport; zapis wymaga Twojego
            zatwierdzenia.
          </p>
          <label className="wybor-pliku">
            Plik quizu JSON
            <input
              ref={polePliku}
              type="file"
              accept=".json,application/json"
              onChange={(zdarzenie) => {
                const plik = zdarzenie.currentTarget.files?.[0];
                zdarzenie.currentTarget.value = '';
                if (plik) void wybierzPlik(plik);
              }}
            />
          </label>
          {zajety && <p role="status">Odczytywanie i sprawdzanie pliku…</p>}
          <button
            className="przycisk drugorzedny"
            onClick={() => {
              wyczysc();
              przejdz('/biblioteka');
            }}
          >
            Anuluj
          </button>
        </>
      ) : (
        raport && (
          <>
            <h2 ref={naglowekRaportu} tabIndex={-1}>
              {raport.poprawnePytania} z{' '}
              {raport.deklarowanePytania ??
                raport.faktycznePytania ??
                'nieznanej liczby'}{' '}
              pytań poprawnych
            </h2>
            <p>
              {raport.nazwaQuizu ?? 'Nie odczytano nazwy quizu'} · {nazwaPliku}
            </p>
            <p>
              Poprawność pojedynczych pytań nie oznacza poprawności całego
              quizu. Żadne dane nie zostały jeszcze zapisane.
            </p>
            <section className="sekcja-raportu">
              <h3>Deklarowana i faktyczna struktura</h3>
              <dl>
                <dt>Pytania bazowe — deklarowane</dt>
                <dd>
                  {raport.deklarowanePytania ?? 'Brak poprawnej deklaracji'}
                </dd>
                <dt>Pytania bazowe — w pliku</dt>
                <dd>{raport.faktycznePytania ?? 'Nieprawidłowa struktura'}</dd>
                <dt>Różnica: faktyczne − deklarowane</dt>
                <dd>
                  {raport.faktycznePytania !== null &&
                  raport.deklarowanePytania !== null
                    ? raport.faktycznePytania - raport.deklarowanePytania
                    : 'Nie można obliczyć'}
                </dd>
                <dt>Pytania dodatkowe — poprawne / w pliku</dt>
                <dd>
                  {raport.poprawnePytaniaDodatkowe} /{' '}
                  {raport.liczbaPytanDodatkowych ?? 'Nieprawidłowa struktura'}
                </dd>
              </dl>
            </section>
            <ListaProblemow
              tytul="Błędy krytyczne"
              problemy={raport.bledy}
              wynik={wynik}
            />
            <ListaProblemow
              tytul="Ostrzeżenia"
              problemy={raport.ostrzezenia}
              wynik={wynik}
            />
            <section className="sekcja-raportu">
              <h3>Niewczytane pytania</h3>
              {raport.pytania.every((pytanie) => pytanie.poprawne) ? (
                <p>
                  {raport.faktycznePytania === null
                    ? 'Nie można odczytać listy pytań. Przyczynę podano w błędach krytycznych.'
                    : 'Brak odrzuconych definicji pytań.'}
                </p>
              ) : (
                <ul>
                  {raport.pytania
                    .filter((pytanie) => !pytanie.poprawne)
                    .map((pytanie) => {
                      const pula =
                        pytanie.pula === 'bazowa'
                          ? 'pytania'
                          : 'pytaniaDodatkowe';
                      const przyczyny = raport.bledy.filter(
                        (problem) =>
                          problem.sciezka[0] === pula &&
                          problem.sciezka[1] === pytanie.indeks,
                      );
                      return (
                        <li key={`${pula}-${pytanie.indeks}`}>
                          <h4>
                            Pytanie {pytanie.indeks + 1} (
                            {pytanie.pula === 'bazowa' ? 'bazowe' : 'dodatkowe'}
                            )
                          </h4>
                          {przyczyny.map((problem, indeks) => (
                            <p key={indeks}>{problem.opis}</p>
                          ))}
                          <details>
                            <summary>Diagnostyka pytania</summary>
                            <p>ID pytania: {pytanie.id ?? 'brak ID'}</p>
                            <p>
                              Warianty w pliku:{' '}
                              {pytanie.liczbaWariantow ??
                                'Nieprawidłowa struktura'}
                            </p>
                          </details>
                        </li>
                      );
                    })}
                </ul>
              )}
            </section>
            <ListaProblemow
              tytul="Informacje"
              problemy={raport.informacje}
              wynik={wynik}
            />
            {wynik.stan === 'zablokowany' && (
              <p role="alert">
                Błędy krytyczne blokują import całego quizu. Popraw plik i
                sprawdź go ponownie.
              </p>
            )}
            <div className="dzialania-importu">
              <button
                className="przycisk drugorzedny"
                disabled={zajety}
                onClick={() => {
                  wyczysc();
                  przejdz('/biblioteka');
                }}
              >
                Anuluj
              </button>
              <button
                className="przycisk drugorzedny"
                disabled={zajety}
                onClick={wyczysc}
              >
                Popraw plik
              </button>
              <button
                className="przycisk"
                disabled={zajety || wynik.stan === 'zablokowany'}
                onClick={() => {
                  void zatwierdz();
                }}
              >
                {raport.ostrzezenia.length > 0 || wynik.stan === 'zablokowany'
                  ? 'Kontynuuj mimo ostrzeżeń'
                  : 'Zatwierdź import'}
              </button>
            </div>
            {zajety && <p role="status">Zapisywanie quizu…</p>}
          </>
        )
      )}
      {blad && <p role="alert">{blad}</p>}
    </section>
  );
}
