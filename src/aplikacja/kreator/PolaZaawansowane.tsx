import {
  useState as stan,
  useRef as referencja,
  useEffect as poZmianie,
} from 'react';
import type { Pytanie, Rekomendacja } from '../../domena/quiz';

export function ListaTekstow({
  nazwa,
  wartosci,
  zmien,
}: {
  nazwa: string;
  wartosci: string[];
  zmien: (wartosci: string[]) => void;
}) {
  return (
    <fieldset className="lista-tekstow-kreatora">
      <legend>{nazwa}</legend>
      {wartosci.map((tekst, indeks) => (
        <div className="wiersz-kreatora" key={indeks}>
          <label>
            {nazwa} — wpis {indeks + 1}
            <textarea
              rows={2}
              value={tekst}
              onChange={(zdarzenie) =>
                zmien(
                  wartosci.map((element, numer) =>
                    numer === indeks ? zdarzenie.target.value : element,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            aria-label={`Usuń: ${nazwa} — wpis ${indeks + 1}`}
            onClick={() =>
              zmien(wartosci.filter((_, numer) => numer !== indeks))
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="przycisk drugorzedny"
        onClick={() => zmien([...wartosci, ''])}
      >
        + Dodaj: {nazwa}
      </button>
    </fieldset>
  );
}

export function PolaRekomendacji({
  warianty,
  wartosc,
  zmien,
}: {
  warianty: Pytanie['warianty'];
  wartosc: Rekomendacja;
  zmien: (wartosc: Rekomendacja) => void;
}) {
  return (
    <>
      <label>
        Rekomendowany wariant
        <select
          value={wartosc.wariantId}
          onChange={(zdarzenie) =>
            zmien({ ...wartosc, wariantId: zdarzenie.target.value })
          }
        >
          <option value="">Wybierz wariant</option>
          {warianty.map((wariant, indeks) => (
            <option value={wariant.id} key={wariant.id}>
              {wariant.etykieta || `Wariant ${indeks + 1}`}
            </option>
          ))}
        </select>
      </label>
      <label>
        Uzasadnienie rekomendacji
        <textarea
          rows={3}
          value={wartosc.uzasadnienie}
          onChange={(zdarzenie) =>
            zmien({ ...wartosc, uzasadnienie: zdarzenie.target.value })
          }
        />
      </label>
    </>
  );
}

type Obrazy = NonNullable<Pytanie['prezentacja']['obrazy']>;

export function EdytorObrazow({
  nazwa,
  obrazy,
  zmien,
}: {
  nazwa: string;
  obrazy: Obrazy;
  zmien: (obrazy: Obrazy) => void;
}) {
  const [blad, ustawBlad] = stan('');
  const aktualne = referencja({ obrazy, zmien });
  const czytniki = referencja(new Set<FileReader>());
  poZmianie(() => {
    aktualne.current = { obrazy, zmien };
  }, [obrazy, zmien]);
  poZmianie(() => {
    const aktywne = czytniki.current;
    return () => {
      aktywne.forEach((czytnik) => czytnik.abort());
      aktywne.clear();
    };
  }, []);
  return (
    <details>
      <summary>
        {nazwa} ({obrazy.length})
      </summary>
      {obrazy.map((obraz, indeks) => (
        <fieldset className="lista-tekstow-kreatora" key={obraz.id}>
          <legend>
            {nazwa} — obraz {indeks + 1}
          </legend>
          <label>
            Opis alternatywny obrazu {indeks + 1}
            <input
              value={obraz.opisAlternatywny}
              onChange={(zdarzenie) =>
                zmien(
                  obrazy.map((element) =>
                    element.id === obraz.id
                      ? { ...element, opisAlternatywny: zdarzenie.target.value }
                      : element,
                  ),
                )
              }
            />
          </label>
          <label>
            Adres HTTPS obrazu {indeks + 1}
            <input
              type="url"
              value={obraz.url ?? ''}
              placeholder="https://…"
              onChange={(zdarzenie) =>
                zmien(
                  obrazy.map((element) =>
                    element.id === obraz.id
                      ? {
                          id: element.id,
                          opisAlternatywny: element.opisAlternatywny,
                          url: zdarzenie.target.value,
                        }
                      : element,
                  ),
                )
              }
            />
          </label>
          <label>
            Plik obrazu {indeks + 1} (PNG, JPEG, WebP)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(zdarzenie) => {
                const plik = zdarzenie.target.files?.[0];
                if (!plik) return;
                if (
                  !['image/png', 'image/jpeg', 'image/webp'].includes(plik.type)
                ) {
                  ustawBlad('Wybierz obraz PNG, JPEG lub WebP.');
                  return;
                }
                const czytnik = new FileReader();
                czytniki.current.add(czytnik);
                czytnik.onloadend = () => czytniki.current.delete(czytnik);
                czytnik.onerror = () =>
                  ustawBlad('Nie odczytano obrazu. Spróbuj ponownie.');
                czytnik.onload = () => {
                  aktualne.current.zmien(
                    aktualne.current.obrazy.map((element) =>
                      element.id === obraz.id
                        ? {
                            id: element.id,
                            opisAlternatywny: element.opisAlternatywny,
                            dane: String(czytnik.result),
                          }
                        : element,
                    ),
                  );
                  ustawBlad('');
                };
                czytnik.readAsDataURL(plik);
              }}
            />
          </label>
          {obraz.dane && <p className="etykieta">Obraz osadzony w quizie.</p>}
          <button
            type="button"
            onClick={() =>
              zmien(obrazy.filter((element) => element.id !== obraz.id))
            }
          >
            Usuń obraz {indeks + 1}
          </button>
        </fieldset>
      ))}
      <button
        className="przycisk drugorzedny"
        type="button"
        onClick={() =>
          zmien([
            ...obrazy,
            { id: crypto.randomUUID(), opisAlternatywny: '', url: '' },
          ])
        }
      >
        + Dodaj obraz
      </button>
      {blad && <p role="alert">{blad}</p>}
    </details>
  );
}

export function OdpowiedzAutorska({
  wartosc,
  zmien,
  pytania,
}: {
  wartosc: NonNullable<Pytanie['innaOdpowiedz']>;
  zmien: (wartosc: NonNullable<Pytanie['innaOdpowiedz']>) => void;
  pytania: Pytanie[];
}) {
  const analiza = wartosc.analiza;
  if (analiza.tryb !== 'autorska') return <p>Analiza AI jest niedostępna.</p>;
  return (
    <>
      <label>
        Etykieta własnej odpowiedzi
        <input
          value={wartosc.etykieta}
          onChange={(zdarzenie) =>
            zmien({ ...wartosc, etykieta: zdarzenie.target.value })
          }
        />
      </label>
      <label>
        Tryb analizy
        <select value="autorska" disabled>
          <option value="autorska">Analiza autorska — lokalna</option>
          <option value="ai" disabled>
            AI — niedostępne
          </option>
        </select>
      </label>
      <label>
        Interpretacja autora
        <textarea
          rows={3}
          value={analiza.interpretacja}
          onChange={(zdarzenie) =>
            zmien({
              ...wartosc,
              analiza: { ...analiza, interpretacja: zdarzenie.target.value },
            })
          }
        />
      </label>
      {(
        ['potencjalneSkutki', 'zalety', 'wady', 'niejednoznacznosci'] as const
      ).map((pole) => (
        <ListaTekstow
          key={pole}
          nazwa={
            {
              potencjalneSkutki: 'Potencjalne skutki analizy',
              zalety: 'Zalety analizy',
              wady: 'Wady analizy',
              niejednoznacznosci: 'Niejednoznaczności analizy',
            }[pole]
          }
          wartosci={analiza[pole] ?? []}
          zmien={(wartosci) =>
            zmien({ ...wartosc, analiza: { ...analiza, [pole]: wartosci } })
          }
        />
      ))}
      <details>
        <summary>Pytania wskazane w analizie</summary>
        {pytania.map((pytanie, indeks) => (
          <label className="pole-wyboru-kreatora" key={pytanie.id}>
            <input
              type="checkbox"
              checked={
                analiza.dotknietePytaniaId?.includes(pytanie.id) ?? false
              }
              onChange={(zdarzenie) =>
                zmien({
                  ...wartosc,
                  analiza: {
                    ...analiza,
                    dotknietePytaniaId: zdarzenie.target.checked
                      ? [...(analiza.dotknietePytaniaId ?? []), pytanie.id]
                      : (analiza.dotknietePytaniaId?.filter(
                          (id) => id !== pytanie.id,
                        ) ?? []),
                  },
                })
              }
            />
            {pytanie.tresc || `Pytanie ${indeks + 1}`}
          </label>
        ))}
      </details>
    </>
  );
}
