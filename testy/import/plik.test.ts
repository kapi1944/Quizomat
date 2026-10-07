import {
  describe as opisz,
  expect as oczekuj,
  it as sprawdz,
  vi as atrapy,
} from 'vitest';
import { odczytajPlikQuizu } from '../../src/import/plik';
import { quizTekstowy } from '../domena/przyklady';

opisz('Odczyt pliku quizu', () => {
  sprawdz(
    'czyta UTF-8 i przekazuje tekst do kanonicznego walidatora',
    async () => {
      const wynik = await odczytajPlikQuizu(
        new File([JSON.stringify(quizTekstowy)], 'quiz.json'),
      );
      oczekuj(wynik.quiz?.tytul).toBe('Wybierz sposób pracy');
      oczekuj(wynik.stan).toBe('gotowyDoZatwierdzenia');
    },
  );
  sprawdz(
    'zwraca raport błędu składni zamiast zatwierdzonego quizu',
    async () => {
      const wynik = await odczytajPlikQuizu(new File(['{'], 'quiz.json'));
      oczekuj(wynik.stan).toBe('zablokowany');
      oczekuj(wynik.raport.bledy[0]?.kod).toBe('NIEPOPRAWNY_JSON');
    },
  );
  sprawdz('zgłasza awarię odczytu', async () => {
    const odczyt = atrapy
      .spyOn(FileReader.prototype, 'readAsText')
      .mockImplementation(function (this: FileReader) {
        this.dispatchEvent(new ProgressEvent('error'));
      });
    try {
      await oczekuj(
        odczytajPlikQuizu(new File(['{}'], 'quiz.json')),
      ).rejects.toThrow('Nie można odczytać');
    } finally {
      odczyt.mockRestore();
    }
  });
});
