import { walidujImportQuizu } from './walidator';
import type { WynikImportu } from './walidator';

export function odczytajPlikQuizu(plik: File): Promise<WynikImportu> {
  return odczytajTekstPliku(plik).then(walidujImportQuizu);
}

export function odczytajTekstPliku(plik: File): Promise<string> {
  return new Promise((zakoncz, odrzuc) => {
    const czytnik = new FileReader();
    czytnik.onerror = () =>
      odrzuc(new Error('Nie można odczytać pliku. Wybierz go ponownie.'));
    czytnik.onabort = () => odrzuc(new Error('Odczyt pliku został przerwany.'));
    czytnik.onload = () => {
      if (typeof czytnik.result !== 'string') {
        odrzuc(new Error('Nie można odczytać tekstu pliku.'));
        return;
      }
      zakoncz(czytnik.result);
    };
    czytnik.readAsText(plik, 'UTF-8');
  });
}
