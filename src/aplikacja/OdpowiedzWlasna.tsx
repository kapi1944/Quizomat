import {
  useEffect as poZmianie,
  useRef as referencja,
  useState as stan,
} from 'react';
import type { Analizator } from '../ai/analizator';
import { sprawdzAnalize } from '../ai/analizator';
import { biezacePytanie } from '../silnik/runtime';
import type { Wynik } from '../silnik/runtime';
import type { PrzebiegSesji } from '../silnik/sesja';
import {
  zapiszSzkic,
  zatwierdzOdpowiedzWlasna,
} from '../silnik/odpowiedz-wlasna';

export function OdpowiedzWlasna({
  przebieg,
  analizator,
  zapisz,
  zablokowany,
  ustawBlokade,
}: {
  przebieg: PrzebiegSesji;
  analizator: Analizator;
  zapisz: (wynik: Wynik<PrzebiegSesji>) => Promise<boolean>;
  zablokowany: boolean;
  ustawBlokade: (blokada: boolean) => void;
}) {
  const pytanie = biezacePytanie(przebieg.przebieg)!;
  const szkic = przebieg.sesja.szkiceWlasnychOdpowiedzi.find(
    (szkic) => szkic.pytanieId === pytanie.id,
  );
  const decyzja = przebieg.sesja.decyzje.find(
    (decyzja) => decyzja.pytanieId === pytanie.id,
  );
  const [tekst, ustawTekst] = stan(
    szkic?.tekst ??
      (decyzja?.odpowiedz.rodzaj === 'wlasna' ? decyzja.odpowiedz.tekst : ''),
  );
  const [analizowanie, ustawAnalizowanie] = stan(false);
  const [blad, ustawBlad] = stan('');
  const aktywny = referencja(true);
  const trwaAnaliza = referencja(false);
  const niezapisany =
    tekst !==
    (szkic?.tekst ??
      (decyzja?.odpowiedz.rodzaj === 'wlasna' ? decyzja.odpowiedz.tekst : ''));
  const analiza =
    szkic?.stan === 'przeanalizowana' && szkic.tekst === tekst
      ? szkic.analiza
      : null;
  poZmianie(() => {
    aktywny.current = true;
    return () => {
      aktywny.current = false;
      ustawBlokade(false);
    };
  }, [ustawBlokade]);
  poZmianie(() => {
    ustawBlokade(niezapisany || analizowanie);
    if (!niezapisany) return;
    function ostrzez(zdarzenie: BeforeUnloadEvent) {
      zdarzenie.preventDefault();
      zdarzenie.returnValue = '';
    }
    window.addEventListener('beforeunload', ostrzez);
    return () => window.removeEventListener('beforeunload', ostrzez);
  }, [niezapisany, analizowanie, ustawBlokade]);

  async function analizuj() {
    if (trwaAnaliza.current || zablokowany) return;
    trwaAnaliza.current = true;
    ustawAnalizowanie(true);
    ustawBlad('');
    try {
      const zapisany = zapiszSzkic(przebieg, {
        pytanieId: pytanie.id,
        tekst,
        stan: 'szkic',
      });
      if (zapisany.stan !== 'gotowy' || !(await zapisz(zapisany))) return;
      const oczekujacy = zapiszSzkic(zapisany.wartosc, {
        pytanieId: pytanie.id,
        tekst,
        stan: 'oczekujeAnalizy',
      });
      if (oczekujacy.stan !== 'gotowy' || !(await zapisz(oczekujacy))) return;
      const wynik = sprawdzAnalize(
        await analizator.analizuj({
          pytanie,
          tekst,
          quiz: przebieg.przebieg.quiz,
        }),
        przebieg.przebieg.quiz,
      );
      if (!aktywny.current) return;
      await zapisz(
        zapiszSzkic(oczekujacy.wartosc, {
          pytanieId: pytanie.id,
          tekst,
          stan: 'przeanalizowana',
          analiza: wynik,
        }),
      );
    } catch (blad) {
      if (aktywny.current)
        ustawBlad(
          blad instanceof Error
            ? blad.message
            : 'Analiza jest niedostępna. Szkic pozostał zapisany.',
        );
    } finally {
      trwaAnaliza.current = false;
      if (aktywny.current) ustawAnalizowanie(false);
    }
  }

  return (
    <section aria-label="Własna odpowiedź">
      <h2>{pytanie.innaOdpowiedz?.etykieta}</h2>
      <p>
        Tekst i wynik analizy są propozycją. Decyzja powstaje dopiero po
        zatwierdzeniu.
      </p>
      {decyzja?.odpowiedz.rodzaj === 'wlasna' && (
        <p>Aktualna zatwierdzona odpowiedź: {decyzja.odpowiedz.tekst}</p>
      )}
      <label>
        Treść własnej odpowiedzi
        <textarea
          value={tekst}
          disabled={zablokowany || analizowanie || analiza !== null}
          onChange={(zdarzenie) => {
            ustawTekst(zdarzenie.target.value);
            ustawBlad('');
          }}
        />
      </label>
      {niezapisany && (
        <p role="status">
          Szkic niezapisany — zapisz przed opuszczeniem pytania.
        </p>
      )}
      {!analiza && (
        <>
          <button
            className="przycisk"
            disabled={zablokowany || analizowanie}
            onClick={() =>
              void zapisz(
                zapiszSzkic(przebieg, {
                  pytanieId: pytanie.id,
                  tekst,
                  stan: 'szkic',
                }),
              )
            }
          >
            Zapisz szkic
          </button>
          <button
            className="przycisk"
            disabled={zablokowany || analizowanie || tekst.trim().length === 0}
            onClick={() => void analizuj()}
          >
            {szkic?.stan === 'oczekujeAnalizy'
              ? 'Ponów analizę'
              : 'Przeanalizuj odpowiedź'}
          </button>
        </>
      )}
      {analizowanie && <p role="status">Oczekiwanie na analizę…</p>}
      {!analizowanie && szkic?.stan === 'oczekujeAnalizy' && (
        <p role="status">
          Analiza nie została ukończona. Szkic jest zapisany; możesz ponowić
          analizę.
        </p>
      )}
      {blad && (
        <p role="alert">
          Nie ukończono analizy. {blad} Odpowiedź nie została zatwierdzona.
        </p>
      )}
      {analiza && (
        <>
          <h3>Wynik analizy — do zatwierdzenia</h3>
          <p>
            {analiza.tryb === 'autorska'
              ? 'Interpretacja autora'
              : 'Wynik usługi analizy'}
          </p>
          <p>{analiza.interpretacja}</p>
          {(
            [
              'zalety',
              'wady',
              'potencjalneSkutki',
              'niejednoznacznosci',
              'dotknietePytaniaId',
            ] as const
          ).map((pole) =>
            analiza[pole]?.length ? (
              <div key={pole}>
                <h4>
                  {
                    {
                      zalety: 'Zalety',
                      wady: 'Wady',
                      potencjalneSkutki: 'Konsekwencje',
                      niejednoznacznosci: 'Niejednoznaczności',
                      dotknietePytaniaId: 'Potencjalnie dotknięte pytania',
                    }[pole]
                  }
                </h4>
                <ul>
                  {analiza[pole].map((wartosc, indeks) => (
                    <li key={indeks}>
                      {pole === 'dotknietePytaniaId'
                        ? ([
                            ...przebieg.przebieg.quiz.pytania,
                            ...przebieg.przebieg.quiz.pytaniaDodatkowe,
                          ].find((pytanie) => pytanie.id === wartosc)?.tresc ??
                          wartosc)
                        : wartosc}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          <button
            className="przycisk"
            disabled={zablokowany}
            onClick={() =>
              void zapisz(
                zatwierdzOdpowiedzWlasna(przebieg, {
                  id: crypto.randomUUID(),
                  zatwierdzono: new Date().toISOString(),
                }),
              )
            }
          >
            Zatwierdź odpowiedź
          </button>
          <button
            className="przycisk"
            disabled={zablokowany}
            onClick={() =>
              void zapisz(
                zapiszSzkic(przebieg, {
                  pytanieId: pytanie.id,
                  tekst,
                  stan: 'szkic',
                }),
              )
            }
          >
            Zmień odpowiedź
          </button>
        </>
      )}
    </section>
  );
}
