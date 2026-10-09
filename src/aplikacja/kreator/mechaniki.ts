import type { MechanikaOdpowiedzi } from '../../domena/quiz';

export const nazwyTypow: Record<MechanikaOdpowiedzi['rodzaj'], string> = {
  pojedynczyWybor: 'Jedna odpowiedź',
  wielokrotnyWybor: 'Wiele odpowiedzi',
  takNie: 'Tak / Nie',
  prawdaFalsz: 'Prawda / Fałsz',
  otwarta: 'Odpowiedź tekstowa',
  skala: 'Skala oceny',
  ranking: 'Ranking wariantów',
  kombinacjaWariantow: 'Kombinacja fragmentów',
};

export function nowaMechanika(
  rodzaj: MechanikaOdpowiedzi['rodzaj'],
  liczbaWariantow: number,
  id: string = crypto.randomUUID(),
  wymagany = true,
): MechanikaOdpowiedzi {
  const podstawa = { id, wymagany };
  switch (rodzaj) {
    case 'wielokrotnyWybor':
    case 'ranking':
      return {
        ...podstawa,
        rodzaj,
        minimum: 1,
        maksimum: Math.max(1, liczbaWariantow),
      };
    case 'otwarta':
      return { ...podstawa, rodzaj, maksymalnaDlugosc: 2000 };
    case 'skala':
      return {
        ...podstawa,
        rodzaj,
        cel: 'pytanie',
        minimum: 1,
        maksimum: 5,
        krok: 1,
      };
    case 'kombinacjaWariantow':
      return { ...podstawa, rodzaj, minimumElementow: 1 };
    default:
      return { ...podstawa, rodzaj };
  }
}

export function potrzebujeWariantow(mechanika: MechanikaOdpowiedzi) {
  return (
    [
      'pojedynczyWybor',
      'wielokrotnyWybor',
      'ranking',
      'kombinacjaWariantow',
    ].includes(mechanika.rodzaj) ||
    (mechanika.rodzaj === 'skala' && mechanika.cel === 'warianty')
  );
}
