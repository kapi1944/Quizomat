const KLUCZ_REKOMENDACJI = 'quizomat.pokazuj-rekomendacje';

export function odczytajRekomendacje(): boolean {
  try {
    return localStorage.getItem(KLUCZ_REKOMENDACJI) !== 'false';
  } catch {
    return true;
  }
}

export function zapiszRekomendacje(pokazuj: boolean): void {
  localStorage.setItem(KLUCZ_REKOMENDACJI, String(pokazuj));
}
