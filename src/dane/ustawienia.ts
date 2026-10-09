const KLUCZ_REKOMENDACJI = 'quizomat.pokazuj-rekomendacje';
const KLUCZ_MOTYWU = 'quizomat.motyw';

export type Motyw = 'jasny' | 'kolorowy' | 'ciemny' | 'systemowy';

export function odczytajMotyw(): Motyw {
  try {
    const motyw = localStorage.getItem(KLUCZ_MOTYWU);
    if (
      motyw === 'jasny' ||
      motyw === 'kolorowy' ||
      motyw === 'ciemny' ||
      motyw === 'systemowy'
    ) {
      return motyw;
    }
  } catch {
    // Bez dostępu do pamięci lokalnej używamy domyślnego motywu.
  }
  return 'kolorowy';
}

export function zastosujMotyw(motyw: Motyw): void {
  document.documentElement.dataset.motyw = motyw;
  const ciemny =
    motyw === 'ciemny' ||
    (motyw === 'systemowy' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      ciemny ? '#131c18' : motyw === 'kolorowy' ? '#e8f3e9' : '#f5f6f7',
    );
}

export function zapiszMotyw(motyw: Motyw): void {
  localStorage.setItem(KLUCZ_MOTYWU, motyw);
  zastosujMotyw(motyw);
}

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
