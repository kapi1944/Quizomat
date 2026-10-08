import { useEffect as poZmianie, useState as stan } from 'react';
import { z } from 'zod';
import { schematWartosciOdpowiedzi } from '../domena/sesja';
import type { WartoscOdpowiedzi } from '../domena/sesja';
import type { PrzebiegSesji } from '../silnik/sesja';
import type { Wynik } from '../silnik/runtime';
import { aktualizujSesje } from '../silnik/sesja';
import {
  biezacePytanie,
  zatwierdzDecyzje,
  walidujOdpowiedz,
} from '../silnik/runtime';

// Szkic nie jest decyzją. Metadane mieszczą się w rozszerzalnym zapisie sesji 1.0.0.
const schematSzkicu = z.object({
  wartosci: z.array(
    z.union([
      schematWartosciOdpowiedzi,
      z.object({
        sposobId: z.string(),
        rodzaj: z.literal('kombinacjaWariantow'),
        elementy: z.array(
          z.object({ wariantId: z.string(), fragment: z.string() }),
        ),
      }),
    ]),
  ),
  notatka: z.string(),
});
const schematSzkicow = z.record(z.string(), schematSzkicu);

export function OdpowiedzStandardowa({
  przebieg,
  zapisz,
  zablokowany,
  ustawBlokade,
  tylkoKomentarz,
}: {
  przebieg: PrzebiegSesji;
  zapisz: (wynik: Wynik<PrzebiegSesji>) => Promise<boolean>;
  zablokowany: boolean;
  ustawBlokade: (blokada: boolean) => void;
  tylkoKomentarz: boolean;
}) {
  const pytanie = biezacePytanie(przebieg.przebieg)!;
  const decyzja = przebieg.sesja.decyzje.find(
    (decyzja) => decyzja.pytanieId === pytanie.id,
  );
  const szkice = schematSzkicow.safeParse(przebieg.sesja.szkiceStandardowe);
  const zapisany = szkice.success ? szkice.data[pytanie.id] : undefined;
  const poczatek = zapisany ?? {
    wartosci:
      decyzja?.odpowiedz.rodzaj === 'standardowa'
        ? decyzja.odpowiedz.wartosci
        : [],
    notatka: decyzja?.notatka ?? '',
  };
  if (tylkoKomentarz)
    poczatek.wartosci =
      decyzja?.odpowiedz.rodzaj === 'standardowa'
        ? decyzja.odpowiedz.wartosci
        : [];
  const [szkic, ustawSzkic] = stan(poczatek);
  const [blad, ustawBlad] = stan('');
  const niezapisany = JSON.stringify(szkic) !== JSON.stringify(poczatek);
  poZmianie(() => {
    ustawBlokade(niezapisany);
    if (!niezapisany) return;
    function ostrzez(zdarzenie: BeforeUnloadEvent) {
      zdarzenie.preventDefault();
      zdarzenie.returnValue = '';
    }
    window.addEventListener('beforeunload', ostrzez);
    const zegar = window.setTimeout(() => {
      if (zablokowany) return;
      void zapisz({
        stan: 'gotowy',
        wartosc: {
          ...przebieg,
          sesja: {
            ...przebieg.sesja,
            szkiceStandardowe: {
              ...(szkice.success ? szkice.data : {}),
              [pytanie.id]: szkic,
            },
          },
        },
      });
    }, 350);
    return () => {
      window.clearTimeout(zegar);
      window.removeEventListener('beforeunload', ostrzez);
    };
  }, [
    niezapisany,
    szkic,
    przebieg,
    zapisz,
    zablokowany,
    ustawBlokade,
    pytanie.id,
  ]);
  poZmianie(() => () => ustawBlokade(false), [ustawBlokade]);

  function zmien(sposobId: string, wartosc?: WartoscOdpowiedzi) {
    ustawSzkic((poprzedni) => ({
      ...poprzedni,
      wartosci: [
        ...poprzedni.wartosci.filter(
          (wartosc) => wartosc.sposobId !== sposobId,
        ),
        ...(wartosc ? [wartosc] : []),
      ],
    }));
    ustawBlad('');
  }

  return (
    <section
      className="odpowiedz-standardowa"
      aria-label="Formularz odpowiedzi"
    >
      {!tylkoKomentarz && (
        <p>
          Uzupełnij każdy wymagany sposób odpowiedzi niezależnie. Szkic zapisuje
          się automatycznie; zatwierdzenie zapisuje decyzję.
        </p>
      )}
      {!tylkoKomentarz &&
        pytanie.sposobyOdpowiedzi.map((sposob) => {
          const wartosc = szkic.wartosci.find(
            (wartosc) => wartosc.sposobId === sposob.id,
          );
          const wybrane =
            wartosc?.rodzaj === 'ranking' ||
            wartosc?.rodzaj === 'wielokrotnyWybor'
              ? wartosc.wariantyId
              : [];
          return (
            <fieldset key={sposob.id} disabled={zablokowany}>
              <legend>
                {
                  {
                    pojedynczyWybor: 'Pojedynczy wybór',
                    wielokrotnyWybor: 'Wielokrotny wybór',
                    takNie: 'TAK / NIE',
                    prawdaFalsz: 'PRAWDA / FAŁSZ',
                    otwarta: 'Odpowiedź otwarta',
                    skala: 'Skala',
                    ranking: 'Ranking',
                    kombinacjaWariantow: 'Kombinacja wariantów',
                  }[sposob.rodzaj]
                }{' '}
                · {sposob.id} ({sposob.wymagany ? 'wymagane' : 'opcjonalne'})
              </legend>
              {(sposob.rodzaj === 'pojedynczyWybor' ||
                sposob.rodzaj === 'wielokrotnyWybor' ||
                sposob.rodzaj === 'ranking') && (
                <>
                  {sposob.rodzaj !== 'pojedynczyWybor' && (
                    <p>
                      Wybierz od {sposob.minimum} do {sposob.maksimum}{' '}
                      wariantów.
                      {sposob.rodzaj === 'ranking' &&
                        ' Kolejność dodawania wyznacza ranking.'}
                    </p>
                  )}
                  {pytanie.warianty.map((wariant) => (
                    <label key={wariant.id}>
                      <input
                        type={
                          sposob.rodzaj === 'pojedynczyWybor'
                            ? 'radio'
                            : 'checkbox'
                        }
                        name={sposob.id}
                        checked={
                          wartosc?.rodzaj === 'pojedynczyWybor'
                            ? wartosc.wariantId === wariant.id
                            : wybrane.includes(wariant.id)
                        }
                        onChange={(zdarzenie) => {
                          if (sposob.rodzaj === 'pojedynczyWybor')
                            zmien(sposob.id, {
                              sposobId: sposob.id,
                              rodzaj: sposob.rodzaj,
                              wariantId: wariant.id,
                            });
                          else {
                            const lista = zdarzenie.target.checked
                              ? [...wybrane, wariant.id]
                              : wybrane.filter((id) => id !== wariant.id);
                            zmien(
                              sposob.id,
                              lista.length
                                ? {
                                    sposobId: sposob.id,
                                    rodzaj: sposob.rodzaj,
                                    wariantyId: lista,
                                  }
                                : undefined,
                            );
                          }
                        }}
                      />
                      {wariant.etykieta}
                    </label>
                  ))}
                  {sposob.rodzaj === 'ranking' && (
                    <ol>
                      {wybrane.map((id, indeks) => (
                        <li key={id}>
                          {
                            pytanie.warianty.find(
                              (wariant) => wariant.id === id,
                            )?.etykieta
                          }{' '}
                          <button
                            type="button"
                            disabled={indeks === 0}
                            onClick={() => {
                              const kolejnosc = [...wybrane];
                              [kolejnosc[indeks - 1], kolejnosc[indeks]] = [
                                kolejnosc[indeks]!,
                                kolejnosc[indeks - 1]!,
                              ];
                              zmien(sposob.id, {
                                sposobId: sposob.id,
                                rodzaj: 'ranking',
                                wariantyId: kolejnosc,
                              });
                            }}
                          >
                            Wyżej:{' '}
                            {
                              pytanie.warianty.find(
                                (wariant) => wariant.id === id,
                              )?.etykieta
                            }
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
              {(sposob.rodzaj === 'takNie' ||
                sposob.rodzaj === 'prawdaFalsz') &&
                [true, false].map((wybor) => (
                  <label key={String(wybor)}>
                    <input
                      type="radio"
                      name={sposob.id}
                      checked={
                        wartosc?.rodzaj === sposob.rodzaj &&
                        wartosc.wartosc === wybor
                      }
                      onChange={() =>
                        zmien(sposob.id, {
                          sposobId: sposob.id,
                          rodzaj: sposob.rodzaj,
                          wartosc: wybor,
                        })
                      }
                    />
                    {sposob.rodzaj === 'takNie'
                      ? wybor
                        ? 'TAK'
                        : 'NIE'
                      : wybor
                        ? 'PRAWDA'
                        : 'FAŁSZ'}
                  </label>
                ))}
              {sposob.rodzaj === 'otwarta' && (
                <label>
                  Treść odpowiedzi · {sposob.id}
                  <textarea
                    maxLength={sposob.maksymalnaDlugosc}
                    value={wartosc?.rodzaj === 'otwarta' ? wartosc.tekst : ''}
                    onChange={(zdarzenie) =>
                      zmien(
                        sposob.id,
                        zdarzenie.target.value.trim()
                          ? {
                              sposobId: sposob.id,
                              rodzaj: 'otwarta',
                              tekst: zdarzenie.target.value,
                            }
                          : undefined,
                      )
                    }
                  />
                </label>
              )}
              {sposob.rodzaj === 'skala' && (
                <>
                  <p>
                    Zakres {sposob.minimum}–{sposob.maksimum}, krok{' '}
                    {sposob.krok}.
                  </p>
                  {(sposob.cel === 'pytanie'
                    ? [{ id: pytanie.id, etykieta: 'Ocena pytania' }]
                    : pytanie.warianty
                  ).map((wariant) => (
                    <label key={wariant.id}>
                      {wariant.etykieta} · {sposob.id}
                      <input
                        type="number"
                        min={sposob.minimum}
                        max={sposob.maksimum}
                        step={sposob.krok}
                        value={
                          wartosc?.rodzaj === 'skala'
                            ? wartosc.cel === 'pytanie'
                              ? wartosc.wartosc
                              : (wartosc.oceny.find(
                                  (ocena) => ocena.wariantId === wariant.id,
                                )?.wartosc ?? '')
                            : ''
                        }
                        onChange={(zdarzenie) => {
                          const liczba =
                            zdarzenie.target.value === ''
                              ? undefined
                              : zdarzenie.target.valueAsNumber;
                          if (sposob.cel === 'pytanie')
                            zmien(
                              sposob.id,
                              liczba === undefined
                                ? undefined
                                : {
                                    sposobId: sposob.id,
                                    rodzaj: 'skala',
                                    cel: 'pytanie',
                                    wartosc: liczba,
                                  },
                            );
                          else {
                            const oceny = [
                              ...(wartosc?.rodzaj === 'skala' &&
                              wartosc.cel === 'warianty'
                                ? wartosc.oceny
                                : []
                              ).filter(
                                (ocena) => ocena.wariantId !== wariant.id,
                              ),
                              ...(liczba === undefined
                                ? []
                                : [{ wariantId: wariant.id, wartosc: liczba }]),
                            ];
                            zmien(
                              sposob.id,
                              oceny.length
                                ? {
                                    sposobId: sposob.id,
                                    rodzaj: 'skala',
                                    cel: 'warianty',
                                    oceny,
                                  }
                                : undefined,
                            );
                          }
                        }}
                      />
                    </label>
                  ))}
                </>
              )}
              {sposob.rodzaj === 'kombinacjaWariantow' && (
                <>
                  <p>
                    Dodaj co najmniej {sposob.minimumElementow} elementów z co
                    najmniej dwóch wariantów. Opisz wybrane fragmenty.
                  </p>
                  {wartosc?.rodzaj === 'kombinacjaWariantow' &&
                    wartosc.elementy.map((element, indeks) => (
                      <div key={indeks}>
                        <label>
                          Wariant elementu {indeks + 1} · {sposob.id}
                          <select
                            value={element.wariantId}
                            onChange={(zdarzenie) =>
                              zmien(sposob.id, {
                                ...wartosc,
                                elementy: wartosc.elementy.map(
                                  (element, miejsce) =>
                                    miejsce === indeks
                                      ? {
                                          ...element,
                                          wariantId: zdarzenie.target.value,
                                        }
                                      : element,
                                ),
                              })
                            }
                          >
                            {pytanie.warianty.map((wariant) => (
                              <option key={wariant.id} value={wariant.id}>
                                {wariant.etykieta}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Fragment elementu {indeks + 1} · {sposob.id}
                          <textarea
                            value={element.fragment}
                            onChange={(zdarzenie) =>
                              zmien(sposob.id, {
                                ...wartosc,
                                elementy: wartosc.elementy.map(
                                  (element, miejsce) =>
                                    miejsce === indeks
                                      ? {
                                          ...element,
                                          fragment: zdarzenie.target.value,
                                        }
                                      : element,
                                ),
                              })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const elementy = wartosc.elementy.filter(
                              (_, miejsce) => miejsce !== indeks,
                            );
                            zmien(
                              sposob.id,
                              elementy.length
                                ? { ...wartosc, elementy }
                                : undefined,
                            );
                          }}
                        >
                          Usuń element {indeks + 1}
                        </button>
                      </div>
                    ))}
                  <button
                    type="button"
                    onClick={() =>
                      zmien(sposob.id, {
                        sposobId: sposob.id,
                        rodzaj: 'kombinacjaWariantow',
                        elementy: [
                          ...(wartosc?.rodzaj === 'kombinacjaWariantow'
                            ? wartosc.elementy
                            : []),
                          { wariantId: pytanie.warianty[0]!.id, fragment: '' },
                        ],
                      })
                    }
                  >
                    Dodaj element · {sposob.id}
                  </button>
                </>
              )}
              {!sposob.wymagany && (
                <button type="button" onClick={() => zmien(sposob.id)}>
                  Wyczyść · {sposob.id}
                </button>
              )}
            </fieldset>
          );
        })}
      <label>
        Komentarz (opcjonalny)
        <textarea
          disabled={zablokowany}
          value={szkic.notatka}
          onChange={(zdarzenie) =>
            ustawSzkic({ ...szkic, notatka: zdarzenie.target.value })
          }
        />
      </label>
      {niezapisany && <p role="status">Zapisywanie szkicu odpowiedzi…</p>}
      {blad && <p role="alert">{blad}</p>}
      <button
        className="przycisk"
        disabled={zablokowany || niezapisany}
        onClick={async () => {
          const odpowiedz =
            tylkoKomentarz && decyzja?.odpowiedz.rodzaj === 'wlasna'
              ? decyzja.odpowiedz
              : { rodzaj: 'standardowa' as const, wartosci: szkic.wartosci };
          const walidacja = walidujOdpowiedz(pytanie, odpowiedz);
          if (walidacja.stan !== 'gotowy') {
            ustawBlad(walidacja.opis);
            return;
          }
          const wynik = aktualizujSesje(
            przebieg,
            zatwierdzDecyzje(przebieg.przebieg, {
              id: crypto.randomUUID(),
              zatwierdzono: new Date().toISOString(),
              pytanieId: pytanie.id,
              odpowiedz,
              notatka: szkic.notatka,
              adnotacje: decyzja?.adnotacje ?? [],
            }),
            new Date().toISOString(),
          );
          if (wynik.stan !== 'gotowy') {
            ustawBlad(wynik.opis);
            return;
          }
          const pozostale = { ...(szkice.success ? szkice.data : {}) };
          delete pozostale[pytanie.id];
          await zapisz({
            stan: 'gotowy',
            wartosc: {
              ...wynik.wartosc,
              sesja: { ...wynik.wartosc.sesja, szkiceStandardowe: pozostale },
            },
          });
        }}
      >
        {tylkoKomentarz
          ? 'Zapisz odpowiedź z komentarzem'
          : 'Zatwierdź odpowiedzi'}
      </button>
    </section>
  );
}
