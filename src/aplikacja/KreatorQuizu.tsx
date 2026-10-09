import {
  useEffect as poZmianie,
  useRef as referencja,
  useState as stan,
} from 'react';
import { Link as Odnosnik, useNavigate as nawigacja } from 'react-router-dom';
import type { MechanikaOdpowiedzi, Pytanie, Quiz } from '../domena/quiz';
import { zapiszZatwierdzonyQuiz } from '../dane/biblioteka';
import { walidujImportQuizu } from '../import/walidator';

const nazwyTypow: Record<MechanikaOdpowiedzi['rodzaj'], string> = {
  pojedynczyWybor: 'Jedna odpowiedź',
  wielokrotnyWybor: 'Wiele odpowiedzi',
  takNie: 'Tak / Nie',
  prawdaFalsz: 'Prawda / Fałsz',
  otwarta: 'Odpowiedź tekstowa',
  skala: 'Skala oceny',
  ranking: 'Ranking wariantów',
  kombinacjaWariantow: 'Kombinacja fragmentów',
};

function nowyWariant() {
  return { id: crypto.randomUUID(), etykieta: '' };
}

function nowePytanie(): Pytanie {
  return {
    id: crypto.randomUUID(),
    tresc: '',
    prezentacja: { rodzaj: 'tekstowa' },
    warianty: [nowyWariant(), nowyWariant()],
    sposobyOdpowiedzi: [
      { id: crypto.randomUUID(), rodzaj: 'pojedynczyWybor', wymagany: true },
    ],
  };
}

function uzywaWariantow(rodzaj: MechanikaOdpowiedzi['rodzaj']) {
  return (
    rodzaj === 'pojedynczyWybor' ||
    rodzaj === 'wielokrotnyWybor' ||
    rodzaj === 'ranking' ||
    rodzaj === 'kombinacjaWariantow'
  );
}

export function KreatorQuizu() {
  const przejdz = nawigacja();
  const [quiz, ustawQuiz] = stan<Quiz>(() => ({
    schemaVersion: '1.0.0',
    id: crypto.randomUUID(),
    wersjaQuizu: '1.0.0',
    tytul: '',
    jezyk: 'pl',
    liczbaPytan: 1,
    pytania: [nowePytanie()],
    pytaniaDodatkowe: [],
    reguly: [],
  }));
  const [krok, ustawKrok] = stan(0);
  const [aktywneId, ustawAktywneId] = stan(quiz.pytania[0]!.id);
  const [bledy, ustawBledy] = stan<string[]>([]);
  const [zapisywanie, ustawZapisywanie] = stan(false);
  const trwaZapis = referencja(false);
  const naglowek = referencja<HTMLHeadingElement>(null);
  const pytanie = quiz.pytania.find((element) => element.id === aktywneId)!;
  const indeks = quiz.pytania.indexOf(pytanie);
  const mechanika = pytanie.sposobyOdpowiedzi[0]!;
  const wynik = krok === 2 ? walidujImportQuizu(JSON.stringify(quiz)) : null;
  const [potwierdzoneOstrzezenia, ustawPotwierdzoneOstrzezenia] = stan(false);

  poZmianie(() => {
    naglowek.current?.focus();
  }, [krok]);

  function zmienPytanie(zmiany: Partial<Pytanie>) {
    ustawQuiz((poprzedni) => ({
      ...poprzedni,
      pytania: poprzedni.pytania.map((element) =>
        element.id === aktywneId ? { ...element, ...zmiany } : element,
      ),
    }));
    ustawBledy([]);
  }

  function zmienMechanike(zmiany: Partial<MechanikaOdpowiedzi>) {
    zmienPytanie({
      sposobyOdpowiedzi: [{ ...mechanika, ...zmiany } as MechanikaOdpowiedzi],
    });
  }

  function zmienTyp(rodzaj: MechanikaOdpowiedzi['rodzaj']) {
    const warianty = uzywaWariantow(rodzaj)
      ? pytanie.warianty.length >= 2
        ? pytanie.warianty
        : [nowyWariant(), nowyWariant()]
      : [];
    const podstawa = { id: mechanika.id, wymagany: mechanika.wymagany };
    let nowa: MechanikaOdpowiedzi;
    switch (rodzaj) {
      case 'wielokrotnyWybor':
      case 'ranking':
        nowa = { ...podstawa, rodzaj, minimum: 1, maksimum: warianty.length };
        break;
      case 'otwarta':
        nowa = { ...podstawa, rodzaj, maksymalnaDlugosc: 2000 };
        break;
      case 'skala':
        nowa = {
          ...podstawa,
          rodzaj,
          cel: 'pytanie',
          minimum: 1,
          maksimum: 5,
          krok: 1,
        };
        break;
      case 'kombinacjaWariantow':
        nowa = { ...podstawa, rodzaj, minimumElementow: 1 };
        break;
      default:
        nowa = { ...podstawa, rodzaj };
    }
    zmienPytanie({ warianty, sposobyOdpowiedzi: [nowa] });
  }

  function zmienWarianty(warianty: Pytanie['warianty']) {
    zmienPytanie({
      warianty,
      sposobyOdpowiedzi: [
        mechanika.rodzaj === 'wielokrotnyWybor' ||
        mechanika.rodzaj === 'ranking'
          ? {
              ...mechanika,
              minimum: Math.min(mechanika.minimum, warianty.length),
              maksimum: Math.min(mechanika.maksimum, warianty.length),
            }
          : mechanika,
      ],
    });
  }

  function przesunPytanie(kierunek: number) {
    const pytania = [...quiz.pytania];
    const nowyIndeks = indeks + kierunek;
    if (nowyIndeks < 0 || nowyIndeks >= pytania.length) return;
    [pytania[indeks], pytania[nowyIndeks]] = [
      pytania[nowyIndeks]!,
      pytania[indeks]!,
    ];
    ustawQuiz({ ...quiz, pytania });
  }

  function dalej() {
    if (krok === 0) {
      const problemy = [
        ...(!quiz.tytul.trim() ? ['Podaj tytuł quizu.'] : []),
        ...(!quiz.jezyk.trim() ? ['Podaj język quizu.'] : []),
      ];
      ustawBledy(problemy);
      if (problemy.length) return;
    } else {
      const sprawdzenie = walidujImportQuizu(JSON.stringify(quiz));
      if (sprawdzenie.stan === 'zablokowany') {
        ustawBledy(
          sprawdzenie.raport.bledy.map((problem) => {
            const numer =
              problem.sciezka[0] === 'pytania' &&
              typeof problem.sciezka[1] === 'number'
                ? `Pytanie ${problem.sciezka[1] + 1}: `
                : '';
            return numer + problem.opis;
          }),
        );
        return;
      }
    }
    ustawBledy([]);
    ustawPotwierdzoneOstrzezenia(false);
    ustawKrok(krok + 1);
  }

  async function zapisz() {
    if (trwaZapis.current || !wynik || wynik.stan === 'zablokowany') return;
    if (wynik.raport.ostrzezenia.length && !potwierdzoneOstrzezenia) return;
    trwaZapis.current = true;
    ustawZapisywanie(true);
    ustawBledy([]);
    try {
      await zapiszZatwierdzonyQuiz(wynik);
      przejdz('/biblioteka');
    } catch (blad) {
      ustawBledy([
        blad instanceof Error
          ? blad.message
          : 'Nie zapisano quizu. Spróbuj ponownie.',
      ]);
    } finally {
      trwaZapis.current = false;
      ustawZapisywanie(false);
    }
  }

  return (
    <section className="panel kreator-quizu">
      <p className="nadtytul">Twoje pytania. Twój quiz.</p>
      <h1 ref={naglowek} tabIndex={-1}>
        Stwórz nowy quiz
      </h1>
      <p className="wprowadzenie-kreatora">
        Od pierwszego pytania do gotowego quizu — w trzech prostych krokach.
      </p>
      <ol className="kroki-kreatora" aria-label="Etapy tworzenia quizu">
        {['Opis quizu', 'Pytania', 'Podgląd i zapis'].map((etykieta, numer) => (
          <li key={etykieta} aria-current={numer === krok ? 'step' : undefined}>
            <span className="numer-kroku" aria-hidden="true">
              {numer < krok ? '✓' : numer + 1}
            </span>
            <span>{etykieta}</span>
          </li>
        ))}
      </ol>
      <form
        noValidate
        onSubmit={(zdarzenie) => {
          zdarzenie.preventDefault();
          if (krok < 2) dalej();
          else void zapisz();
        }}
      >
        <fieldset className="pola-kreatora" disabled={zapisywanie}>
          <legend className="tylko-czytnik">
            {['Opis quizu', 'Pytania', 'Podgląd i zapis'][krok]}
          </legend>
          {krok === 0 && (
            <div className="opis-kreatora">
              <div className="pola-opisu">
                <h2>Zacznij od pomysłu</h2>
                <label>
                  Tytuł quizu
                  <input
                    required
                    value={quiz.tytul}
                    placeholder="Np. Jak chcemy pracować?"
                    autoComplete="off"
                    onChange={(zdarzenie) => {
                      ustawQuiz({ ...quiz, tytul: zdarzenie.target.value });
                      ustawBledy([]);
                    }}
                  />
                </label>
                <label>
                  Opis (opcjonalny)
                  <textarea
                    rows={4}
                    value={quiz.opis ?? ''}
                    placeholder="O czym jest quiz i w czym ma pomóc?"
                    onChange={(zdarzenie) => {
                      ustawQuiz({
                        ...quiz,
                        opis: zdarzenie.target.value || undefined,
                      });
                      ustawBledy([]);
                    }}
                  />
                </label>
                <label>
                  Język quizu
                  <input
                    required
                    value={quiz.jezyk}
                    placeholder="pl"
                    autoComplete="off"
                    onChange={(zdarzenie) => {
                      ustawQuiz({ ...quiz, jezyk: zdarzenie.target.value });
                      ustawBledy([]);
                    }}
                  />
                </label>
              </div>
              <aside className="wskazowka-kreatora">
                <span className="symbol-kreatora" aria-hidden="true">
                  ✦
                </span>
                <h3>Dobre pytania robią różnicę</h3>
                <p>
                  Nazwij temat, dodaj pytania i wybierz sposób odpowiedzi. Przed
                  zapisem obejrzysz cały quiz.
                </p>
                <p className="etykieta">
                  Quiz trafi do lokalnej Biblioteki dopiero po Twoim
                  zatwierdzeniu.
                </p>
              </aside>
            </div>
          )}
          {krok === 1 && (
            <div className="uklad-pytan-kreatora">
              <aside className="lista-pytan-kreatora" aria-label="Lista pytań">
                <h2>
                  Twoje pytania{' '}
                  <span className="liczba-kreatora">{quiz.pytania.length}</span>
                </h2>
                <ol>
                  {quiz.pytania.map((element, numer) => (
                    <li key={element.id}>
                      <button
                        type="button"
                        aria-pressed={element.id === aktywneId}
                        onClick={() => ustawAktywneId(element.id)}
                      >
                        <span className="numer-pytania">{numer + 1}</span>
                        <span>
                          {element.tresc || 'Nowe pytanie'}
                          <small>
                            {nazwyTypow[element.sposobyOdpowiedzi[0]!.rodzaj]}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className="przycisk drugorzedny"
                  onClick={() => {
                    const nowe = nowePytanie();
                    ustawQuiz({
                      ...quiz,
                      liczbaPytan: quiz.pytania.length + 1,
                      pytania: [...quiz.pytania, nowe],
                    });
                    ustawAktywneId(nowe.id);
                    ustawBledy([]);
                  }}
                >
                  + Dodaj pytanie
                </button>
              </aside>
              <section
                className="edytor-pytania"
                aria-label={`Edycja pytania ${indeks + 1}`}
              >
                <div className="naglowek-edytora">
                  <h2>Pytanie {indeks + 1}</h2>
                  <div className="narzedzia-kreatora">
                    <button
                      type="button"
                      disabled={indeks === 0}
                      aria-label="Przesuń pytanie w górę"
                      onClick={() => przesunPytanie(-1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={indeks === quiz.pytania.length - 1}
                      aria-label="Przesuń pytanie w dół"
                      onClick={() => przesunPytanie(1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={quiz.pytania.length === 1}
                      onClick={() => {
                        const pytania = quiz.pytania.filter(
                          (element) => element.id !== aktywneId,
                        );
                        ustawQuiz({
                          ...quiz,
                          pytania,
                          liczbaPytan: pytania.length,
                        });
                        ustawAktywneId(
                          pytania[Math.min(indeks, pytania.length - 1)]!.id,
                        );
                        ustawBledy([]);
                      }}
                    >
                      Usuń pytanie
                    </button>
                  </div>
                </div>
                <label>
                  Treść pytania
                  <textarea
                    required
                    rows={3}
                    value={pytanie.tresc}
                    placeholder="O co chcesz zapytać?"
                    onChange={(zdarzenie) =>
                      zmienPytanie({ tresc: zdarzenie.target.value })
                    }
                  />
                </label>
                <label>
                  Sposób odpowiedzi
                  <select
                    value={mechanika.rodzaj}
                    onChange={(zdarzenie) =>
                      zmienTyp(
                        zdarzenie.target.value as MechanikaOdpowiedzi['rodzaj'],
                      )
                    }
                  >
                    {Object.entries(nazwyTypow).map(([wartosc, nazwa]) => (
                      <option key={wartosc} value={wartosc}>
                        {nazwa}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pole-wyboru-kreatora">
                  <input
                    type="checkbox"
                    checked={mechanika.wymagany}
                    onChange={(zdarzenie) =>
                      zmienMechanike({ wymagany: zdarzenie.target.checked })
                    }
                  />
                  Wymagana odpowiedź
                </label>
                {uzywaWariantow(mechanika.rodzaj) && (
                  <div className="warianty-kreatora">
                    <h3>Warianty odpowiedzi</h3>
                    {pytanie.warianty.map((wariant, numer) => (
                      <div className="wariant-kreatora" key={wariant.id}>
                        <label>
                          Wariant {numer + 1}
                          <input
                            required
                            value={wariant.etykieta}
                            placeholder={`Treść wariantu ${numer + 1}`}
                            onChange={(zdarzenie) =>
                              zmienPytanie({
                                warianty: pytanie.warianty.map((element) =>
                                  element.id === wariant.id
                                    ? {
                                        ...element,
                                        etykieta: zdarzenie.target.value,
                                      }
                                    : element,
                                ),
                              })
                            }
                          />
                        </label>
                        <button
                          className="usun-wariant"
                          type="button"
                          aria-label={`Usuń wariant ${numer + 1}`}
                          disabled={pytanie.warianty.length <= 2}
                          onClick={() =>
                            zmienWarianty(
                              pytanie.warianty.filter(
                                (element) => element.id !== wariant.id,
                              ),
                            )
                          }
                        >
                          ×
                        </button>
                        <details>
                          <summary>Opis wariantu</summary>
                          <label>
                            Opis wariantu {numer + 1} (opcjonalny)
                            <textarea
                              rows={2}
                              value={wariant.opis ?? ''}
                              onChange={(zdarzenie) =>
                                zmienPytanie({
                                  warianty: pytanie.warianty.map((element) =>
                                    element.id === wariant.id
                                      ? {
                                          ...element,
                                          opis:
                                            zdarzenie.target.value || undefined,
                                        }
                                      : element,
                                  ),
                                })
                              }
                            />
                          </label>
                        </details>
                      </div>
                    ))}
                    <button
                      className="przycisk drugorzedny"
                      type="button"
                      onClick={() =>
                        zmienPytanie({
                          warianty: [...pytanie.warianty, nowyWariant()],
                        })
                      }
                    >
                      + Dodaj wariant
                    </button>
                  </div>
                )}
                {(mechanika.rodzaj === 'wielokrotnyWybor' ||
                  mechanika.rodzaj === 'ranking' ||
                  mechanika.rodzaj === 'skala') && (
                  <div className="zakres-kreatora">
                    <label>
                      {mechanika.rodzaj === 'skala'
                        ? 'Początek skali'
                        : 'Minimum wyborów'}
                      <input
                        type="number"
                        step="any"
                        value={
                          Number.isNaN(mechanika.minimum)
                            ? ''
                            : mechanika.minimum
                        }
                        onChange={(zdarzenie) =>
                          zmienMechanike({
                            minimum: zdarzenie.target.valueAsNumber,
                          })
                        }
                      />
                    </label>
                    <label>
                      {mechanika.rodzaj === 'skala'
                        ? 'Koniec skali'
                        : 'Maksimum wyborów'}
                      <input
                        type="number"
                        step="any"
                        value={
                          Number.isNaN(mechanika.maksimum)
                            ? ''
                            : mechanika.maksimum
                        }
                        onChange={(zdarzenie) =>
                          zmienMechanike({
                            maksimum: zdarzenie.target.valueAsNumber,
                          })
                        }
                      />
                    </label>
                    {mechanika.rodzaj === 'skala' && (
                      <label>
                        Krok skali
                        <input
                          type="number"
                          step="any"
                          value={
                            Number.isNaN(mechanika.krok) ? '' : mechanika.krok
                          }
                          onChange={(zdarzenie) =>
                            zmienMechanike({
                              krok: zdarzenie.target.valueAsNumber,
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                )}
                {mechanika.rodzaj === 'otwarta' && (
                  <label>
                    Limit znaków
                    <input
                      type="number"
                      min="1"
                      value={
                        Number.isNaN(mechanika.maksymalnaDlugosc)
                          ? ''
                          : mechanika.maksymalnaDlugosc
                      }
                      onChange={(zdarzenie) =>
                        zmienMechanike({
                          maksymalnaDlugosc: zdarzenie.target.valueAsNumber,
                        })
                      }
                    />
                  </label>
                )}
                {mechanika.rodzaj === 'kombinacjaWariantow' && (
                  <label>
                    Minimum fragmentów
                    <input
                      type="number"
                      min="1"
                      value={
                        Number.isNaN(mechanika.minimumElementow)
                          ? ''
                          : mechanika.minimumElementow
                      }
                      onChange={(zdarzenie) =>
                        zmienMechanike({
                          minimumElementow: zdarzenie.target.valueAsNumber,
                        })
                      }
                    />
                  </label>
                )}
                <details className="wyjasnienie-kreatora">
                  <summary>Dodaj wyjaśnienie pytania</summary>
                  <label>
                    Wyjaśnienie (opcjonalne)
                    <textarea
                      rows={3}
                      value={pytanie.wyjasnienie ?? ''}
                      onChange={(zdarzenie) =>
                        zmienPytanie({
                          wyjasnienie: zdarzenie.target.value || undefined,
                        })
                      }
                    />
                  </label>
                </details>
              </section>
            </div>
          )}
          {krok === 2 && (
            <div className="podglad-kreatora">
              <div className="podsumowanie-kreatora">
                <span className="etykieta">
                  Gotowy do zatwierdzenia · {quiz.pytania.length} pytań
                </span>
                <h2>{quiz.tytul}</h2>
                {quiz.opis && <p>{quiz.opis}</p>}
                <p className="etykieta">
                  Sprawdź treść. Możesz wrócić do edycji przed zapisaniem.
                </p>
              </div>
              {quiz.pytania.map((element, numer) => (
                <section className="karta-podgladu-kreatora" key={element.id}>
                  <p className="etykieta">
                    Pytanie {numer + 1} ·{' '}
                    {nazwyTypow[element.sposobyOdpowiedzi[0]!.rodzaj]}
                  </p>
                  <h3>{element.tresc}</h3>
                  {element.wyjasnienie && <p>{element.wyjasnienie}</p>}
                  {element.warianty.length > 0 && (
                    <ol>
                      {element.warianty.map((wariant) => (
                        <li key={wariant.id}>
                          {wariant.etykieta}
                          {wariant.opis && <p>{wariant.opis}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                  {element.sposobyOdpowiedzi.map((sposob) => (
                    <p className="etykieta" key={sposob.id}>
                      {sposob.wymagany
                        ? 'Odpowiedź wymagana'
                        : 'Odpowiedź opcjonalna'}
                      {(sposob.rodzaj === 'wielokrotnyWybor' ||
                        sposob.rodzaj === 'ranking') &&
                        ` · Wybory: ${sposob.minimum}–${sposob.maksimum}`}
                      {sposob.rodzaj === 'skala' &&
                        ` · Skala: ${sposob.minimum}–${sposob.maksimum}, krok ${sposob.krok}`}
                      {sposob.rodzaj === 'otwarta' &&
                        ` · Limit: ${sposob.maksymalnaDlugosc} znaków`}
                      {sposob.rodzaj === 'kombinacjaWariantow' &&
                        ` · Minimum fragmentów: ${sposob.minimumElementow}`}
                    </p>
                  ))}
                </section>
              ))}
              {!!wynik?.raport.ostrzezenia.length && (
                <div className="ostrzezenia-kreatora">
                  <h3>Sprawdź przed zapisem</h3>
                  <ul>
                    {wynik.raport.ostrzezenia.map((problem, numer) => (
                      <li key={numer}>{problem.opis}</li>
                    ))}
                  </ul>
                  <label className="pole-wyboru-kreatora">
                    <input
                      type="checkbox"
                      checked={potwierdzoneOstrzezenia}
                      onChange={(zdarzenie) =>
                        ustawPotwierdzoneOstrzezenia(zdarzenie.target.checked)
                      }
                    />
                    Akceptuję ostrzeżenia i chcę zapisać quiz
                  </label>
                </div>
              )}
            </div>
          )}
          {bledy.length > 0 && (
            <div className="bledy-kreatora" role="alert">
              <p>Sprawdź formularz:</p>
              <ul>
                {bledy.map((blad, numer) => (
                  <li key={numer}>{blad}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="dzialania-kreatora">
            {krok > 0 ? (
              <button
                type="button"
                className="przycisk drugorzedny"
                onClick={() => {
                  ustawKrok(krok - 1);
                  ustawBledy([]);
                }}
              >
                ← Wstecz
              </button>
            ) : (
              <Odnosnik to="/biblioteka">Wróć do Biblioteki</Odnosnik>
            )}
            <button
              type="submit"
              className="przycisk"
              disabled={
                krok === 2 &&
                (!wynik ||
                  wynik.stan === 'zablokowany' ||
                  (!!wynik.raport.ostrzezenia.length &&
                    !potwierdzoneOstrzezenia))
              }
            >
              {zapisywanie
                ? 'Zapisywanie…'
                : [
                    'Dalej: pytania →',
                    'Przejdź do podglądu →',
                    'Zatwierdź i zapisz quiz',
                  ][krok]}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
