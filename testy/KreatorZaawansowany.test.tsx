import { IDBFactory as FabrykaBazy } from 'fake-indexeddb';
import {
  render as pokaz,
  screen as ekran,
  fireEvent as zdarzenie,
  within as wewnatrz,
} from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter as Router } from 'react-router-dom';
import { useState as stan } from 'react';
import {
  beforeEach as przedKazdym,
  afterEach as poKazdym,
  it as sprawdz,
  expect as oczekuj,
  vi as atrapy,
} from 'vitest';
import { KreatorQuizu } from '../src/aplikacja/KreatorQuizu';
import { EdytorLogiki } from '../src/aplikacja/kreator/EdytorLogiki';
import { nowaMechanika } from '../src/aplikacja/kreator/mechaniki';
import { odczytajBiblioteke } from '../src/dane/biblioteka';
import { walidujImportQuizu } from '../src/import/walidator';
import { quizTekstowy } from './domena/przyklady';
import type { MechanikaOdpowiedzi, Quiz } from '../src/domena/quiz';

przedKazdym(() => atrapy.stubGlobal('indexedDB', new FabrykaBazy()));
poKazdym(() => atrapy.unstubAllGlobals());

function wpisz(nazwa: string, wartosc: string) {
  zdarzenie.change(ekran.getByLabelText(nazwa, { exact: true }), {
    target: { value: wartosc },
  });
}
async function otworz() {
  pokaz(
    <Router>
      <KreatorQuizu />
    </Router>,
  );
  const osoba = uzytkownik.setup();
  wpisz('Tytuł quizu', 'Zaawansowany quiz');
  wpisz('Wersja quizu', '2.3.4');
  await osoba.click(ekran.getByRole('button', { name: 'Dalej: pytania →' }));
  wpisz('Treść pytania', 'Wybór projektu');
  wpisz('Wariant 1', 'A');
  wpisz('Wariant 2', 'B');
  return osoba;
}
async function podglad(osoba: ReturnType<typeof uzytkownik.setup>) {
  await osoba.click(
    ekran.getByRole('button', { name: 'Dalej: logika adaptacyjna →' }),
  );
  await osoba.click(
    ekran.getByRole('button', { name: 'Przejdź do podglądu →' }),
  );
}
async function zapisz(osoba: ReturnType<typeof uzytkownik.setup>) {
  await osoba.click(
    ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
  );
  await ekran.findByText(/Quiz zapisany do Biblioteki/);
  return (await odczytajBiblioteke())[0]!.quiz;
}

sprawdz(
  'zachowuje szczegóły, analizę autorską i rekomendację w kanonicznym round-trip',
  async () => {
    const osoba = await otworz();
    await osoba.click(ekran.getByText('Szczegóły wariantu 1'));
    wpisz('Opis wariantu 1 (opcjonalny)', 'Opis A');
    wpisz('Wyjaśnienie wariantu 1', 'Wyjaśnienie A');
    for (const nazwa of [
      'Zalety wariantu 1',
      'Wady wariantu 1',
      'Konsekwencje wariantu 1',
    ]) {
      for (let numer = 1; numer <= 2; numer++) {
        await osoba.click(
          ekran.getByRole('button', { name: `+ Dodaj: ${nazwa}` }),
        );
        wpisz(`${nazwa} — wpis ${numer}`, `${nazwa} ${numer}`);
      }
    }
    await osoba.click(ekran.getByText('Rekomendacja autora', { exact: true }));
    await osoba.click(ekran.getByLabelText('Dodaj rekomendację autora'));
    wpisz('Uzasadnienie rekomendacji', 'Ułatwia rozpoczęcie');
    await osoba.click(ekran.getByText('Własna odpowiedź „Inne”'));
    await osoba.click(ekran.getByLabelText('Zezwól na własną odpowiedź'));
    wpisz('Interpretacja autora', 'Indywidualny pomysł');
    for (const nazwa of [
      'Potencjalne skutki analizy',
      'Zalety analizy',
      'Wady analizy',
      'Niejednoznaczności analizy',
    ]) {
      await osoba.click(
        ekran.getByRole('button', { name: `+ Dodaj: ${nazwa}` }),
      );
      wpisz(`${nazwa} — wpis 1`, nazwa);
    }
    await podglad(osoba);
    const quiz = await zapisz(osoba);
    const wynik = walidujImportQuizu(JSON.stringify(quiz));
    oczekuj(wynik.stan).toBe('gotowyDoZatwierdzenia');
    oczekuj(wynik.quiz).toEqual(quiz);
    oczekuj(quiz.wersjaQuizu).toBe('2.3.4');
    oczekuj(quiz.pytania[0]!.warianty[0]).toMatchObject({
      opis: 'Opis A',
      wyjasnienie: 'Wyjaśnienie A',
      zalety: ['Zalety wariantu 1 1', 'Zalety wariantu 1 2'],
      wady: ['Wady wariantu 1 1', 'Wady wariantu 1 2'],
      konsekwencje: ['Konsekwencje wariantu 1 1', 'Konsekwencje wariantu 1 2'],
    });
    oczekuj(quiz.pytania[0]!.innaOdpowiedz!.analiza).toMatchObject({
      tryb: 'autorska',
      interpretacja: 'Indywidualny pomysł',
      potencjalneSkutki: ['Potencjalne skutki analizy'],
      zalety: ['Zalety analizy'],
      wady: ['Wady analizy'],
      niejednoznacznosci: ['Niejednoznaczności analizy'],
    });
    oczekuj(quiz.pytania[0]!.rekomendacja).toMatchObject({
      wariantId: quiz.pytania[0]!.warianty[0]!.id,
      uzasadnienie: 'Ułatwia rozpoczęcie',
    });
  },
);

sprawdz(
  'duplikuje z nowymi ID i poprawnie przepisuje rekomendację; usuwa rekomendowany wariant',
  async () => {
    const osoba = await otworz();
    await osoba.click(ekran.getByRole('button', { name: '+ Dodaj wariant' }));
    wpisz('Wariant 3', 'C');
    await osoba.click(ekran.getByText('Rekomendacja autora', { exact: true }));
    await osoba.click(ekran.getByLabelText('Dodaj rekomendację autora'));
    wpisz('Uzasadnienie rekomendacji', 'Powód');
    await osoba.click(ekran.getByRole('button', { name: 'Duplikuj pytanie' }));
    await osoba.click(ekran.getByRole('button', { name: 'Usuń wariant 1' }));
    oczekuj(
      ekran.getByLabelText('Dodaj rekomendację autora'),
    ).not.toBeChecked();
    await podglad(osoba);
    const quiz = await zapisz(osoba);
    const [pierwsze, drugie] = quiz.pytania;
    oczekuj(quiz.liczbaPytan).toBe(2);
    oczekuj(pierwsze!.id).not.toBe(drugie!.id);
    oczekuj(pierwsze!.sposobyOdpowiedzi[0]!.id).not.toBe(
      drugie!.sposobyOdpowiedzi[0]!.id,
    );
    oczekuj(
      drugie!.warianty.every(
        (wariant) => !pierwsze!.warianty.some((inny) => inny.id === wariant.id),
      ),
    ).toBe(true);
    oczekuj(pierwsze!.rekomendacja!.wariantId).toBe(pierwsze!.warianty[0]!.id);
    oczekuj(drugie!.rekomendacja).toBeUndefined();
  },
);

sprawdz(
  'błędna prezentacja blokuje zapis i eksport, a odnośnik błędu otwiera pytanie',
  async () => {
    const osoba = await otworz();
    await osoba.click(ekran.getByText('Prezentacja i wyjaśnienie pytania'));
    await osoba.selectOptions(
      ekran.getByLabelText('Typ prezentacji'),
      'wizualna',
    );
    await podglad(osoba);
    oczekuj(
      ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
    ).toBeDisabled();
    oczekuj(
      ekran.getByRole('button', { name: 'Eksportuj JSON' }),
    ).toBeDisabled();
    await osoba.click(
      ekran.getByRole('button', {
        name: /Prezentacja wizualna lub mieszana wymaga obrazu/,
      }),
    );
    oczekuj(ekran.getByLabelText('Treść pytania')).toHaveValue(
      'Wybór projektu',
    );
    oczekuj(await odczytajBiblioteke()).toEqual([]);
  },
);

sprawdz(
  'pytanie dodatkowe i reguła dodania zapisują poprawne powiązania',
  async () => {
    const osoba = await otworz();
    await osoba.click(ekran.getByRole('button', { name: '+ Dodaj pytanie' }));
    wpisz('Treść pytania', 'Dodatkowe');
    await osoba.selectOptions(
      ekran.getByLabelText('Sposób odpowiedzi'),
      'takNie',
    );
    await osoba.selectOptions(
      ekran.getByLabelText('Pula pytania'),
      'pytaniaDodatkowe',
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Dalej: logika adaptacyjna →' }),
    );
    await osoba.click(ekran.getByRole('button', { name: '+ Dodaj regułę' }));
    wpisz('Powód reguły', 'Dopytaj o szczegóły');
    await osoba.click(
      ekran.getByRole('button', { name: 'Przejdź do podglądu →' }),
    );
    const quiz = await zapisz(osoba);
    oczekuj(quiz.liczbaPytan).toBe(1);
    oczekuj(quiz.pytaniaDodatkowe).toHaveLength(1);
    oczekuj(quiz.reguly[0]!.operacja).toEqual({
      rodzaj: 'dodaj',
      pytanieId: quiz.pytaniaDodatkowe[0]!.id,
      poPytaniuId: quiz.pytania[0]!.id,
    });
    oczekuj(walidujImportQuizu(JSON.stringify(quiz)).quiz).toEqual(quiz);
  },
);

sprawdz(
  'potwierdzenie ostrzeżeń dotyczy bieżącej definicji i wygasa po edycji',
  async () => {
    const osoba = await otworz();
    await osoba.click(ekran.getByRole('button', { name: '+ Dodaj pytanie' }));
    wpisz('Treść pytania', 'Pytanie bez reguły');
    await osoba.selectOptions(
      ekran.getByLabelText('Sposób odpowiedzi'),
      'takNie',
    );
    await osoba.selectOptions(
      ekran.getByLabelText('Pula pytania'),
      'pytaniaDodatkowe',
    );
    await podglad(osoba);
    oczekuj(
      ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
    ).toBeDisabled();
    await osoba.click(
      ekran.getByLabelText(
        'Akceptuję ostrzeżenia i chcę zapisać lub wyeksportować quiz',
      ),
    );
    oczekuj(
      ekran.getByRole('button', { name: 'Zapisz do Biblioteki' }),
    ).toBeEnabled();
    await osoba.click(ekran.getByRole('button', { name: '← Wstecz' }));
    await osoba.click(ekran.getByRole('button', { name: '← Wstecz' }));
    wpisz('Treść pytania', 'Zmienione pytanie bez reguły');
    await podglad(osoba);
    oczekuj(
      ekran.getByLabelText(
        'Akceptuję ostrzeżenia i chcę zapisać lub wyeksportować quiz',
      ),
    ).not.toBeChecked();
    oczekuj(
      ekran.getByRole('button', { name: 'Eksportuj JSON' }),
    ).toBeDisabled();
  },
);

sprawdz(
  'zapisuje kilka mechanik, opcjonalność i ocenę wariantów w skali ułamkowej',
  async () => {
    const osoba = await otworz();
    await osoba.selectOptions(
      ekran.getByLabelText('Sposób odpowiedzi'),
      'skala',
    );
    await osoba.selectOptions(ekran.getByLabelText('Cel skali'), 'warianty');
    wpisz('Początek skali', '-1');
    wpisz('Koniec skali', '1');
    wpisz('Krok skali', '0.5');
    await osoba.click(
      ekran.getByRole('button', { name: '+ Dodaj sposób odpowiedzi' }),
    );
    const drugie = wewnatrz(ekran.getByRole('group', { name: 'Sposób 2' }));
    await osoba.click(drugie.getByLabelText('Wymagana odpowiedź'));
    zdarzenie.change(drugie.getByLabelText('Limit znaków'), {
      target: { value: '120' },
    });
    await podglad(osoba);
    const quiz = await zapisz(osoba);
    oczekuj(quiz.pytania[0]!.sposobyOdpowiedzi).toEqual([
      oczekuj.objectContaining({
        rodzaj: 'skala',
        cel: 'warianty',
        minimum: -1,
        maksimum: 1,
        krok: 0.5,
        wymagany: true,
      }),
      oczekuj.objectContaining({
        rodzaj: 'otwarta',
        maksymalnaDlugosc: 120,
        wymagany: false,
      }),
    ]);
  },
);

sprawdz(
  'osadza obraz z pliku i zapisuje opis alternatywny po potwierdzeniu ostrzeżenia importera',
  async () => {
    const osoba = await otworz();
    await osoba.click(ekran.getByText('Prezentacja i wyjaśnienie pytania'));
    await osoba.selectOptions(
      ekran.getByLabelText('Typ prezentacji'),
      'mieszana',
    );
    await osoba.click(ekran.getByText('Obrazy pytania (0)'));
    await osoba.click(
      ekran.getAllByRole('button', { name: '+ Dodaj obraz' })[0]!,
    );
    wpisz('Opis alternatywny obrazu 1', 'Szkic projektu');
    const plik = new File([new Uint8Array([137, 80, 78, 71])], 'szkic.png', {
      type: 'image/png',
    });
    await osoba.upload(
      ekran.getByLabelText('Plik obrazu 1 (PNG, JPEG, WebP)'),
      plik,
    );
    await ekran.findByText('Obraz osadzony w quizie.');
    await podglad(osoba);
    await osoba.click(
      ekran.getByLabelText(
        'Akceptuję ostrzeżenia i chcę zapisać lub wyeksportować quiz',
      ),
    );
    const quiz = await zapisz(osoba);
    oczekuj(quiz.pytania[0]!.prezentacja).toMatchObject({
      rodzaj: 'mieszana',
      obrazy: [
        {
          opisAlternatywny: 'Szkic projektu',
          dane: 'data:image/png;base64,iVBORw==',
        },
      ],
    });
  },
);

function ProbaLogiki({ rodzaj }: { rodzaj: MechanikaOdpowiedzi['rodzaj'] }) {
  const [quiz, ustaw] = stan<Quiz>(() => ({
    ...structuredClone(quizTekstowy),
    pytania: [
      {
        ...structuredClone(quizTekstowy.pytania[0]),
        sposobyOdpowiedzi: [nowaMechanika(rodzaj, 2, 'mechanika')],
      },
      {
        id: 'cel',
        tresc: 'Cel',
        prezentacja: { rodzaj: 'tekstowa' },
        warianty: [],
        sposobyOdpowiedzi: [nowaMechanika('takNie', 0, 'tak')],
      },
    ],
    liczbaPytan: 2,
  }));
  return (
    <>
      <EdytorLogiki
        quiz={quiz}
        zmien={(reguly) => ustaw({ ...quiz, reguly })}
      />
      <output data-testid="definicja">{JSON.stringify(quiz)}</output>
    </>
  );
}
sprawdz.each([
  ['pojedynczyWybor', 'rowne', 'prosty'],
  ['wielokrotnyWybor', 'zawieraWariant', 'prosty'],
  ['takNie', 'rowne', true],
  ['prawdaFalsz', 'rowne', true],
  ['otwarta', 'rowne', ''],
  ['skala', 'coNajmniej', 1],
  ['ranking', 'zawieraWariant', 'prosty'],
  ['kombinacjaWariantow', 'zawieraWariant', 'prosty'],
] as const)(
  'dobiera zgodny operator i typ wartości dla %s',
  async (rodzaj, operator, wartosc) => {
    pokaz(<ProbaLogiki rodzaj={rodzaj} />);
    const osoba = uzytkownik.setup();
    await osoba.click(ekran.getByRole('button', { name: '+ Dodaj regułę' }));
    const quiz = JSON.parse(
      ekran.getByTestId('definicja').textContent!,
    ) as Quiz;
    oczekuj(quiz.reguly[0]!.warunek).toMatchObject({ operator, wartosc });
    oczekuj(ekran.getByLabelText('Operator')).toBeDisabled();
    wpisz('Powód reguły', 'Powód');
    if (rodzaj === 'otwarta') wpisz('Tekst warunku', 'Tekst');
    await osoba.selectOptions(ekran.getByLabelText('Operacja'), 'modyfikuj');
    oczekuj(ekran.getByLabelText('Nowa treść pytania')).toHaveValue('Cel');
    oczekuj(
      wewnatrz(ekran.getByRole('group', { name: 'Reguła 1' })).getAllByRole(
        'checkbox',
      ),
    ).toHaveLength(3);
    const zmieniony = JSON.parse(
      ekran.getByTestId('definicja').textContent!,
    ) as Quiz;
    oczekuj(walidujImportQuizu(JSON.stringify(zmieniony)).stan).not.toBe(
      'zablokowany',
    );
  },
);
