import {
  useEffect as poZmianie,
  useMemo as pamietaj,
  useRef as referencja,
  useState as stan,
} from 'react';
import { Link as Odnosnik } from 'react-router-dom';
import { schematQuizu } from '../domena/quiz';
import type { Pytanie, Quiz, Wariant } from '../domena/quiz';
import { zapiszZatwierdzonyQuiz } from '../dane/biblioteka';
import { walidujImportQuizu } from '../import/walidator';
import type { ProblemImportu } from '../import/walidator';
import { EdytorMechanik } from './kreator/EdytorMechanik';
import {
  nazwyTypow,
  nowaMechanika,
  potrzebujeWariantow,
} from './kreator/mechaniki';
import { EdytorLogiki } from './kreator/EdytorLogiki';
import {
  EdytorObrazow,
  ListaTekstow,
  OdpowiedzAutorska,
  PolaRekomendacji,
} from './kreator/PolaZaawansowane';

function nowyWariant(): Wariant {
  return { id: crypto.randomUUID(), etykieta: '' };
}
function nowePytanie(): Pytanie {
  return {
    id: crypto.randomUUID(),
    tresc: '',
    prezentacja: { rodzaj: 'tekstowa' },
    warianty: [nowyWariant(), nowyWariant()],
    sposobyOdpowiedzi: [nowaMechanika('pojedynczyWybor', 2)],
  };
}
function kopiaPytania(pytanie: Pytanie): Pytanie {
  const kopia = structuredClone(pytanie);
  kopia.id = crypto.randomUUID();
  const warianty = new Map(
    kopia.warianty.map((wariant) => [wariant.id, crypto.randomUUID()]),
  );
  const obrazy = [
    ...(kopia.prezentacja.obrazy ?? []),
    ...kopia.warianty.flatMap((wariant) => wariant.obrazy ?? []),
  ];
  obrazy.forEach((obraz) => {
    obraz.id = crypto.randomUUID();
  });
  kopia.warianty.forEach((wariant) => {
    wariant.id = warianty.get(wariant.id)!;
  });
  kopia.sposobyOdpowiedzi.forEach((mechanika) => {
    mechanika.id = crypto.randomUUID();
  });
  if (kopia.rekomendacja)
    kopia.rekomendacja.wariantId = warianty.get(kopia.rekomendacja.wariantId)!;
  if (
    kopia.innaOdpowiedz?.analiza.tryb === 'autorska' &&
    kopia.innaOdpowiedz.analiza.dotknietePytaniaId
  )
    kopia.innaOdpowiedz.analiza.dotknietePytaniaId =
      kopia.innaOdpowiedz.analiza.dotknietePytaniaId.map((id) =>
        id === pytanie.id ? kopia.id : id,
      );
  return kopia;
}
const etapy = [
  'Opis quizu',
  'Pytania',
  'Logika adaptacyjna',
  'Podgląd i zapis',
];

export function KreatorQuizu() {
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
  const [zapisany, ustawZapisany] = stan(false);
  const [potwierdzoneOstrzezenia, ustawPotwierdzoneOstrzezenia] = stan(false);
  const trwaZapis = referencja(false);
  const naglowek = referencja<HTMLHeadingElement>(null);
  const wszystkie = [...quiz.pytania, ...quiz.pytaniaDodatkowe];
  const pytanie = wszystkie.find((element) => element.id === aktywneId)!;
  const dodatkowe = quiz.pytaniaDodatkowe.some(
    (element) => element.id === aktywneId,
  );
  const pula = dodatkowe ? 'pytaniaDodatkowe' : 'pytania';
  const indeks = quiz[pula].indexOf(pytanie);
  const wynik = pamietaj(
    () => walidujImportQuizu(JSON.stringify(quiz)),
    [quiz],
  );
  const zgodny = pamietaj(() => schematQuizu.safeParse(quiz).success, [quiz]);
  const moznaZapisac =
    zgodny &&
    wynik.stan !== 'zablokowany' &&
    (!wynik.raport.ostrzezenia.length || potwierdzoneOstrzezenia);
  poZmianie(() => {
    naglowek.current?.focus();
  }, [krok]);

  function zmienQuiz(nowy: Quiz) {
    ustawPotwierdzoneOstrzezenia(false);
    ustawQuiz(nowy);
    ustawBledy([]);
  }
  function zmienPytanie(zmiany: Partial<Pytanie>) {
    zmienQuiz({
      ...quiz,
      [pula]: quiz[pula].map((element) =>
        element.id === aktywneId ? { ...element, ...zmiany } : element,
      ),
    });
  }
  function zmienWariant(wariant: Wariant) {
    zmienPytanie({
      warianty: pytanie.warianty.map((element) =>
        element.id === wariant.id ? wariant : element,
      ),
    });
  }
  function przeniesPytanie(docelowa: 'pytania' | 'pytaniaDodatkowe') {
    if (docelowa === pula) return;
    const bazowe =
      docelowa === 'pytania'
        ? [...quiz.pytania, pytanie]
        : quiz.pytania.filter((element) => element.id !== pytanie.id);
    zmienQuiz({
      ...quiz,
      pytania: bazowe,
      liczbaPytan: bazowe.length,
      pytaniaDodatkowe:
        docelowa === 'pytaniaDodatkowe'
          ? [...quiz.pytaniaDodatkowe, pytanie]
          : quiz.pytaniaDodatkowe.filter(
              (element) => element.id !== pytanie.id,
            ),
    });
  }
  function przesunPytanie(kierunek: number) {
    const pytania = [...quiz[pula]];
    const cel = indeks + kierunek;
    if (cel < 0 || cel >= pytania.length) return;
    [pytania[indeks], pytania[cel]] = [pytania[cel]!, pytania[indeks]!];
    zmienQuiz({ ...quiz, [pula]: pytania });
  }
  function przejdzDoProblemu(problem: ProblemImportu) {
    if (problem.sciezka[0] === 'reguly') ustawKrok(2);
    else if (
      (problem.sciezka[0] === 'pytania' ||
        problem.sciezka[0] === 'pytaniaDodatkowe') &&
      typeof problem.sciezka[1] === 'number'
    ) {
      const element = quiz[problem.sciezka[0]][problem.sciezka[1]];
      if (element) ustawAktywneId(element.id);
      ustawKrok(1);
    } else ustawKrok(0);
  }
  function opisProblemu(problem: ProblemImportu) {
    const [pole, numer, , numerWariantu] = problem.sciezka;
    return `${pole === 'pytania' ? 'Pytanie ' : pole === 'pytaniaDodatkowe' ? 'Pytanie dodatkowe ' : pole === 'reguly' ? 'Reguła ' : ''}${typeof numer === 'number' ? numer + 1 + ': ' : ''}${problem.sciezka[2] === 'warianty' && typeof numerWariantu === 'number' ? `wariant ${numerWariantu + 1}: ` : ''}${problem.opis}`;
  }
  function dalej() {
    if (krok === 0) {
      const problemy = [
        ...(!quiz.tytul.trim() ? ['Podaj tytuł quizu.'] : []),
        ...(!quiz.jezyk.trim() ? ['Podaj język quizu.'] : []),
        ...(!/^\d+\.\d+\.\d+$/.test(quiz.wersjaQuizu)
          ? ['Wersja quizu musi mieć postać X.Y.Z.']
          : []),
      ];
      ustawBledy(problemy);
      if (problemy.length) return;
    }
    ustawBledy([]);
    ustawKrok(Math.min(3, krok + 1));
  }
  async function zapisz() {
    if (trwaZapis.current || !moznaZapisac || zapisany) return;
    trwaZapis.current = true;
    ustawZapisywanie(true);
    ustawBledy([]);
    try {
      await zapiszZatwierdzonyQuiz(wynik);
      ustawZapisany(true);
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
  function eksportuj() {
    if (wynik.stan === 'zablokowany' || !moznaZapisac) return;
    const odnosnik = document.createElement('a');
    const adres = URL.createObjectURL(
      new Blob([JSON.stringify(wynik.quiz, null, 2) + '\n'], {
        type: 'application/json;charset=utf-8',
      }),
    );
    try {
      odnosnik.href = adres;
      odnosnik.download = `quiz-${quiz.id}.json`;
      document.body.append(odnosnik);
      odnosnik.click();
    } catch {
      ustawBledy(['Nie przygotowano eksportu JSON. Spróbuj ponownie.']);
    } finally {
      odnosnik.remove();
      setTimeout(() => URL.revokeObjectURL(adres), 1000);
    }
  }

  return (
    <section className="panel kreator-quizu">
      <p className="nadtytul">Twoje pytania. Twój quiz.</p>
      <h1 ref={naglowek} tabIndex={-1}>
        Stwórz nowy quiz
      </h1>
      <p className="wprowadzenie-kreatora">
        Ułóż pytania, określ logikę i sprawdź quiz przed zapisem.
      </p>
      <ol className="kroki-kreatora" aria-label="Etapy tworzenia quizu">
        {etapy.map((etykieta, numer) => (
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
          if (krok < 3) dalej();
          else void zapisz();
        }}
      >
        <fieldset className="pola-kreatora" disabled={zapisywanie}>
          <legend className="tylko-czytnik">{etapy[krok]}</legend>
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
                    onChange={(zdarzenie) =>
                      zmienQuiz({ ...quiz, tytul: zdarzenie.target.value })
                    }
                  />
                </label>
                <label>
                  Opis (opcjonalny)
                  <textarea
                    rows={4}
                    value={quiz.opis ?? ''}
                    onChange={(zdarzenie) =>
                      zmienQuiz({
                        ...quiz,
                        opis: zdarzenie.target.value || undefined,
                      })
                    }
                  />
                </label>
                <label>
                  Język quizu
                  <input
                    required
                    value={quiz.jezyk}
                    onChange={(zdarzenie) =>
                      zmienQuiz({ ...quiz, jezyk: zdarzenie.target.value })
                    }
                  />
                </label>
                <label>
                  Wersja quizu
                  <input
                    value={quiz.wersjaQuizu}
                    placeholder="1.0.0"
                    onChange={(zdarzenie) =>
                      zmienQuiz({
                        ...quiz,
                        wersjaQuizu: zdarzenie.target.value,
                      })
                    }
                  />
                </label>
                <details>
                  <summary>Dane techniczne</summary>
                  <p>
                    ID quizu: <code>{quiz.id}</code>
                  </p>
                  <p>Format: {quiz.schemaVersion}</p>
                </details>
              </div>
              <aside className="wskazowka-kreatora">
                <span className="symbol-kreatora" aria-hidden="true">
                  ✦
                </span>
                <h3>Od pytania do decyzji</h3>
                <p>
                  Szczegóły wariantów i reguły możesz dodawać stopniowo. Błędy i
                  ostrzeżenia zobaczysz podczas pracy.
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
                  <span className="liczba-kreatora">{wszystkie.length}</span>
                </h2>
                {(['pytania', 'pytaniaDodatkowe'] as const).map((rodzaj) => (
                  <div key={rodzaj}>
                    <h3>
                      {rodzaj === 'pytania' ? 'Bazowe' : 'Dodatkowe'} (
                      {quiz[rodzaj].length})
                    </h3>
                    <ol>
                      {quiz[rodzaj].map((element, numer) => (
                        <li key={element.id}>
                          <button
                            type="button"
                            aria-pressed={element.id === aktywneId}
                            onClick={() => ustawAktywneId(element.id)}
                          >
                            <span className="numer-pytania">
                              {rodzaj === 'pytania' ? '' : 'D'}
                              {numer + 1}
                            </span>
                            <span>
                              {element.tresc || 'Nowe pytanie'}
                              <small>
                                {element.sposobyOdpowiedzi
                                  .map((sposob) => nazwyTypow[sposob.rodzaj])
                                  .join(' · ')}
                              </small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
                <button
                  className="przycisk drugorzedny"
                  type="button"
                  onClick={() => {
                    const nowe = nowePytanie();
                    zmienQuiz({
                      ...quiz,
                      pytania: [...quiz.pytania, nowe],
                      liczbaPytan: quiz.pytania.length + 1,
                    });
                    ustawAktywneId(nowe.id);
                  }}
                >
                  + Dodaj pytanie
                </button>
              </aside>
              <section
                className="edytor-pytania"
                aria-label={`Edycja pytania ${dodatkowe ? 'dodatkowego ' : ''}${indeks + 1}`}
              >
                <div className="naglowek-edytora">
                  <h2>
                    Pytanie {dodatkowe ? 'D' : ''}
                    {indeks + 1}
                  </h2>
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
                      disabled={indeks === quiz[pula].length - 1}
                      aria-label="Przesuń pytanie w dół"
                      onClick={() => przesunPytanie(1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const kopia = kopiaPytania(pytanie);
                        const pytania = [...quiz[pula]];
                        pytania.splice(indeks + 1, 0, kopia);
                        zmienQuiz({
                          ...quiz,
                          [pula]: pytania,
                          liczbaPytan:
                            pula === 'pytania'
                              ? pytania.length
                              : quiz.pytania.length,
                        });
                        ustawAktywneId(kopia.id);
                      }}
                    >
                      Duplikuj pytanie
                    </button>
                    <button
                      type="button"
                      disabled={wszystkie.length === 1}
                      onClick={() => {
                        const pozostale = wszystkie.filter(
                          (element) => element.id !== pytanie.id,
                        );
                        const pytania = quiz[pula].filter(
                          (element) => element.id !== pytanie.id,
                        );
                        zmienQuiz({
                          ...quiz,
                          [pula]: pytania,
                          liczbaPytan:
                            pula === 'pytania'
                              ? pytania.length
                              : quiz.pytania.length,
                        });
                        ustawAktywneId(pozostale[0]!.id);
                      }}
                    >
                      Usuń pytanie
                    </button>
                  </div>
                </div>
                <label>
                  Pula pytania
                  <select
                    value={pula}
                    onChange={(zdarzenie) =>
                      przeniesPytanie(
                        zdarzenie.target.value as
                          'pytania' | 'pytaniaDodatkowe',
                      )
                    }
                  >
                    <option value="pytania">Pytanie bazowe</option>
                    <option value="pytaniaDodatkowe">Pytanie dodatkowe</option>
                  </select>
                </label>
                <label>
                  Treść pytania
                  <textarea
                    required
                    rows={3}
                    value={pytanie.tresc}
                    onChange={(zdarzenie) =>
                      zmienPytanie({ tresc: zdarzenie.target.value })
                    }
                  />
                </label>
                <details>
                  <summary>Prezentacja i wyjaśnienie pytania</summary>
                  <label>
                    Typ prezentacji
                    <select
                      value={pytanie.prezentacja.rodzaj}
                      onChange={(zdarzenie) =>
                        zmienPytanie({
                          prezentacja: {
                            ...pytanie.prezentacja,
                            rodzaj: zdarzenie.target
                              .value as Pytanie['prezentacja']['rodzaj'],
                          },
                        })
                      }
                    >
                      <option value="tekstowa">Tekstowa</option>
                      <option value="wizualna">Wizualna</option>
                      <option value="mieszana">Mieszana</option>
                    </select>
                  </label>
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
                  <EdytorObrazow
                    key={pytanie.id}
                    nazwa="Obrazy pytania"
                    obrazy={pytanie.prezentacja.obrazy ?? []}
                    zmien={(obrazy) =>
                      zmienPytanie({
                        prezentacja: { ...pytanie.prezentacja, obrazy },
                      })
                    }
                  />
                </details>
                <EdytorMechanik
                  pytanie={pytanie}
                  zmien={(sposoby) => {
                    const potrzeba = sposoby.some(potrzebujeWariantow);
                    const puste = pytanie.warianty.every(
                      (wariant) =>
                        !wariant.etykieta &&
                        !wariant.opis &&
                        !wariant.zalety?.length &&
                        !wariant.wady?.length &&
                        !wariant.konsekwencje?.length &&
                        !wariant.wyjasnienie &&
                        !wariant.obrazy?.length,
                    );
                    zmienPytanie({
                      sposobyOdpowiedzi: sposoby,
                      warianty: potrzeba
                        ? pytanie.warianty.length
                          ? pytanie.warianty
                          : [nowyWariant(), nowyWariant()]
                        : puste
                          ? []
                          : pytanie.warianty,
                    });
                  }}
                />
                {(pytanie.warianty.length > 0 ||
                  pytanie.sposobyOdpowiedzi.some(potrzebujeWariantow)) && (
                  <div className="warianty-kreatora">
                    <h3>Warianty odpowiedzi</h3>
                    {pytanie.warianty.map((wariant, numer) => (
                      <div className="wariant-kreatora" key={wariant.id}>
                        <label>
                          Wariant {numer + 1}
                          <input
                            value={wariant.etykieta}
                            onChange={(zdarzenie) =>
                              zmienWariant({
                                ...wariant,
                                etykieta: zdarzenie.target.value,
                              })
                            }
                          />
                        </label>
                        <button
                          className="usun-wariant"
                          type="button"
                          aria-label={`Usuń wariant ${numer + 1}`}
                          onClick={() =>
                            zmienPytanie({
                              warianty: pytanie.warianty.filter(
                                (element) => element.id !== wariant.id,
                              ),
                              rekomendacja:
                                pytanie.rekomendacja?.wariantId === wariant.id
                                  ? undefined
                                  : pytanie.rekomendacja,
                            })
                          }
                        >
                          ×
                        </button>
                        <details>
                          <summary>Szczegóły wariantu {numer + 1}</summary>
                          <label>
                            Opis wariantu {numer + 1} (opcjonalny)
                            <textarea
                              rows={2}
                              value={wariant.opis ?? ''}
                              onChange={(zdarzenie) =>
                                zmienWariant({
                                  ...wariant,
                                  opis: zdarzenie.target.value || undefined,
                                })
                              }
                            />
                          </label>
                          {(['zalety', 'wady', 'konsekwencje'] as const).map(
                            (pole) => (
                              <ListaTekstow
                                key={pole}
                                nazwa={`${{ zalety: 'Zalety', wady: 'Wady', konsekwencje: 'Konsekwencje' }[pole]} wariantu ${numer + 1}`}
                                wartosci={wariant[pole] ?? []}
                                zmien={(wartosci) =>
                                  zmienWariant({ ...wariant, [pole]: wartosci })
                                }
                              />
                            ),
                          )}
                          <label>
                            Wyjaśnienie wariantu {numer + 1}
                            <textarea
                              rows={2}
                              value={wariant.wyjasnienie ?? ''}
                              onChange={(zdarzenie) =>
                                zmienWariant({
                                  ...wariant,
                                  wyjasnienie:
                                    zdarzenie.target.value || undefined,
                                })
                              }
                            />
                          </label>
                          <EdytorObrazow
                            nazwa={`Obrazy wariantu ${numer + 1}`}
                            obrazy={wariant.obrazy ?? []}
                            zmien={(obrazy) =>
                              zmienWariant({ ...wariant, obrazy })
                            }
                          />
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
                <details>
                  <summary>Rekomendacja autora</summary>
                  <label className="pole-wyboru-kreatora">
                    <input
                      type="checkbox"
                      checked={!!pytanie.rekomendacja}
                      disabled={!pytanie.warianty.length}
                      onChange={(zdarzenie) =>
                        zmienPytanie({
                          rekomendacja: zdarzenie.target.checked
                            ? {
                                wariantId: pytanie.warianty[0]?.id ?? '',
                                uzasadnienie: '',
                              }
                            : undefined,
                        })
                      }
                    />
                    Dodaj rekomendację autora
                  </label>
                  <p className="etykieta">
                    Rekomendacja autora nie jest odpowiedzią użytkownika.
                  </p>
                  {pytanie.rekomendacja && (
                    <PolaRekomendacji
                      warianty={pytanie.warianty}
                      wartosc={pytanie.rekomendacja}
                      zmien={(rekomendacja) => zmienPytanie({ rekomendacja })}
                    />
                  )}
                </details>
                <details>
                  <summary>Własna odpowiedź „Inne”</summary>
                  <label className="pole-wyboru-kreatora">
                    <input
                      type="checkbox"
                      checked={!!pytanie.innaOdpowiedz}
                      onChange={(zdarzenie) =>
                        zmienPytanie({
                          innaOdpowiedz: zdarzenie.target.checked
                            ? {
                                etykieta: 'Inne — własna odpowiedź',
                                analiza: {
                                  tryb: 'autorska',
                                  interpretacja: '',
                                  potencjalneSkutki: [],
                                },
                              }
                            : undefined,
                        })
                      }
                    />
                    Zezwól na własną odpowiedź
                  </label>
                  {pytanie.innaOdpowiedz && (
                    <OdpowiedzAutorska
                      wartosc={pytanie.innaOdpowiedz}
                      zmien={(innaOdpowiedz) => zmienPytanie({ innaOdpowiedz })}
                      pytania={wszystkie}
                    />
                  )}
                </details>
                <details>
                  <summary>ID pytania i sposobów odpowiedzi</summary>
                  <p>
                    ID pytania: <code>{pytanie.id}</code>
                  </p>
                  {pytanie.sposobyOdpowiedzi.map((mechanika) => (
                    <p key={mechanika.id}>
                      {nazwyTypow[mechanika.rodzaj]}:{' '}
                      <code>{mechanika.id}</code>
                    </p>
                  ))}
                </details>
              </section>
            </div>
          )}
          {krok === 2 && (
            <EdytorLogiki
              quiz={quiz}
              zmien={(reguly) => zmienQuiz({ ...quiz, reguly })}
            />
          )}
          {krok === 3 && (
            <div className="podglad-kreatora">
              <div className="podsumowanie-kreatora">
                <span className="etykieta">Podgląd definicji quizu</span>
                <h2>{quiz.tytul}</h2>
                {quiz.opis && <p>{quiz.opis}</p>}
                <p>
                  Język: {quiz.jezyk} · Wersja: {quiz.wersjaQuizu}
                </p>
                <p>
                  Bazowe: {quiz.pytania.length} · Dodatkowe:{' '}
                  {quiz.pytaniaDodatkowe.length} · Reguły: {quiz.reguly.length}
                </p>
                <details>
                  <summary>Dane techniczne quizu</summary>
                  <p>
                    ID: <code>{quiz.id}</code>
                  </p>
                  <p>Format: {quiz.schemaVersion}</p>
                </details>
              </div>
              {wszystkie.map((element, numer) => (
                <section className="karta-podgladu-kreatora" key={element.id}>
                  <p className="etykieta">
                    {quiz.pytania.includes(element) ? 'Bazowe' : 'Dodatkowe'} ·{' '}
                    {numer + 1}
                  </p>
                  <h3>{element.tresc || 'Brak treści pytania'}</h3>
                  {element.wyjasnienie && <p>{element.wyjasnienie}</p>}
                  <p className="etykieta">
                    {element.sposobyOdpowiedzi
                      .map(
                        (sposob) =>
                          `${nazwyTypow[sposob.rodzaj]} (${sposob.wymagany ? 'wymagane' : 'opcjonalne'})`,
                      )
                      .join(' · ')}{' '}
                    · Prezentacja: {element.prezentacja.rodzaj}
                  </p>
                  <details>
                    <summary>
                      Warianty i szczegóły ({element.warianty.length})
                    </summary>
                    <ol>
                      {element.warianty.map((wariant) => (
                        <li key={wariant.id}>
                          <strong>{wariant.etykieta}</strong>
                          {wariant.opis && <p>{wariant.opis}</p>}
                          {(['zalety', 'wady', 'konsekwencje'] as const).map(
                            (pole) =>
                              wariant[pole]?.length ? (
                                <div key={pole}>
                                  <h4>
                                    {
                                      {
                                        zalety: 'Zalety',
                                        wady: 'Wady',
                                        konsekwencje: 'Konsekwencje',
                                      }[pole]
                                    }
                                  </h4>
                                  <ul>
                                    {wariant[pole].map((tekst, indeks) => (
                                      <li key={indeks}>{tekst}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null,
                          )}
                          {wariant.wyjasnienie && <p>{wariant.wyjasnienie}</p>}
                        </li>
                      ))}
                    </ol>
                  </details>
                  {element.rekomendacja && (
                    <p>
                      Rekomendacja autora:{' '}
                      {
                        element.warianty.find(
                          (wariant) =>
                            wariant.id === element.rekomendacja?.wariantId,
                        )?.etykieta
                      }{' '}
                      — {element.rekomendacja.uzasadnienie}
                    </p>
                  )}
                  {element.innaOdpowiedz && (
                    <p>
                      Własna odpowiedź: {element.innaOdpowiedz.etykieta} ·
                      Analiza autorska
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}
          <details className="walidacja-kreatora" open={krok === 3}>
            <summary>
              Walidacja na żywo — błędy: {wynik.raport.bledy.length},
              ostrzeżenia: {wynik.raport.ostrzezenia.length}
            </summary>
            {(
              [
                ['Błędy krytyczne', wynik.raport.bledy],
                ['Ostrzeżenia', wynik.raport.ostrzezenia],
                ['Informacje', wynik.raport.informacje],
              ] as const
            ).map(([nazwa, problemy]) => (
              <section key={nazwa}>
                <h3>
                  {nazwa} ({problemy.length})
                </h3>
                {problemy.length ? (
                  <ul>
                    {problemy.map((problem, numer) => (
                      <li key={numer}>
                        <button
                          className="odnosnik-problemu"
                          type="button"
                          disabled={zapisany}
                          onClick={() => przejdzDoProblemu(problem)}
                        >
                          {opisProblemu(problem)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Brak.</p>
                )}
              </section>
            ))}
          </details>
          {krok === 3 && !!wynik.raport.ostrzezenia.length && (
            <label className="pole-wyboru-kreatora">
              <input
                type="checkbox"
                checked={potwierdzoneOstrzezenia}
                onChange={(zdarzenie) =>
                  ustawPotwierdzoneOstrzezenia(zdarzenie.target.checked)
                }
              />
              Akceptuję ostrzeżenia i chcę zapisać lub wyeksportować quiz
            </label>
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
          {zapisany && (
            <p role="status">
              Quiz zapisany do Biblioteki.{' '}
              <Odnosnik to="/biblioteka">Otwórz Bibliotekę</Odnosnik>
            </p>
          )}
          <div className="dzialania-kreatora">
            {krok > 0 ? (
              <button
                type="button"
                className="przycisk drugorzedny"
                disabled={zapisany}
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
            {krok === 3 && (
              <button
                className="przycisk drugorzedny"
                type="button"
                disabled={!moznaZapisac}
                onClick={eksportuj}
              >
                Eksportuj JSON
              </button>
            )}
            <button
              type="submit"
              className="przycisk"
              disabled={krok === 3 && (!moznaZapisac || zapisany)}
            >
              {zapisywanie
                ? 'Zapisywanie…'
                : [
                    'Dalej: pytania →',
                    'Dalej: logika adaptacyjna →',
                    'Przejdź do podglądu →',
                    zapisany ? 'Zapisano' : 'Zapisz do Biblioteki',
                  ][krok]}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
