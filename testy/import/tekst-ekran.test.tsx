import { IDBFactory as FabrykaBazy } from 'fake-indexeddb';
import { render as pokaz, screen as ekran } from '@testing-library/react';
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
import { odczytajBiblioteke } from '../../src/dane/biblioteka';

const poprawny = '1. Czy pokazać tytuł?\nA. Tak\nB. Nie';
const uszkodzony = `${poprawny}\n2. Czy pokazać opis?\nA. Tak\nB.`;

przedKazdym(() => atrapy.stubGlobal('indexedDB', new FabrykaBazy()));
poKazdym(() => {
  atrapy.restoreAllMocks();
  atrapy.unstubAllGlobals();
});

async function otworz() {
  pokaz(
    <Router initialEntries={['/import']}>
      <Aplikacja />
    </Router>,
  );
  const osoba = uzytkownik.setup();
  await osoba.click(ekran.getByRole('button', { name: 'Import tekstowy' }));
  await osoba.type(ekran.getByLabelText('Tytuł pakietu'), 'Tekstowy quiz');
  await osoba.type(ekran.getByLabelText('Język pakietu (np. pl)'), 'pl');
  return osoba;
}

sprawdz(
  'import tekstu wymaga przeglądu, zapisuje po akceptacji i uruchamia ekran silnika',
  async () => {
    const osoba = await otworz();
    await osoba.click(ekran.getByLabelText('Tekst do korekty'));
    await osoba.paste(poprawny);
    await osoba.click(ekran.getByRole('button', { name: 'Rozpoznaj pytania' }));
    await osoba.click(
      ekran.getByRole('button', { name: 'Sprawdź kanoniczny JSON' }),
    );
    oczekuj(ekran.getByRole('alert')).toHaveTextContent(
      'Potwierdź interpretację',
    );
    oczekuj(await odczytajBiblioteke()).toEqual([]);
    await osoba.click(ekran.getByLabelText(/Potwierdzam interpretację/));
    await osoba.click(
      ekran.getByRole('button', { name: 'Sprawdź kanoniczny JSON' }),
    );
    await ekran.findByRole('heading', { name: '1 z 1 pytań poprawnych' });
    oczekuj(await odczytajBiblioteke()).toEqual([]);
    await osoba.click(ekran.getByRole('button', { name: 'Zatwierdź import' }));
    await ekran.findByRole('heading', { name: 'Biblioteka' });
    oczekuj((await odczytajBiblioteke())[0]?.daneZrodlowe).toMatchObject({
      oryginal: poprawny,
      niekompletny: false,
    });
    await osoba.click(
      await ekran.findByRole('button', { name: 'Rozpocznij nową' }),
    );
    await ekran.findByRole('heading', { name: 'Czy pokazać tytuł?' });
  },
);

sprawdz(
  'niepełne pytanie pozostaje w raporcie, częściowy zakres wymaga osobnej zgody i ma znacznik w bibliotece',
  async () => {
    const osoba = await otworz();
    await osoba.click(ekran.getByLabelText('Tekst do korekty'));
    await osoba.paste(uszkodzony);
    await osoba.click(ekran.getByRole('button', { name: 'Rozpoznaj pytania' }));
    oczekuj(ekran.getByText(/Przerwany lub pusty wariant/)).toBeInTheDocument();
    await osoba.click(ekran.getByLabelText('Uwzględnij pytanie 2'));
    await osoba.click(ekran.getByLabelText(/Potwierdzam interpretację/));
    await osoba.click(
      ekran.getByRole('button', { name: 'Sprawdź kanoniczny JSON' }),
    );
    oczekuj(ekran.getByRole('alert')).toHaveTextContent('częściowy zakres');
    oczekuj(await odczytajBiblioteke()).toEqual([]);
    await osoba.click(
      ekran.getByLabelText(/Zatwierdzam wskazany częściowy zakres/),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Sprawdź kanoniczny JSON' }),
    );
    oczekuj(
      ekran.getByText('Import częściowy — quiz niekompletny względem źródła.'),
    ).toBeInTheDocument();
    await osoba.click(ekran.getByRole('button', { name: 'Zatwierdź import' }));
    await ekran.findByText('Import częściowy — niekompletny względem źródła.');
    oczekuj((await odczytajBiblioteke())[0]?.daneZrodlowe).toMatchObject({
      oryginal: uszkodzony,
      niekompletny: true,
    });
  },
);

sprawdz(
  'korekta konfliktu unieważnia raport i zachowuje oryginał po zapisie',
  async () => {
    const osoba = await otworz();
    const konflikt = `${poprawny.replace('A. Tak', 'A. Tak ⭐')}\nSugestia: B — Powód.`;
    await osoba.click(ekran.getByLabelText('Tekst do korekty'));
    await osoba.paste(konflikt);
    await osoba.click(ekran.getByRole('button', { name: 'Rozpoznaj pytania' }));
    oczekuj(ekran.getByText(/Sprzeczne lub wielokrotne/)).toBeInTheDocument();
    await osoba.click(ekran.getByLabelText(/Potwierdzam interpretację/));
    await osoba.click(
      ekran.getByRole('button', { name: 'Sprawdź kanoniczny JSON' }),
    );
    oczekuj(ekran.getByRole('alert')).toHaveTextContent('Popraw błędy');
    await osoba.clear(ekran.getByLabelText('Tekst do korekty'));
    await osoba.paste(konflikt.replace(' ⭐', ''));
    oczekuj(
      ekran.queryByRole('heading', { name: 'Podgląd tekstu' }),
    ).not.toBeInTheDocument();
    await osoba.click(ekran.getByRole('button', { name: 'Rozpoznaj pytania' }));
    oczekuj(
      ekran.getByLabelText(/Potwierdzam interpretację/),
    ).not.toBeChecked();
    await osoba.click(ekran.getByLabelText(/Korekta zachowuje pełny zakres/));
    await osoba.click(ekran.getByLabelText(/Potwierdzam interpretację/));
    await osoba.click(
      ekran.getByRole('button', { name: 'Sprawdź kanoniczny JSON' }),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Wróć do korekty tekstu' }),
    );
    oczekuj(ekran.getByLabelText('Tekst do korekty')).toHaveValue(
      konflikt.replace(' ⭐', ''),
    );
    await osoba.click(
      ekran.getByRole('button', { name: 'Sprawdź kanoniczny JSON' }),
    );
    await osoba.click(ekran.getByRole('button', { name: 'Zatwierdź import' }));
    await ekran.findByRole('heading', { name: 'Biblioteka' });
    oczekuj((await odczytajBiblioteke())[0]?.daneZrodlowe).toMatchObject({
      oryginal: konflikt,
      tekstPoKorekcie: konflikt.replace(' ⭐', ''),
    });
  },
);

sprawdz.each(['txt', 'md'])(
  'wybiera plik %s i pokazuje rozpoznany tekst',
  async (rozszerzenie) => {
    const osoba = await otworz();
    await osoba.upload(
      ekran.getByLabelText('Plik TXT lub MD'),
      new File([poprawny], `quiz.${rozszerzenie}`, { type: 'text/plain' }),
    );
    await osoba.click(ekran.getByRole('button', { name: 'Rozpoznaj pytania' }));
    oczekuj(
      ekran.getByRole('heading', { name: 'Pytanie 1: Czy pokazać tytuł?' }),
    ).toBeInTheDocument();
  },
);

sprawdz('awaria odczytu tekstu jest widoczna bez zapisu', async () => {
  const osoba = await otworz();
  atrapy.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (
    this: FileReader,
  ) {
    this.dispatchEvent(new ProgressEvent('error'));
  });
  await osoba.upload(
    ekran.getByLabelText('Plik TXT lub MD'),
    new File([poprawny], 'quiz.txt', { type: 'text/plain' }),
  );
  await ekran.findByText(
    'Nie można odczytać pliku tekstowego. Wybierz go ponownie.',
  );
  oczekuj(await odczytajBiblioteke()).toEqual([]);
});
