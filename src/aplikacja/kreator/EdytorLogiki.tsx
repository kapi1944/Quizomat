import type {
  MechanikaOdpowiedzi,
  Pytanie,
  Quiz,
  RegulaAdaptacyjna,
} from '../../domena/quiz';
import { nazwyTypow } from './mechaniki';
import { PolaRekomendacji } from './PolaZaawansowane';

function operatorDla(mechanika: MechanikaOdpowiedzi) {
  if (mechanika.rodzaj === 'skala')
    return mechanika.cel === 'pytanie' ? 'coNajmniej' : null;
  return ['wielokrotnyWybor', 'ranking', 'kombinacjaWariantow'].includes(
    mechanika.rodzaj,
  )
    ? 'zawieraWariant'
    : 'rowne';
}

function nowyWarunek(
  pytanie: Pytanie,
  mechanika: MechanikaOdpowiedzi,
): RegulaAdaptacyjna['warunek'] {
  const podstawa = { pytanieId: pytanie.id, sposobId: mechanika.id };
  const operator = operatorDla(mechanika);
  if (operator === 'coNajmniej' && mechanika.rodzaj === 'skala')
    return { ...podstawa, operator, wartosc: mechanika.minimum };
  if (operator === 'zawieraWariant')
    return { ...podstawa, operator, wartosc: pytanie.warianty[0]?.id ?? '' };
  return {
    ...podstawa,
    operator: 'rowne',
    wartosc:
      mechanika.rodzaj === 'takNie' || mechanika.rodzaj === 'prawdaFalsz'
        ? true
        : mechanika.rodzaj === 'otwarta'
          ? ''
          : (pytanie.warianty[0]?.id ?? ''),
  };
}

export function EdytorLogiki({
  quiz,
  zmien,
}: {
  quiz: Quiz;
  zmien: (reguly: RegulaAdaptacyjna[]) => void;
}) {
  const pytania = [...quiz.pytania, ...quiz.pytaniaDodatkowe];
  const zrodla = pytania.filter((pytanie) =>
    pytanie.sposobyOdpowiedzi.some(
      (mechanika) => operatorDla(mechanika) !== null,
    ),
  );
  const opcje = (lista: Pytanie[]) =>
    lista.map((pytanie, indeks) => (
      <option key={pytanie.id} value={pytanie.id}>
        {pytanie.tresc || `Pytanie ${indeks + 1}`}
      </option>
    ));
  return (
    <section aria-label="Edytor logiki adaptacyjnej">
      <h2>Logika adaptacyjna</h2>
      <p className="etykieta">
        Reguły działają po zatwierdzeniu odpowiedzi. Możesz też utworzyć quiz
        bez reguł.
      </p>
      {quiz.reguly.map((regula, indeks) => {
        const ustaw = (nowa: RegulaAdaptacyjna) =>
          zmien(
            quiz.reguly.map((element) =>
              element.id === regula.id ? nowa : element,
            ),
          );
        const zrodlo = pytania.find(
          (pytanie) => pytanie.id === regula.warunek.pytanieId,
        );
        const mechanika = zrodlo?.sposobyOdpowiedzi.find(
          (element) => element.id === regula.warunek.sposobId,
        );
        const cel = pytania.find(
          (pytanie) => pytanie.id === regula.operacja.pytanieId,
        );
        const dostepne = pytania.filter(
          (pytanie) =>
            pytanie.id !== regula.warunek.pytanieId &&
            !quiz.reguly.some(
              (inna) =>
                inna.id !== regula.id && inna.operacja.pytanieId === pytanie.id,
            ),
        );
        const cele =
          regula.operacja.rodzaj === 'dodaj'
            ? dostepne.filter((pytanie) =>
                quiz.pytaniaDodatkowe.some(
                  (element) => element.id === pytanie.id,
                ),
              )
            : dostepne;
        const zmienOperacje = (
          rodzaj: RegulaAdaptacyjna['operacja']['rodzaj'],
        ) => {
          const cel = (
            rodzaj === 'dodaj'
              ? dostepne.filter((pytanie) =>
                  quiz.pytaniaDodatkowe.some(
                    (element) => element.id === pytanie.id,
                  ),
                )
              : dostepne
          )[0];
          ustaw({
            ...regula,
            operacja:
              rodzaj === 'dodaj'
                ? {
                    rodzaj,
                    pytanieId: cel?.id ?? '',
                    poPytaniuId: regula.warunek.pytanieId,
                  }
                : rodzaj === 'modyfikuj'
                  ? {
                      rodzaj,
                      pytanieId: cel?.id ?? '',
                      zmiany: { tresc: cel?.tresc ?? '' },
                    }
                  : { rodzaj, pytanieId: cel?.id ?? '' },
          });
        };
        const zmiany =
          regula.operacja.rodzaj === 'modyfikuj'
            ? regula.operacja.zmiany
            : null;
        const ustawZmiany = (nowe: NonNullable<typeof zmiany>) => {
          if (regula.operacja.rodzaj === 'modyfikuj')
            ustaw({
              ...regula,
              operacja: { ...regula.operacja, zmiany: nowe },
            });
        };
        return (
          <details
            className="regula-kreatora"
            key={regula.id}
            open={quiz.reguly.length === 1}
          >
            <summary>
              Reguła {indeks + 1}: {regula.powod || 'Nowa reguła'}
            </summary>
            <fieldset aria-label={`Reguła ${indeks + 1}`}>
              <legend className="tylko-czytnik">Reguła {indeks + 1}</legend>
              <label>
                Powód reguły
                <textarea
                  rows={2}
                  value={regula.powod}
                  onChange={(zdarzenie) =>
                    ustaw({ ...regula, powod: zdarzenie.target.value })
                  }
                />
              </label>
              <h3>Jeżeli</h3>
              <label>
                Pytanie źródłowe
                <select
                  value={regula.warunek.pytanieId}
                  onChange={(zdarzenie) => {
                    const pytanie = zrodla.find(
                      (element) => element.id === zdarzenie.target.value,
                    )!;
                    if (!pytanie) return;
                    ustaw({
                      ...regula,
                      warunek: nowyWarunek(
                        pytanie,
                        pytanie.sposobyOdpowiedzi.find(
                          (element) => operatorDla(element) !== null,
                        )!,
                      ),
                    });
                  }}
                >
                  <option value="">Wybierz pytanie</option>
                  {opcje(zrodla)}
                </select>
              </label>
              <label>
                Źródłowy sposób odpowiedzi
                <select
                  value={regula.warunek.sposobId}
                  onChange={(zdarzenie) => {
                    const mechanika = zrodlo?.sposobyOdpowiedzi.find(
                      (element) => element.id === zdarzenie.target.value,
                    );
                    if (zrodlo && mechanika)
                      ustaw({
                        ...regula,
                        warunek: nowyWarunek(zrodlo, mechanika),
                      });
                  }}
                >
                  <option value="">Wybierz sposób</option>
                  {zrodlo?.sposobyOdpowiedzi.map((element, numer) => (
                    <option
                      key={element.id}
                      value={element.id}
                      disabled={operatorDla(element) === null}
                    >
                      {numer + 1}. {nazwyTypow[element.rodzaj]}
                      {operatorDla(element) === null
                        ? ' — brak operatora w 1.0.0'
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Operator
                <select value={regula.warunek.operator} disabled>
                  <option value={regula.warunek.operator}>
                    {
                      {
                        rowne: 'Równa się',
                        zawieraWariant: 'Zawiera wariant',
                        coNajmniej: 'Co najmniej',
                      }[regula.warunek.operator]
                    }
                  </option>
                </select>
              </label>
              {mechanika?.rodzaj === 'takNie' ||
              mechanika?.rodzaj === 'prawdaFalsz' ? (
                <label>
                  Wartość warunku
                  <select
                    value={String(regula.warunek.wartosc)}
                    onChange={(zdarzenie) =>
                      ustaw({
                        ...regula,
                        warunek: {
                          ...regula.warunek,
                          operator: 'rowne',
                          wartosc: zdarzenie.target.value === 'true',
                        },
                      })
                    }
                  >
                    <option value="true">
                      {mechanika.rodzaj === 'takNie' ? 'TAK' : 'PRAWDA'}
                    </option>
                    <option value="false">
                      {mechanika.rodzaj === 'takNie' ? 'NIE' : 'FAŁSZ'}
                    </option>
                  </select>
                </label>
              ) : regula.warunek.operator === 'coNajmniej' ? (
                <label>
                  Próg warunku
                  <input
                    type="number"
                    step="any"
                    value={
                      Number.isFinite(regula.warunek.wartosc)
                        ? regula.warunek.wartosc
                        : ''
                    }
                    onChange={(zdarzenie) =>
                      ustaw({
                        ...regula,
                        warunek: {
                          ...regula.warunek,
                          operator: 'coNajmniej',
                          wartosc: zdarzenie.target.valueAsNumber,
                        },
                      })
                    }
                  />
                </label>
              ) : mechanika?.rodzaj === 'otwarta' ? (
                <label>
                  Tekst warunku
                  <input
                    value={String(regula.warunek.wartosc)}
                    onChange={(zdarzenie) =>
                      ustaw({
                        ...regula,
                        warunek: {
                          ...regula.warunek,
                          operator: 'rowne',
                          wartosc: zdarzenie.target.value,
                        },
                      })
                    }
                  />
                </label>
              ) : (
                <label>
                  Wariant warunku
                  <select
                    value={String(regula.warunek.wartosc)}
                    onChange={(zdarzenie) =>
                      ustaw({
                        ...regula,
                        warunek: {
                          ...regula.warunek,
                          operator:
                            regula.warunek.operator === 'zawieraWariant'
                              ? 'zawieraWariant'
                              : 'rowne',
                          wartosc: zdarzenie.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Wybierz wariant</option>
                    {zrodlo?.warianty.map((wariant, numer) => (
                      <option key={wariant.id} value={wariant.id}>
                        {wariant.etykieta || `Wariant ${numer + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <h3>To</h3>
              <label>
                Operacja
                <select
                  value={regula.operacja.rodzaj}
                  onChange={(zdarzenie) =>
                    zmienOperacje(
                      zdarzenie.target
                        .value as RegulaAdaptacyjna['operacja']['rodzaj'],
                    )
                  }
                >
                  <option
                    value="dodaj"
                    disabled={!quiz.pytaniaDodatkowe.length}
                  >
                    Dodaj pytanie dodatkowe
                  </option>
                  <option value="pomin">Pomiń pytanie</option>
                  <option value="modyfikuj">Zmodyfikuj pytanie</option>
                </select>
              </label>
              <label>
                Pytanie docelowe
                <select
                  value={regula.operacja.pytanieId}
                  onChange={(zdarzenie) =>
                    ustaw({
                      ...regula,
                      operacja:
                        regula.operacja.rodzaj === 'modyfikuj'
                          ? {
                              ...regula.operacja,
                              pytanieId: zdarzenie.target.value,
                              zmiany: {
                                tresc:
                                  pytania.find(
                                    (pytanie) =>
                                      pytanie.id === zdarzenie.target.value,
                                  )?.tresc ?? '',
                              },
                            }
                          : {
                              ...regula.operacja,
                              pytanieId: zdarzenie.target.value,
                            },
                    })
                  }
                >
                  <option value="">Wybierz pytanie</option>
                  {opcje(cele)}
                </select>
              </label>
              {regula.operacja.rodzaj === 'dodaj' && (
                <label>
                  Dodaj po pytaniu
                  <select
                    value={regula.operacja.poPytaniuId}
                    onChange={(zdarzenie) => {
                      if (regula.operacja.rodzaj === 'dodaj')
                        ustaw({
                          ...regula,
                          operacja: {
                            ...regula.operacja,
                            poPytaniuId: zdarzenie.target.value,
                          },
                        });
                    }}
                  >
                    <option value="">Wybierz miejsce</option>
                    {opcje(
                      pytania.filter(
                        (pytanie) => pytanie.id !== regula.operacja.pytanieId,
                      ),
                    )}
                  </select>
                </label>
              )}
              {zmiany && (
                <div>
                  {(['tresc', 'wyjasnienie'] as const).map((pole) => (
                    <div key={pole}>
                      <label className="pole-wyboru-kreatora">
                        <input
                          type="checkbox"
                          checked={zmiany[pole] !== undefined}
                          onChange={(zdarzenie) => {
                            const nowe = { ...zmiany };
                            if (zdarzenie.target.checked)
                              nowe[pole] = cel?.[pole] ?? '';
                            else delete nowe[pole];
                            ustawZmiany(nowe);
                          }}
                        />
                        {pole === 'tresc' ? 'Zmień treść' : 'Zmień wyjaśnienie'}
                      </label>
                      {zmiany[pole] !== undefined && (
                        <label>
                          {pole === 'tresc'
                            ? 'Nowa treść pytania'
                            : 'Nowe wyjaśnienie pytania'}
                          <textarea
                            rows={2}
                            value={zmiany[pole]}
                            onChange={(zdarzenie) =>
                              ustawZmiany({
                                ...zmiany,
                                [pole]: zdarzenie.target.value,
                              })
                            }
                          />
                        </label>
                      )}
                    </div>
                  ))}
                  <label className="pole-wyboru-kreatora">
                    <input
                      type="checkbox"
                      disabled={!cel?.warianty.length}
                      checked={!!zmiany.rekomendacja}
                      onChange={(zdarzenie) => {
                        const nowe = { ...zmiany };
                        if (zdarzenie.target.checked)
                          nowe.rekomendacja = {
                            wariantId: cel?.warianty[0]?.id ?? '',
                            uzasadnienie: '',
                          };
                        else delete nowe.rekomendacja;
                        ustawZmiany(nowe);
                      }}
                    />
                    Zmień rekomendację
                  </label>
                  {zmiany.rekomendacja && (
                    <PolaRekomendacji
                      wartosc={zmiany.rekomendacja}
                      warianty={cel?.warianty ?? []}
                      zmien={(rekomendacja) =>
                        ustawZmiany({ ...zmiany, rekomendacja })
                      }
                    />
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  zmien(
                    quiz.reguly.filter((element) => element.id !== regula.id),
                  )
                }
              >
                Usuń regułę {indeks + 1}
              </button>
            </fieldset>
          </details>
        );
      })}
      <button
        type="button"
        className="przycisk drugorzedny"
        disabled={!zrodla.length || pytania.length < 2}
        onClick={() => {
          const zrodlo = zrodla[0]!;
          const dodatkowe = quiz.pytaniaDodatkowe.find(
            (pytanie) => pytanie.id !== zrodlo.id,
          );
          const cel =
            dodatkowe ?? pytania.find((pytanie) => pytanie.id !== zrodlo.id)!;
          zmien([
            ...quiz.reguly,
            {
              id: crypto.randomUUID(),
              powod: '',
              warunek: nowyWarunek(
                zrodlo,
                zrodlo.sposobyOdpowiedzi.find(
                  (mechanika) => operatorDla(mechanika) !== null,
                )!,
              ),
              operacja: dodatkowe
                ? { rodzaj: 'dodaj', pytanieId: cel.id, poPytaniuId: zrodlo.id }
                : { rodzaj: 'pomin', pytanieId: cel.id },
            },
          ]);
        }}
      >
        + Dodaj regułę
      </button>
    </section>
  );
}
