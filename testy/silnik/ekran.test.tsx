import {
  IDBFactory as FabrykaBazy,
  IDBObjectStore as Magazyn,
} from 'fake-indexeddb';
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
  afterEach as poKazdym,
  beforeEach as przedKazdym,
  describe as opisz,
  expect as oczekuj,
  it as sprawdz,
  vi as atrapy,
} from 'vitest';
import { Aplikacja } from '../../src/aplikacja/Aplikacja';
import {
  odczytajBiblioteke,
  zapiszZatwierdzonyQuiz,
} from '../../src/dane/biblioteka';
import { walidujImportQuizu } from '../../src/import/walidator';
import { quizTekstowy } from '../domena/przyklady';
import { odczytajSesje } from '../../src/dane/sesje';
import { wznowSesje } from '../../src/silnik/sesja';
import { schematQuizu } from '../../src/domena/quiz';

const quiz = {
  ...quizTekstowy,
  liczbaPytan: 2,
  pytania: [
    {
      ...quizTekstowy.pytania[0],
      wyjasnienie: 'Porównaj kierunki.',
      warianty: [
        { ...quizTekstowy.pytania[0].warianty[0], opis: 'Mało kategorii.' },
        quizTekstowy.pytania[0].warianty[1],
        { id: 'trzeci', etykieta: 'Trzeci' },
        { id: 'czwarty', etykieta: 'Czwarty' },
      ],
    },
    { ...quizTekstowy.pytania[0], id: 'drugie', tresc: 'Kolejne pytanie?' },
  ],
};

przedKazdym(() => {
  atrapy.stubGlobal('indexedDB', new FabrykaBazy());
  localStorage.clear();
});
poKazdym(() => {
  atrapy.restoreAllMocks();
  atrapy.unstubAllGlobals();
  localStorage.clear();
});

async function poczekajNaZapis() {
  await poczekaj(() =>
    oczekuj(ekran.queryByText('Zapisywanie postępu…')).not.toBeInTheDocument(),
  );
}

async function kliknij(
  osoba: ReturnType<typeof uzytkownik.setup>,
  element: HTMLElement,
) {
  await osoba.click(element);
  await poczekajNaZapis();
}

async function otworz(dane: unknown = quiz, sciezka = '/biblioteka') {
  await zapiszZatwierdzonyQuiz(walidujImportQuizu(JSON.stringify(dane)));
  pokaz(
    <Router initialEntries={[sciezka]}>
      <Aplikacja />
    </Router>,
  );
  const osoba = uzytkownik.setup();
  if (sciezka === '/biblioteka')
    await kliknij(
      osoba,
      await ekran.findByRole('button', { name: 'Rozpocznij nową' }),
    );
  return osoba;
}

opisz('Quiz uruchamiany z istniejącej Biblioteki', () => {
  sprawdz(
    'przełącza widoki bez zapisów i zachowuje decyzje udzielone poza kolejnością po restarcie',
    async () => {
      const osoba = await otworz();
      const pojedyncze = await ekran.findByRole('button', {
        name: 'Pojedyncze pytania',
      });
      oczekuj(pojedyncze).toHaveAttribute('aria-pressed', 'true');
      oczekuj(
        ekran.queryByRole('heading', { name: 'Kolejne pytanie?' }),
      ).not.toBeInTheDocument();
      const poczatek = (await odczytajSesje())[0]!;
      await kliknij(osoba, ekran.getByRole('button', { name: 'Widok pełny' }));
      oczekuj(
        ekran.getByRole('heading', { name: 'Kolejne pytanie?' }),
      ).toBeVisible();
      oczekuj(
        ekran.getAllByRole('region', { name: /^Pytanie \d+$/ }),
      ).toHaveLength(2);
      const drugie = wewnatrz(ekran.getByRole('region', { name: 'Pytanie 2' }));
      await kliknij(
        osoba,
        drugie.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      );
      oczekuj(
        drugie.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      ).toHaveAttribute('aria-pressed', 'true');
      const zapis = (await odczytajSesje())[0]!;
      oczekuj(zapis.decyzje).toHaveLength(1);
      oczekuj(zapis.decyzje[0]?.pytanieId).toBe('drugie');
      oczekuj(wznowSesje(schematQuizu.parse(quiz), zapis).stan).toBe('gotowy');
      await kliknij(osoba, pojedyncze);
      oczekuj(
        ekran.getByRole('heading', { level: 1, name: 'Kolejne pytanie?' }),
      ).toHaveFocus();
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: '← Poprzednie pytanie' }),
      );
      oczekuj(
        ekran.getByRole('button', { name: '← Poprzednie pytanie' }),
      ).toBeDisabled();
      oczekuj(
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      ).toBeDisabled();
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Wybierz: Prosty' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      await kliknij(osoba, ekran.getByRole('button', { name: 'Widok pełny' }));
      oczekuj(
        wewnatrz(ekran.getByRole('region', { name: 'Pytanie 1' })).getByRole(
          'button',
          { name: 'Wybierz: Prosty' },
        ),
      ).toHaveAttribute('aria-pressed', 'true');
      const przedPrzelaczeniem = (await odczytajSesje())[0]!;
      await kliknij(osoba, pojedyncze);
      await kliknij(osoba, ekran.getByRole('button', { name: 'Widok pełny' }));
      oczekuj((await odczytajSesje())[0]).toEqual(przedPrzelaczeniem);
      oczekuj(przedPrzelaczeniem.decyzje).toHaveLength(2);
      oczekuj(poczatek.decyzje).toHaveLength(0);
      posprzataj();
      pokaz(
        <Router initialEntries={[`/sesja/${zapis.id}`]}>
          <Aplikacja />
        </Router>,
      );
      oczekuj(
        await ekran.findByRole('button', { name: 'Wybierz: Szczegółowy' }),
      ).toHaveAttribute('aria-pressed', 'true');
    },
  );
  sprawdz(
    'autosave komentarza w pełnym widoku zachowuje inne decyzje i blokuje zmianę widoku podczas edycji',
    async () => {
      const osoba = await otworz();
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Widok pełny' }),
      );
      const drugie = wewnatrz(ekran.getByRole('region', { name: 'Pytanie 2' }));
      await kliknij(
        osoba,
        drugie.getByRole('button', { name: 'Wybierz: Prosty' }),
      );
      const pierwsze = wewnatrz(
        ekran.getByRole('region', { name: 'Pytanie 1' }),
      );
      await osoba.type(
        pierwsze.getByLabelText('Komentarz (opcjonalny)'),
        'Komentarz pierwszego',
      );
      oczekuj(
        ekran.getByRole('button', { name: 'Pojedyncze pytania' }),
      ).toBeDisabled();
      oczekuj(
        drugie.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      ).toBeDisabled();
      await poczekaj(() =>
        oczekuj(
          ekran.getByRole('button', { name: 'Pojedyncze pytania' }),
        ).toBeEnabled(),
      );
      await kliknij(
        osoba,
        pierwsze.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      );
      await kliknij(
        osoba,
        pierwsze.getByRole('button', {
          name: 'Zapisz odpowiedź z komentarzem',
        }),
      );
      const zapis = (await odczytajSesje())[0]!;
      oczekuj(zapis.decyzje).toHaveLength(2);
      oczekuj(
        zapis.decyzje.find((decyzja) => decyzja.pytanieId === 'podzial')
          ?.notatka,
      ).toBe('Komentarz pierwszego');
      oczekuj(wznowSesje(schematQuizu.parse(quiz), zapis).stan).toBe('gotowy');
    },
  );
  sprawdz(
    'pokazuje kompaktowy bilans z dostępnymi etykietami i nie wybiera rekomendacji',
    async () => {
      await otworz();
      const wybor = await ekran.findByRole('button', {
        name: 'Wybierz: Prosty',
      });
      const wariant = wybor.closest('article')!;
      oczekuj(wewnatrz(wariant).getByText('+')).toBeVisible();
      oczekuj(wewnatrz(wariant).getByText('−')).toBeVisible();
      oczekuj(wewnatrz(wariant).getByText('Zaleta:')).toBeInTheDocument();
      oczekuj(wewnatrz(wariant).getByText('Wada:')).toBeInTheDocument();
      oczekuj(
        wewnatrz(wariant).queryByRole('heading', { name: 'Zalety' }),
      ).not.toBeInTheDocument();
      oczekuj(
        wewnatrz(wariant).queryByRole('heading', { name: 'Wady' }),
      ).not.toBeInTheDocument();
      oczekuj(wybor).toHaveAttribute('aria-pressed', 'false');
      oczekuj(
        ekran.getByRole('button', { name: '← Poprzednie pytanie' }),
      ).toBeDisabled();
      oczekuj(
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      ).toBeDisabled();
    },
  );
  sprawdz(
    'pokazuje wszystkie adaptacje i Dlaczego, odtwarza je z IndexedDB po restarcie',
    async () => {
      const definicja = {
        ...quiz,
        liczbaPytan: 3,
        pytania: [
          ...quiz.pytania,
          { ...quizTekstowy.pytania[0], id: 'trzecie' },
        ],
        pytaniaDodatkowe: [
          {
            ...quizTekstowy.pytania[0],
            id: 'dodatkowe',
            tresc: 'Pytanie dodatkowe?',
          },
        ],
        reguly: [
          {
            id: 'dodaj',
            powod: 'Potrzebne doprecyzowanie.',
            operacja: {
              rodzaj: 'dodaj',
              pytanieId: 'dodatkowe',
              poPytaniuId: 'podzial',
            },
          },
          {
            id: 'zmien',
            powod: 'Dostosowanie treści.',
            operacja: {
              rodzaj: 'modyfikuj',
              pytanieId: 'drugie',
              zmiany: { tresc: 'Dostosowane pytanie?' },
            },
          },
          {
            id: 'pomin',
            powod: 'Odpowiedź wyklucza ten temat.',
            operacja: { rodzaj: 'pomin', pytanieId: 'trzecie' },
          },
        ].map((regula) => ({
          ...regula,
          warunek: {
            pytanieId: 'podzial',
            sposobId: 'wybor',
            operator: 'rowne',
            wartosc: 'prosty',
          },
        })),
      };
      const osoba = await otworz(definicja);
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      );
      await kliknij(osoba, ekran.getByRole('button', { name: 'Widok pełny' }));
      oczekuj(
        ekran.getAllByRole('region', { name: /^Pytanie \d+$/ }),
      ).toHaveLength(3);
      oczekuj(
        ekran.getByRole('heading', { name: 'Pytanie dodatkowe?' }),
      ).toBeVisible();
      oczekuj(
        ekran.getByRole('heading', { name: 'Dostosowane pytanie?' }),
      ).toBeVisible();
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Pojedyncze pytania' }),
      );
      const zmiany = ekran.getByRole('region', { name: 'Zmiany adaptacyjne' });
      for (const oznaczenie of [
        'Pytanie dodane',
        'Pytanie zmodyfikowane',
        'Pytanie pominięte',
      ])
        oczekuj(
          wewnatrz(zmiany).getByText(new RegExp(oznaczenie)),
        ).toBeVisible();
      const wyjasnienia = wewnatrz(zmiany).getAllByText('Dlaczego?', {
        exact: true,
      });
      for (const wyjasnienie of wyjasnienia) await osoba.click(wyjasnienie);
      oczekuj(
        wewnatrz(zmiany).getByText('Potrzebne doprecyzowanie.'),
      ).toBeVisible();
      oczekuj(
        wewnatrz(zmiany).getAllByText('Odpowiedź źródłowa: Prosty'),
      ).toHaveLength(3);
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      oczekuj(
        ekran.getByRole('heading', { level: 1, name: 'Pytanie dodatkowe?' }),
      ).toBeVisible();
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Wybierz: Prosty' }),
      );
      const zapis = (await odczytajSesje())[0]!;
      posprzataj();
      pokaz(
        <Router initialEntries={[`/sesja/${zapis.id}`]}>
          <Aplikacja />
        </Router>,
      );
      oczekuj(
        await ekran.findByRole('heading', {
          level: 1,
          name: 'Pytanie dodatkowe?',
        }),
      ).toBeVisible();
      oczekuj(
        ekran.getByRole('region', { name: 'Zmiany adaptacyjne' }),
      ).toBeVisible();
      oczekuj((await odczytajSesje())[0]).toEqual(zapis);
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: '← Poprzednie pytanie' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      );
      oczekuj(
        ekran.queryByRole('region', { name: 'Zmiany adaptacyjne' }),
      ).not.toBeInTheDocument();
      const poZmianie = (await odczytajSesje())[0]!;
      oczekuj(poZmianie.decyzje).toHaveLength(1);
      oczekuj(
        poZmianie.historiaDecyzji.some(
          (decyzja) => decyzja.pytanieId === 'dodatkowe',
        ),
      ).toBe(true);
      await osoba.click(ekran.getByText('Historia decyzji', { exact: true }));
      oczekuj(
        ekran.getAllByText('Zapis historyczny — nie jest aktualną decyzją.')
          .length,
      ).toBeGreaterThan(0);
    },
  );

  sprawdz(
    'po A → B → A restart zachowuje audyt, a odczyt nie tworzy nowych zdarzeń',
    async () => {
      const osoba = await otworz();
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Wybierz: Czwarty' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Wybierz: Prosty' }),
      );
      await kliknij(
        osoba,
        ekran.getByText('Historia decyzji', { exact: true }),
      );
      oczekuj(
        ekran.getByText('Poprzednio: Prosty. Teraz: Czwarty.'),
      ).toBeVisible();
      oczekuj(
        ekran.getByText('Poprzednio: Czwarty. Teraz: Prosty.'),
      ).toBeVisible();
      const zapis = (await odczytajSesje())[0]!;
      oczekuj(zapis.dziennikSesji?.zdarzenia).toHaveLength(3);
      posprzataj();
      pokaz(
        <Router initialEntries={[`/sesja/${zapis.id}`]}>
          <Aplikacja />
        </Router>,
      );
      oczekuj(
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await kliknij(
        osoba,
        ekran.getByText('Historia decyzji', { exact: true }),
      );
      oczekuj(
        ekran.getByText('Poprzednio: Czwarty. Teraz: Prosty.'),
      ).toBeVisible();
      oczekuj(await odczytajSesje()).toEqual([zapis]);
      oczekuj(await odczytajSesje()).toEqual([zapis]);
    },
  );
  sprawdz(
    'restart przywraca dokładnie tę samą sesję, miejsce i wybraną odpowiedź',
    async () => {
      const osoba = await otworz();
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Wybierz: Czwarty' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      const zapisane = (await odczytajSesje())[0]!;
      oczekuj(zapisane.biezacePytanieId).toBe('drugie');
      posprzataj();
      pokaz(
        <Router initialEntries={[`/sesja/${zapisane.id}`]}>
          <Aplikacja />
        </Router>,
      );
      oczekuj(
        await ekran.findByRole('heading', { name: 'Kolejne pytanie?' }),
      ).toHaveFocus();
      oczekuj((await odczytajSesje())[0]).toEqual(zapisane);
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: '← Poprzednie pytanie' }),
      );
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Czwarty' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await kliknij(
        osoba,
        ekran.getByRole('link', { name: 'Wróć do Biblioteki' }),
      );
      await kliknij(
        osoba,
        await ekran.findByRole('link', { name: 'Kontynuuj' }),
      );
      oczekuj(
        await ekran.findByRole('button', { name: 'Wybierz: Czwarty' }),
      ).toHaveAttribute('aria-pressed', 'true');
      oczekuj(await odczytajSesje()).toHaveLength(1);
    },
  );

  sprawdz(
    'Biblioteka pozwala niezależnie kontynuować dwie sesje tej samej definicji',
    async () => {
      const osoba = await otworz();
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      );
      const pierwsza = (await odczytajSesje())[0]!;
      await kliknij(
        osoba,
        ekran.getByRole('link', { name: 'Wróć do Biblioteki' }),
      );
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Rozpocznij nową' }),
      );
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Wybierz: Czwarty' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('link', { name: 'Wróć do Biblioteki' }),
      );
      const lista = await ekran.findByRole('list', {
        name: `Niedokończone sesje: ${quiz.tytul}`,
      });
      const odnosniki = wewnatrz(lista).getAllByRole('link', {
        name: 'Kontynuuj',
      });
      oczekuj(odnosniki).toHaveLength(2);
      await kliknij(
        osoba,
        odnosniki.find(
          (element) => element.getAttribute('href') === `/sesja/${pierwsza.id}`,
        )!,
      );
      oczekuj(
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      ).toHaveAttribute('aria-pressed', 'true');
      oczekuj(await odczytajSesje()).toHaveLength(2);
    },
  );

  sprawdz(
    'odłożenie przetrwa restart i blokuje zakończenie do udzielenia odpowiedzi',
    async () => {
      const osoba = await otworz();
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Wróć później' }),
      );
      oczekuj(
        ekran.getByRole('heading', { name: 'Kolejne pytanie?' }),
      ).toHaveFocus();
      oczekuj((await odczytajSesje())[0]?.odlozonePytaniaId).toEqual([
        'podzial',
      ]);
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Wybierz: Prosty' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      oczekuj(
        ekran.getByRole('heading', { name: 'Pytania odłożone' }),
      ).toHaveFocus();
      const sesja = (await odczytajSesje())[0]!;
      oczekuj(sesja.stan).toBe('wTrakcie');
      posprzataj();
      pokaz(
        <Router initialEntries={[`/sesja/${sesja.id}`]}>
          <Aplikacja />
        </Router>,
      );
      await ekran.findByRole('heading', { name: 'Pytania odłożone' });
      await kliknij(
        osoba,
        ekran.getByRole('button', {
          name: 'Wróć do pytania: Jaki podział wybierasz?',
        }),
      );
      oczekuj((await odczytajSesje())[0]?.odlozonePytaniaId).toEqual([
        'podzial',
      ]);
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Wybierz: Czwarty' }),
      );
      oczekuj(
        ekran.queryByRole('region', { name: 'Lista odłożonych pytań' }),
      ).not.toBeInTheDocument();
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      oczekuj(
        ekran.getByRole('heading', { name: 'Quiz zakończony' }),
      ).toBeVisible();
      oczekuj((await odczytajSesje())[0]?.stan).toBe('zakonczona');
      await kliknij(
        osoba,
        ekran.getByRole('link', { name: 'Wróć do Biblioteki' }),
      );
      oczekuj(
        await ekran.findByText('Brak niedokończonej sesji.'),
      ).toBeVisible();
    },
  );

  sprawdz(
    'awaria autosave zachowuje poprzedni wybór, ostrzega i pozwala ponowić zapis',
    async () => {
      const osoba = await otworz();
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      );
      const zapisane = await odczytajSesje();
      const oryginalnyZapis = Magazyn.prototype.put;
      const awaria = atrapy
        .spyOn(Magazyn.prototype, 'put')
        .mockImplementation(function (this: IDBObjectStore, dane: unknown) {
          const zadanie = oryginalnyZapis.call(this, dane);
          this.transaction.abort();
          return zadanie;
        });
      await osoba.click(
        ekran.getByRole('button', { name: 'Wybierz: Czwarty' }),
      );
      oczekuj(await ekran.findByRole('alert')).toHaveTextContent(
        'Nie zapisano sesji',
      );
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Prosty' }),
      ).toHaveAttribute('aria-pressed', 'true');
      oczekuj(
        ekran.queryByText('Postęp zapisany lokalnie.'),
      ).not.toBeInTheDocument();
      oczekuj(await odczytajSesje()).toEqual(zapisane);
      const zamkniecie = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(zamkniecie);
      oczekuj(zamkniecie.defaultPrevented).toBe(true);
      awaria.mockRestore();
      await kliknij(osoba, ekran.getByRole('button', { name: 'Ponów zapis' }));
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Czwarty' }),
      ).toHaveAttribute('aria-pressed', 'true');
      oczekuj(ekran.queryByRole('alert')).not.toBeInTheDocument();
      oczekuj(await odczytajSesje()).not.toEqual(zapisane);
    },
  );
  sprawdz(
    'renderuje pełną treść, cztery warianty i rekomendację bez automatycznego wyboru',
    async () => {
      await otworz();
      const naglowek = await ekran.findByRole('heading', {
        name: 'Jaki podział wybierasz?',
      });
      oczekuj(naglowek).toHaveFocus();
      for (const tekst of [
        'Porównaj kierunki.',
        'Mało kategorii.',
        'Szybkie rozpoczęcie',
        'Mniej szczegółów',
        'Łatwiejsze przygotowanie',
        'Kilka kategorii.',
      ])
        oczekuj(ekran.getByText(tekst)).toBeVisible();
      oczekuj(ekran.getAllByRole('button', { name: /^Wybierz:/ })).toHaveLength(
        4,
      );
      const polecany = ekran.getByRole('button', { name: 'Wybierz: Prosty' });
      oczekuj(polecany).toHaveAttribute('aria-pressed', 'false');
      oczekuj(polecany.closest('article')).toHaveClass('rekomendowany');
      oczekuj(polecany.closest('article')).not.toHaveClass('wybrany');
      oczekuj(
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      ).toBeDisabled();
      oczekuj(
        ekran.getByRole('button', { name: '← Poprzednie pytanie' }),
      ).toBeDisabled();
      oczekuj(
        ekran.queryByRole('button', { name: 'Wróć później' }),
      ).toBeVisible();
      oczekuj(
        ekran.getByRole('textbox', { name: 'Treść własnej odpowiedzi' }),
      ).toBeVisible();
    },
  );

  sprawdz(
    'obsługuje wybór klawiaturą, Dalej/Wstecz, zmianę wyboru i zakończenie',
    async () => {
      const osoba = await otworz();
      const czwarty = await ekran.findByRole('button', {
        name: 'Wybierz: Czwarty',
      });
      czwarty.focus();
      await osoba.keyboard(' ');
      await poczekajNaZapis();
      oczekuj(czwarty).toHaveFocus();
      oczekuj(czwarty).toHaveAttribute('aria-pressed', 'true');
      oczekuj(czwarty.closest('article')).toHaveClass('wybrany');
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Prosty' }),
      ).toHaveAttribute('aria-pressed', 'false');
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      oczekuj(
        ekran.getByRole('heading', { name: 'Kolejne pytanie?' }),
      ).toHaveFocus();
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: '← Poprzednie pytanie' }),
      );
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Czwarty' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Wybierz: Prosty' }),
      );
      const polecany = ekran.getByRole('button', { name: 'Wybierz: Prosty' });
      oczekuj(polecany.closest('article')).toHaveClass(
        'rekomendowany',
        'wybrany',
      );
      oczekuj(
        wewnatrz(polecany.closest('article')!).getByText('Twój wybór'),
      ).toBeVisible();
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      oczekuj(
        ekran.getByRole('heading', { name: 'Quiz zakończony' }),
      ).toHaveFocus();
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: '← Poprzednie pytanie' }),
      );
      oczekuj(
        ekran.getByRole('button', { name: 'Wybierz: Szczegółowy' }),
      ).toHaveAttribute('aria-pressed', 'true');
      oczekuj((await odczytajBiblioteke())[0]?.quiz).toEqual(quiz);
    },
  );

  sprawdz(
    'zapisuje ustawienie lokalnie i ukrywa rekomendację przy uruchomieniu quizu',
    async () => {
      const osoba = await otworz(quiz, '/ustawienia');
      await kliknij(
        osoba,
        ekran.getByRole('checkbox', { name: 'Pokazuj rekomendacje' }),
      );
      await kliknij(osoba, ekran.getByRole('link', { name: 'Biblioteka' }));
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Rozpocznij nową' }),
      );
      const przycisk = await ekran.findByRole('button', {
        name: 'Wybierz: Prosty',
      });
      oczekuj(przycisk.closest('article')).not.toHaveClass('rekomendowany');
      oczekuj(ekran.queryByText(/Rekomendacja autora/)).not.toBeInTheDocument();
      await kliknij(osoba, przycisk);
      oczekuj(przycisk).toHaveAttribute('aria-pressed', 'true');
      await kliknij(osoba, ekran.getByRole('link', { name: 'Ustawienia' }));
      oczekuj(
        ekran.getByRole('checkbox', { name: 'Pokazuj rekomendacje' }),
      ).not.toBeChecked();
    },
  );

  sprawdz(
    'obsługuje TAK/NIE i pokazuje brak wymaganej odpowiedzi',
    async () => {
      await otworz({
        ...quizTekstowy,
        pytania: [
          {
            ...quizTekstowy.pytania[0],
            sposobyOdpowiedzi: [
              { id: 'wybor', rodzaj: 'takNie', wymagany: true },
            ],
          },
        ],
      });
      await ekran.findByRole('radio', { name: 'NIE' });
      await uzytkownik
        .setup()
        .click(ekran.getByRole('button', { name: 'Zatwierdź odpowiedzi' }));
      oczekuj(ekran.getByRole('alert')).toHaveTextContent(
        'Uzupełnij wymagane odpowiedzi',
      );
      oczekuj(
        ekran.queryByRole('button', { name: /^Wybierz:/ }),
      ).not.toBeInTheDocument();
      oczekuj(
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      ).toBeDisabled();
    },
  );

  sprawdz(
    'nowa sesja rozpoczyna od początku niezależnie od poprzedniej',
    async () => {
      const osoba = await otworz();
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('button', { name: 'Następne pytanie →' }),
      );
      await kliknij(
        osoba,
        ekran.getByRole('link', { name: 'Wróć do Biblioteki' }),
      );
      await kliknij(
        osoba,
        await ekran.findByRole('button', { name: 'Rozpocznij nową' }),
      );
      oczekuj(
        await ekran.findByRole('button', { name: 'Wybierz: Prosty' }),
      ).toHaveAttribute('aria-pressed', 'false');
    },
  );

  sprawdz(
    'pokazuje błąd dla nieistniejącego quizu i niedostępnej Biblioteki',
    async () => {
      const widok = pokaz(
        <Router initialEntries={['/sesja/nieistniejaca']}>
          <Aplikacja />
        </Router>,
      );
      oczekuj(await ekran.findByRole('alert')).toHaveTextContent(
        'Nie znaleziono sesji',
      );
      widok.unmount();
      atrapy.stubGlobal('indexedDB', undefined);
      pokaz(
        <Router initialEntries={['/sesja/nieistniejaca']}>
          <Aplikacja />
        </Router>,
      );
      oczekuj(await ekran.findByRole('alert')).toHaveTextContent(
        'Nie można odczytać lokalnej biblioteki',
      );
    },
  );

  sprawdz(
    'pokazuje błąd zapisu ustawienia zamiast sugerować trwałość',
    async () => {
      atrapy.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Brak miejsca');
      });
      pokaz(
        <Router initialEntries={['/ustawienia']}>
          <Aplikacja />
        </Router>,
      );
      await uzytkownik
        .setup()
        .click(ekran.getByRole('checkbox', { name: 'Pokazuj rekomendacje' }));
      oczekuj(ekran.getByRole('alert')).toHaveTextContent(
        'Nie zapisano ustawienia lokalnie',
      );
    },
  );
});
