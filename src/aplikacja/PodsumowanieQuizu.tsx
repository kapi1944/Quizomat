import { useState as stan } from 'react';
import type { Quiz } from '../domena/quiz';
import type { Sesja } from '../domena/sesja';
import { sekcjeRaportu, utworzRaport } from '../eksport/raport';
import type { FormatEksportu } from '../eksport/raport';
import { pobierzRaport } from '../eksport/pobieranie';

export function PodsumowanieQuizu({
  quiz,
  sesja,
  niekompletnyImport,
}: {
  quiz: Quiz;
  sesja: Sesja;
  niekompletnyImport: boolean;
}) {
  const [eksport, ustawEksport] = stan(false);
  const [formaty, ustawFormaty] = stan<FormatEksportu[]>(['md']);
  const [komunikat, ustawKomunikat] = stan('');
  const [blad, ustawBlad] = stan('');
  let raport;
  try {
    raport = utworzRaport(quiz, sesja, niekompletnyImport);
  } catch (przyczyna) {
    return (
      <p role="alert">
        {przyczyna instanceof Error
          ? przyczyna.message
          : 'Nie można odtworzyć raportu sesji.'}
      </p>
    );
  }
  return (
    <section aria-label="Podsumowanie quizu">
      <h2>Specyfikacja Twoich decyzji</h2>
      <p>
        Wynik zawiera aktualne, zatwierdzone decyzje. Rekomendacje i opisy
        autora są oznaczone osobno. W kombinacjach decyzją są wskazane
        fragmenty.
      </p>
      {sekcjeRaportu(raport).map((sekcja, indeks) => (
        <section className="sekcja-raportu" key={indeks}>
          <h3>{sekcja.tytul}</h3>
          <dl>
            {sekcja.pola.map((pole, numer) => (
              <div key={numer}>
                <dt>{pole.etykieta}</dt>
                <dd className="tresc-raportu">{pole.tekst}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <button
        className="przycisk"
        onClick={() => ustawEksport(!eksport)}
        aria-expanded={eksport}
      >
        Eksportuj
      </button>
      {eksport && (
        <fieldset>
          <legend>Formaty eksportu</legend>
          {(['md', 'json', 'txt'] as const).map((format) => (
            <label key={format}>
              <input
                type="checkbox"
                checked={formaty.includes(format)}
                onChange={(zdarzenie) => {
                  ustawFormaty(
                    zdarzenie.target.checked
                      ? [...formaty, format]
                      : formaty.filter((wybrany) => wybrany !== format),
                  );
                  ustawKomunikat('');
                  ustawBlad('');
                }}
              />
              {
                {
                  md: 'Markdown (.md)',
                  json: 'JSON (.json)',
                  txt: 'TXT (.txt)',
                }[format]
              }
            </label>
          ))}
          <button
            className="przycisk"
            disabled={!formaty.length}
            onClick={() => {
              ustawKomunikat('');
              ustawBlad('');
              try {
                for (const format of formaty) pobierzRaport(raport, format);
                ustawKomunikat('Przekazano pliki do pobrania w przeglądarce.');
              } catch {
                ustawBlad(
                  'Nie udało się przygotować pobierania. Spróbuj ponownie.',
                );
              }
            }}
          >
            Generuj
          </button>
          {komunikat && <p role="status">{komunikat}</p>}
          {blad && <p role="alert">{blad}</p>}
        </fieldset>
      )}
    </section>
  );
}
