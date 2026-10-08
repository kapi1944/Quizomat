import {
  useEffect as poZmianie,
  useRef as odniesienie,
  useState as stan,
} from 'react';
import { odczytajTekstPliku } from '../import/plik';
import { parsujTekst, przygotujImportTekstu } from '../import/tekst';
import type { RaportTekstu } from '../import/tekst';
import type { WynikImportu } from '../import/walidator';

export function ImportTekstu({
  pokazRaport,
}: {
  pokazRaport: (wynik: WynikImportu) => void;
}) {
  const [tekst, ustawTekst] = stan('');
  const [oryginal, ustawOryginal] = stan<string | null>(null);
  const [tytul, ustawTytul] = stan('');
  const [jezyk, ustawJezyk] = stan('');
  const [raport, ustawRaport] = stan<RaportTekstu | null>(null);
  const [raportOryginalu, ustawRaportOryginalu] = stan<RaportTekstu | null>(
    null,
  );
  const [zakres, ustawZakres] = stan<string[]>([]);
  const [potwierdzono, ustawPotwierdzono] = stan(false);
  const [czesciowy, ustawCzesciowy] = stan(false);
  const [pelnyZakresKorekty, ustawPelnyZakresKorekty] = stan(false);
  const [blad, ustawBlad] = stan('');
  const [zajety, ustawZajety] = stan(false);
  const numerOdczytu = odniesienie(0);
  poZmianie(
    () => () => {
      numerOdczytu.current += 1;
    },
    [],
  );

  function uniewaznij() {
    ustawRaport(null);
    ustawZakres([]);
    ustawPotwierdzono(false);
    ustawCzesciowy(false);
    ustawPelnyZakresKorekty(false);
    ustawBlad('');
  }

  async function wybierzPlik(plik: File) {
    const numer = ++numerOdczytu.current;
    uniewaznij();
    ustawZajety(true);
    try {
      const odczyt = await odczytajTekstPliku(plik);
      if (numer !== numerOdczytu.current) return;
      ustawTekst(odczyt);
      ustawOryginal(odczyt);
      ustawRaportOryginalu(null);
    } catch {
      if (numer === numerOdczytu.current)
        ustawBlad('Nie można odczytać pliku tekstowego. Wybierz go ponownie.');
    } finally {
      if (numer === numerOdczytu.current) ustawZajety(false);
    }
  }

  const niekompletny =
    raport &&
    ((oryginal !== raport.oryginal && !pelnyZakresKorekty) ||
      zakres.length !== raport.pytania.length ||
      (raportOryginalu?.pytania.length ?? 0) > raport.pytania.length ||
      raport.problemy.some(
        (problem) => problem.poziom === 'blad' && problem.pytanieId === null,
      ));
  return (
    <section className="sekcja-raportu import-tekstu">
      <h2>Import tekstowy</h2>
      <p>
        Wklej tekst lub wybierz TXT/MD w UTF-8. Popraw tekst w edytorze i
        ponownie rozpoznaj pytania. Oryginał zostanie zachowany.
      </p>
      <label>
        Plik TXT lub MD
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={(zdarzenie) => {
            const plik = zdarzenie.currentTarget.files?.[0];
            zdarzenie.currentTarget.value = '';
            if (plik) void wybierzPlik(plik);
          }}
        />
      </label>
      <label>
        Tytuł pakietu
        <input
          value={tytul}
          onChange={(zdarzenie) => ustawTytul(zdarzenie.target.value)}
        />
      </label>
      <label>
        Język pakietu (np. pl)
        <input
          value={jezyk}
          onChange={(zdarzenie) => ustawJezyk(zdarzenie.target.value)}
        />
      </label>
      <label>
        Tekst do korekty
        <textarea
          rows={14}
          value={tekst}
          disabled={zajety}
          onChange={(zdarzenie) => {
            ustawTekst(zdarzenie.target.value);
            uniewaznij();
          }}
        />
      </label>
      <button
        className="przycisk"
        disabled={zajety}
        onClick={() => {
          const odczyt = parsujTekst(tekst);
          ustawOryginal(oryginal ?? tekst);
          ustawRaportOryginalu(
            raportOryginalu ??
              (oryginal !== null && oryginal !== tekst
                ? parsujTekst(oryginal)
                : odczyt),
          );
          ustawRaport(odczyt);
          ustawZakres(odczyt.pytania.map((pytanie) => pytanie.id));
          ustawPotwierdzono(false);
          ustawCzesciowy(false);
          ustawPelnyZakresKorekty(false);
          ustawBlad('');
        }}
      >
        Rozpoznaj pytania
      </button>
      {zajety && <p role="status">Odczytywanie tekstu…</p>}
      {oryginal !== null && (
        <details>
          <summary>Oryginalna treść źródłowa</summary>
          <pre className="zrodlo-importu">{oryginal}</pre>
        </details>
      )}
      {raport && (
        <>
          {oryginal !== raport.oryginal && (
            <label>
              <input
                type="checkbox"
                checked={pelnyZakresKorekty}
                onChange={(zdarzenie) => {
                  ustawPelnyZakresKorekty(zdarzenie.target.checked);
                  ustawPotwierdzono(false);
                  ustawCzesciowy(false);
                }}
              />
              Korekta zachowuje pełny zakres oryginału. Nie pominięto fragmentów
              źródła.
            </label>
          )}
          <h3>Podgląd tekstu</h3>
          <p>
            Rozpoznane pytania: {raport.pytania.length} · Warianty:{' '}
            {raport.pytania.reduce(
              (suma, pytanie) => suma + pytanie.warianty.length,
              0,
            )}{' '}
            · Rekomendacje (pytania z oznaczeniem):{' '}
            {
              raport.pytania.filter(
                (pytanie) =>
                  pytanie.sugestie.length ||
                  pytanie.warianty.some((wariant) => wariant.gwiazdka),
              ).length
            }
          </p>
          <h3>Problemy i normalizacje</h3>
          <p>
            Błędy:{' '}
            {
              raport.problemy.filter((problem) => problem.poziom === 'blad')
                .length
            }{' '}
            · Ostrzeżenia:{' '}
            {
              raport.problemy.filter(
                (problem) => problem.poziom === 'ostrzezenie',
              ).length
            }
          </p>
          <ul>
            {raport.problemy.map((problem, indeks) => (
              <li key={indeks}>
                Wiersze {problem.od}–{problem.do} · {problem.kategoria} ·{' '}
                {problem.poziom}: {problem.opis} Rozwiązanie:{' '}
                {problem.rozwiazanie}
              </li>
            ))}
          </ul>
          {raport.pytania.map((pytanie, indeks) => (
            <section className="sekcja-raportu" key={pytanie.id}>
              <h3>
                Pytanie {pytanie.numer ?? indeks + 1}:{' '}
                {pytanie.tresc || '(brak treści)'}
              </h3>
              <p>
                Wiersze {pytanie.od}–{pytanie.do} · Pojedynczy wybór
              </p>
              <ul>
                {pytanie.warianty.map((wariant) => (
                  <li key={wariant.id}>
                    {wariant.litera}. {wariant.etykieta || '(brak treści)'}{' '}
                    {wariant.gwiazdka && '⭐'}
                  </li>
                ))}
              </ul>
              {pytanie.sugestie.map((sugestia, numer) => (
                <p key={numer}>
                  Sugestia: {sugestia.litera} —{' '}
                  {sugestia.uzasadnienie || '(brak uzasadnienia)'}
                </p>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={zakres.includes(pytanie.id)}
                  onChange={(zdarzenie) => {
                    ustawZakres(
                      zdarzenie.target.checked
                        ? [...zakres, pytanie.id]
                        : zakres.filter((id) => id !== pytanie.id),
                    );
                    ustawPotwierdzono(false);
                    ustawCzesciowy(false);
                  }}
                />
                Uwzględnij pytanie {indeks + 1}
              </label>
            </section>
          ))}
          <p>
            Zakres importu: {zakres.length} z {raport.pytania.length} pytań.
            Pominięte fragmenty pozostają w oryginale i raporcie.
          </p>
          <label>
            <input
              type="checkbox"
              checked={potwierdzono}
              onChange={(zdarzenie) =>
                ustawPotwierdzono(zdarzenie.target.checked)
              }
            />
            Potwierdzam interpretację wybranych pytań, wariantów, rekomendacji i
            pojedynczy wybór.
          </label>
          {niekompletny && (
            <label>
              <input
                type="checkbox"
                checked={czesciowy}
                onChange={(zdarzenie) =>
                  ustawCzesciowy(zdarzenie.target.checked)
                }
              />
              Zatwierdzam wskazany częściowy zakres. Quiz jest niekompletny
              względem źródła.
            </label>
          )}
          <button
            className="przycisk"
            onClick={() => {
              try {
                pokazRaport(
                  przygotujImportTekstu(
                    raport,
                    { tytul, jezyk },
                    zakres,
                    potwierdzono,
                    czesciowy,
                    oryginal ?? tekst,
                    pelnyZakresKorekty,
                  ),
                );
                ustawBlad('');
              } catch (przyczyna) {
                ustawBlad(
                  przyczyna instanceof Error
                    ? przyczyna.message
                    : 'Nie można przygotować importu.',
                );
              }
            }}
          >
            Sprawdź kanoniczny JSON
          </button>
        </>
      )}
      {blad && <p role="alert">{blad}</p>}
    </section>
  );
}
