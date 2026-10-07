import { schematAnalizy } from '../domena/quiz';
import type { Pytanie, Quiz } from '../domena/quiz';
import type { SzkicWlasnejOdpowiedzi } from '../domena/sesja';

export type Analiza = Extract<
  SzkicWlasnejOdpowiedzi,
  { stan: 'przeanalizowana' }
>['analiza'];
export interface ZlecenieAnalizy {
  pytanie: Pytanie;
  tekst: string;
  quiz: Quiz;
}
export interface Analizator {
  analizuj(zlecenie: ZlecenieAnalizy): Promise<Analiza>;
}

export function sprawdzAnalize(dane: unknown, quiz: Quiz): Analiza {
  const wynik = schematAnalizy.safeParse(dane);
  if (!wynik.success)
    throw new Error(
      'Analizator zwrócił niepoprawny wynik. Szkic pozostał zapisany.',
    );
  const analiza = wynik.data;
  const identyfikatory = new Set(
    [...quiz.pytania, ...quiz.pytaniaDodatkowe].map((pytanie) => pytanie.id),
  );
  if (analiza.dotknietePytaniaId?.some((id) => !identyfikatory.has(id)))
    throw new Error('Analiza wskazuje nieistniejące pytanie.');
  return analiza;
}

// Lokalna analiza autora jest dostępna bez sieci. Tryb AI wymaga osobnej integracji.
export const analizatorAutorski: Analizator = {
  async analizuj({ pytanie, quiz }) {
    const analiza = pytanie.innaOdpowiedz?.analiza;
    if (analiza?.tryb !== 'autorska')
      throw new Error(
        'Analiza jest niedostępna. Szkic pozostał zapisany. Spróbuj ponownie później.',
      );
    return sprawdzAnalize(structuredClone(analiza), quiz);
  },
};

export class FakeAnalizator implements Analizator {
  constructor(private readonly niedostepny = false) {}

  async analizuj({ tekst, pytanie }: ZlecenieAnalizy): Promise<Analiza> {
    if (this.niedostepny)
      throw new Error('Analiza jest niedostępna. Szkic pozostał zapisany.');
    return {
      tryb: 'autorska',
      interpretacja: `Analiza testowa: ${tekst}`,
      zalety: ['Zachowuje własne sformułowanie.'],
      wady: ['Wymaga sprawdzenia znaczenia.'],
      potencjalneSkutki: [
        'Zastąpi poprzednią odpowiedź dopiero po zatwierdzeniu.',
      ],
      dotknietePytaniaId: [pytanie.id],
      niejednoznacznosci: ['Nie przypisano automatycznie do wariantu.'],
    };
  }
}
