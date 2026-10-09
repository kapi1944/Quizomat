import { IDBFactory as FabrykaBazy } from 'fake-indexeddb';
import {
  render as pokaz,
  screen as ekran,
  within as wewnatrz,
  waitFor as poczekaj,
  cleanup as posprzataj,
} from '@testing-library/react';
import uzytkownik from '@testing-library/user-event';
import { MemoryRouter as Router } from 'react-router-dom';
import {
  beforeEach as przedKazdym,
  afterEach as poKazdym,
  it as sprawdz,
  expect as oczekuj,
  vi as atrapy,
} from 'vitest';
import { Aplikacja } from '../../src/aplikacja/Aplikacja';
import type { Pytanie, Quiz } from '../../src/domena/quiz';
import type { WartoscOdpowiedzi } from '../../src/domena/sesja';
import { odczytajSesje } from '../../src/dane/sesje';
import { walidujOdpowiedz } from '../../src/silnik/runtime';
import { wznowSesje } from '../../src/silnik/sesja';
import { quizTekstowy } from '../domena/przyklady';

const pytanie: Pytanie = {
  ...quizTekstowy.pytania[0],
  sposobyOdpowiedzi: [
    { id: 'jeden', rodzaj: 'pojedynczyWybor', wymagany: true },
    {
      id: 'wiele',
      rodzaj: 'wielokrotnyWybor',
      wymagany: true,
      minimum: 1,
      maksimum: 2,
    },
    { id: 'zgoda', rodzaj: 'takNie', wymagany: true },
    { id: 'fakt', rodzaj: 'prawdaFalsz', wymagany: true },
    { id: 'tekst', rodzaj: 'otwarta', wymagany: true, maksymalnaDlugosc: 100 },
    {
      id: 'ocena',
      rodzaj: 'skala',
      cel: 'pytanie',
      wymagany: true,
      minimum: 0,
      maksimum: 1,
      krok: 0.1,
    },
    {
      id: 'oceny',
      rodzaj: 'skala',
      cel: 'warianty',
      wymagany: true,
      minimum: 1,
      maksimum: 5,
      krok: 1,
    },
    {
      id: 'kolejnosc',
      rodzaj: 'ranking',
      wymagany: true,
      minimum: 2,
      maksimum: 2,
    },
    {
      id: 'polaczenie',
      rodzaj: 'kombinacjaWariantow',
      wymagany: true,
      minimumElementow: 2,
    },
    { id: 'uwagi', rodzaj: 'otwarta', wymagany: false, maksymalnaDlugosc: 100 },
  ],
};
const wartosci: WartoscOdpowiedzi[] = [
  { sposobId: 'jeden', rodzaj: 'pojedynczyWybor', wariantId: 'prosty' },
  {
    sposobId: 'wiele',
    rodzaj: 'wielokrotnyWybor',
    wariantyId: ['prosty', 'szczegolowy'],
  },
  { sposobId: 'zgoda', rodzaj: 'takNie', wartosc: false },
  { sposobId: 'fakt', rodzaj: 'prawdaFalsz', wartosc: false },
  { sposobId: 'tekst', rodzaj: 'otwarta', tekst: 'Opis projektu' },
  { sposobId: 'ocena', rodzaj: 'skala', cel: 'pytanie', wartosc: 0.3 },
  {
    sposobId: 'oceny',
    rodzaj: 'skala',
    cel: 'warianty',
    oceny: [
      { wariantId: 'prosty', wartosc: 1 },
      { wariantId: 'szczegolowy', wartosc: 5 },
    ],
  },
  {
    sposobId: 'kolejnosc',
    rodzaj: 'ranking',
    wariantyId: ['szczegolowy', 'prosty'],
  },
  {
    sposobId: 'polaczenie',
    rodzaj: 'kombinacjaWariantow',
    elementy: [
      { wariantId: 'prosty', fragment: 'Układ' },
      { wariantId: 'szczegolowy', fragment: 'Szczegóły' },
    ],
  },
];
const quiz: Quiz = {
  ...quizTekstowy,
  liczbaPytan: 3,
  pytania: [
    pytanie,
    { ...quizTekstowy.pytania[0], id: 'drugie', tresc: 'Druga decyzja' },
    {
      ...quizTekstowy.pytania[0],
      id: 'odlozone',
      tresc: 'Do ustalenia później',
    },
  ],
  pytaniaDodatkowe: [
    {
      ...quizTekstowy.pytania[0],
      id: 'dodatkowe',
      tresc: 'Dodatkowa zgoda',
      sposobyOdpowiedzi: [{ id: 'zgoda', rodzaj: 'takNie', wymagany: true }],
    },
  ],
  reguly: [
    {
      id: 'dodaj',
      powod: 'Wybrano szczegóły.',
      warunek: {
        pytanieId: pytanie.id,
        sposobId: 'wiele',
        operator: 'zawieraWariant',
        wartosc: 'szczegolowy',
      },
      operacja: {
        rodzaj: 'dodaj',
        pytanieId: 'dodatkowe',
        poPytaniuId: pytanie.id,
      },
    },
    {
      id: 'zmien',
      powod: 'Doprecyzowanie treści.',
      warunek: {
        pytanieId: pytanie.id,
        sposobId: 'zgoda',
        operator: 'rowne',
        wartosc: false,
      },
      operacja: {
        rodzaj: 'modyfikuj',
        pytanieId: 'drugie',
        zmiany: { tresc: 'Zmodyfikowana druga decyzja' },
      },
    },
  ],
};

przedKazdym(() => {
  atrapy.stubGlobal('indexedDB', new FabrykaBazy());
  localStorage.clear();
});
poKazdym(() => {
  atrapy.unstubAllGlobals();
});

sprawdz(
  'waliduje niezależne mechaniki, fałsz, zero i ułamkowy krok oraz pominięcie opcjonalnego tekstu',
  () => {
    oczekuj(
      walidujOdpowiedz(pytanie, { rodzaj: 'standardowa', wartosci }).stan,
    ).toBe('gotowy');
    oczekuj(
      walidujOdpowiedz(pytanie, {
        rodzaj: 'standardowa',
        wartosci: wartosci.map((wartosc) =>
          wartosc.sposobId === 'ocena' ? { ...wartosc, wartosc: 0 } : wartosc,
        ),
      }).stan,
    ).toBe('gotowy');
  },
);

sprawdz.each([
  [
    'brak wymaganego sposobu',
    wartosci.filter((wartosc) => wartosc.sposobId !== 'jeden'),
  ],
  [
    'za mało wyborów',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'wiele' ? { ...wartosc, wariantyId: [] } : wartosc,
    ),
  ],
  [
    'za dużo wyborów',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'wiele'
        ? { ...wartosc, wariantyId: ['prosty', 'szczegolowy', 'obcy'] }
        : wartosc,
    ),
  ],
  [
    'za długi tekst',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'tekst'
        ? { ...wartosc, tekst: 'a'.repeat(101) }
        : wartosc,
    ),
  ],
  [
    'pusty tekst',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'tekst' ? { ...wartosc, tekst: '  ' } : wartosc,
    ),
  ],
  [
    'zły krok',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'ocena' ? { ...wartosc, wartosc: 0.35 } : wartosc,
    ),
  ],
  [
    'poza skalą',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'ocena' ? { ...wartosc, wartosc: 2 } : wartosc,
    ),
  ],
  [
    'zły cel skali',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'ocena'
        ? {
            sposobId: 'ocena',
            rodzaj: 'skala',
            cel: 'warianty',
            oceny: [{ wariantId: 'prosty', wartosc: 0 }],
          }
        : wartosc,
    ),
  ],
  [
    'brak oceny wariantu',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'oceny'
        ? { ...wartosc, oceny: [{ wariantId: 'prosty', wartosc: 1 }] }
        : wartosc,
    ),
  ],
  [
    'powtórzenie w rankingu',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'kolejnosc'
        ? { ...wartosc, wariantyId: ['prosty', 'prosty'] }
        : wartosc,
    ),
  ],
  [
    'niepełny ranking',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'kolejnosc'
        ? { ...wartosc, wariantyId: ['prosty'] }
        : wartosc,
    ),
  ],
  [
    'pusty fragment',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'polaczenie'
        ? {
            ...wartosc,
            elementy: [
              { wariantId: 'prosty', fragment: '' },
              { wariantId: 'szczegolowy', fragment: 'Opis' },
            ],
          }
        : wartosc,
    ),
  ],
  [
    'obcy wariant w kombinacji',
    wartosci.map((wartosc) =>
      wartosc.sposobId === 'polaczenie'
        ? {
            ...wartosc,
            elementy: [
              { wariantId: 'obcy', fragment: 'Opis' },
              { wariantId: 'szczegolowy', fragment: 'Opis' },
            ],
          }
        : wartosc,
    ),
  ],
] as const)('odrzuca: %s', (_, wartosci) => {
  oczekuj(
    walidujOdpowiedz(pytanie, { rodzaj: 'standardowa', wartosci }).stan,
  ).toBe('blad');
});

async function poczekajNaZapis() {
  await poczekaj(() => {
    oczekuj(ekran.queryByText('Zapisywanie postępu…')).not.toBeInTheDocument();
    oczekuj(
      ekran.queryByText('Zapisywanie szkicu odpowiedzi…'),
    ).not.toBeInTheDocument();
  });
}
function wznow(id: string) {
  pokaz(
    <Router initialEntries={[`/sesja/${id}`]}>
      <Aplikacja />
    </Router>,
  );
}

sprawdz(
  'MVP: import, wszystkie mechaniki naraz, autosave szkicu, wznowienie, adaptacja, edycja, historia i jawne zakończenie z odłożonym pytaniem',
  async () => {
    const osoba = uzytkownik.setup();
    pokaz(
      <Router initialEntries={['/import']}>
        <Aplikacja />
      </Router>,
    );
    await osoba.upload(
      ekran.getByLabelText('Plik quizu JSON'),
      new File([JSON.stringify(quiz)], 'projekt.json', {
        type: 'application/json',
      }),
    );
    await ekran.findByRole('button', { name: 'Kontynuuj mimo ostrzeżeń' });
    await osoba.click(
      ekran.getByRole('button', { name: 'Kontynuuj mimo ostrzeżeń' }),
    );
    await osoba.click(
      await ekran.findByRole('button', { name: 'Rozpocznij nową' }),
    );
    await ekran.findByRole('button', { name: 'Zatwierdź odpowiedzi' });
    await osoba.click(
      ekran.getByRole('button', { name: 'Zatwierdź odpowiedzi' }),
    );
    oczekuj(ekran.getByRole('alert')).toHaveTextContent('Uzupełnij wymagane');
    await osoba.type(
      ekran.getByLabelText('Treść odpowiedzi · tekst'),
      'Opis projektu',
    );
    await poczekajNaZapis();
    const szkic = (await odczytajSesje())[0]!;
    oczekuj(szkic.decyzje).toEqual([]);
    posprzataj();
    wznow(szkic.id);
    oczekuj(
      await ekran.findByLabelText('Treść odpowiedzi · tekst'),
    ).toHaveValue('Opis projektu');
    for (const sposob of ['jeden', 'wiele', 'kolejnosc']) {
      const grupa = wewnatrz(
        ekran.getByRole('group', { name: new RegExp(`· ${sposob} `) }),
      );
      await osoba.click(grupa.getByLabelText('Prosty'));
      if (sposob !== 'jeden')
        await osoba.click(grupa.getByLabelText('Szczegółowy'));
    }
    await osoba.click(
      ekran.getByRole('button', { name: 'Wyżej: Szczegółowy' }),
    );
    await osoba.click(ekran.getByLabelText('NIE'));
    await osoba.click(ekran.getByLabelText('FAŁSZ'));
    await osoba.type(ekran.getByLabelText('Ocena pytania · ocena'), '0.3');
    await osoba.type(ekran.getByLabelText('Prosty · oceny'), '1');
    await osoba.type(ekran.getByLabelText('Szczegółowy · oceny'), '5');
    await osoba.click(
      ekran.getByRole('button', { name: 'Dodaj element · polaczenie' }),
    );
    await osoba.type(
      ekran.getByLabelText('Fragment elementu 1 · polaczenie'),
      'Układ',
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Dodaj element · polaczenie' }),
    );
    await osoba.selectOptions(
      ekran.getByLabelText('Wariant elementu 2 · polaczenie'),
      'szczegolowy',
    );
    await osoba.type(
      ekran.getByLabelText('Fragment elementu 2 · polaczenie'),
      'Szczegóły',
    );
    await osoba.type(
      ekran.getByLabelText('Komentarz (opcjonalny)'),
      'Uzasadnienie',
    );
    await poczekajNaZapis();
    await osoba.click(
      ekran.getByRole('button', { name: 'Zatwierdź odpowiedzi' }),
    );
    await poczekajNaZapis();
    oczekuj(ekran.queryByRole('alert')).not.toBeInTheDocument();
    const pierwszy = (await odczytajSesje())[0]!;
    oczekuj(pierwszy.decyzje[0]?.odpowiedz).toEqual({
      rodzaj: 'standardowa',
      wartosci: oczekuj.arrayContaining(wartosci),
    });
    oczekuj(pierwszy.decyzje[0]?.notatka).toBe('Uzasadnienie');
    await osoba.click(
      ekran.getByRole('button', { name: 'Następne pytanie →' }),
    );
    await poczekajNaZapis();
    await ekran.findByRole('heading', { level: 1, name: 'Dodatkowa zgoda' });
    await osoba.click(ekran.getByLabelText('NIE'));
    await poczekajNaZapis();
    await osoba.click(
      ekran.getByRole('button', { name: 'Zatwierdź odpowiedzi' }),
    );
    await poczekajNaZapis();
    const zapis = (await odczytajSesje())[0]!;
    posprzataj();
    wznow(zapis.id);
    oczekuj(await ekran.findByLabelText('NIE')).toBeChecked();
    await osoba.click(
      ekran.getByRole('button', { name: '← Poprzednie pytanie' }),
    );
    await poczekajNaZapis();
    const wiele = wewnatrz(ekran.getByRole('group', { name: /· wiele / }));
    await osoba.click(wiele.getByLabelText('Szczegółowy'));
    await poczekajNaZapis();
    await osoba.click(
      ekran.getByRole('button', { name: 'Zatwierdź odpowiedzi' }),
    );
    await poczekajNaZapis();
    const zmieniony = (await odczytajSesje())[0]!;
    oczekuj(zmieniony.decyzje).toHaveLength(1);
    oczekuj(
      zmieniony.historiaDecyzji.some(
        (decyzja) => decyzja.pytanieId === 'dodatkowe',
      ),
    ).toBe(true);
    oczekuj(
      zmieniony.decyzje[0]?.odpowiedz.rodzaj === 'standardowa' &&
        zmieniony.decyzje[0].odpowiedz.wartosci,
    ).toEqual(
      oczekuj.arrayContaining(
        wartosci.filter((wartosc) => wartosc.sposobId !== 'wiele'),
      ),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Następne pytanie →' }),
    );
    await poczekajNaZapis();
    await ekran.findByRole('heading', {
      level: 1,
      name: 'Zmodyfikowana druga decyzja',
    });
    await osoba.click(ekran.getByRole('button', { name: 'Wybierz: Prosty' }));
    await poczekajNaZapis();
    await osoba.click(
      ekran.getByRole('button', { name: 'Następne pytanie →' }),
    );
    await poczekajNaZapis();
    await osoba.click(ekran.getByRole('button', { name: 'Wróć później' }));
    await poczekajNaZapis();
    await osoba.click(
      ekran.getByRole('button', {
        name: 'Zakończ z nierozstrzygniętymi pytaniami',
      }),
    );
    await poczekajNaZapis();
    oczekuj(
      ekran.getByRole('heading', { level: 1, name: 'Quiz zakończony' }),
    ).toBeVisible();
    oczekuj(
      ekran.getByText(
        'Sesja zakończona. Odłożone pytania pozostają nierozstrzygnięte.',
      ),
    ).toBeVisible();
    const koniec = (await odczytajSesje())[0]!;
    oczekuj(koniec.stan).toBe('zakonczona');
    oczekuj(koniec.odlozonePytaniaId).toEqual(['odlozone']);
    oczekuj(wznowSesje(quiz, koniec).stan).toBe('gotowy');
    posprzataj();
    wznow(koniec.id);
    await ekran.findByRole('heading', { level: 1, name: 'Quiz zakończony' });
    oczekuj((await odczytajSesje())[0]).toEqual(koniec);
    await osoba.click(ekran.getByRole('link', { name: 'Wróć do Biblioteki' }));
    await osoba.click(
      await ekran.findByRole('link', { name: 'Otwórz zakończoną sesję' }),
    );
    await ekran.findByRole('heading', { level: 1, name: 'Quiz zakończony' });
    await osoba.click(
      ekran.getByRole('button', {
        name: 'Wróć do pytania: Do ustalenia później',
      }),
    );
    await poczekajNaZapis();
    await osoba.click(
      ekran.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
    );
    await poczekajNaZapis();
    await osoba.type(
      ekran.getByLabelText('Komentarz (opcjonalny)'),
      'Końcowy komentarz',
    );
    await poczekajNaZapis();
    await osoba.click(ekran.getByRole('button', { name: 'Wybierz: Prosty' }));
    await poczekajNaZapis();
    await osoba.click(
      ekran.getByRole('button', { name: 'Zapisz odpowiedź z komentarzem' }),
    );
    await poczekajNaZapis();
    await osoba.click(
      ekran.getByRole('button', { name: 'Następne pytanie →' }),
    );
    await poczekajNaZapis();
    const rozstrzygniety = (await odczytajSesje())[0]!;
    oczekuj(rozstrzygniety.stan).toBe('zakonczona');
    oczekuj(rozstrzygniety.odlozonePytaniaId).toEqual([]);
    const ostatnia = rozstrzygniety.decyzje.find(
      (decyzja) => decyzja.pytanieId === 'odlozone',
    );
    oczekuj(ostatnia?.notatka).toBe('Końcowy komentarz');
    oczekuj(ostatnia?.odpowiedz).toEqual({
      rodzaj: 'standardowa',
      wartosci: [
        { sposobId: 'wybor', rodzaj: 'pojedynczyWybor', wariantId: 'prosty' },
      ],
    });
    oczekuj(wznowSesje(quiz, rozstrzygniety).stan).toBe('gotowy');
  },
  20000,
);
