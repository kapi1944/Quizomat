export type SciezkaDanych = (string | number)[];

type KontekstJson =
  | {
      rodzaj: 'obiekt';
      sciezka: SciezkaDanych;
      klucze: Set<string>;
      klucz: string;
      oczekujeKlucza: boolean;
    }
  | { rodzaj: 'tablica'; sciezka: SciezkaDanych; indeks: number };

// Wywoływane wyłącznie po JSON.parse: składnia jest już zweryfikowana.
export function znajdzPowtorzonePola(tekst: string): SciezkaDanych[] {
  const stos: KontekstJson[] = [];
  const powtorzenia: SciezkaDanych[] = [];
  const tokeny = tekst.matchAll(
    /"(?:\\.|[^"\\])*"|[{}[\],:]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g,
  );

  for (const dopasowanie of tokeny) {
    const token = dopasowanie[0];
    const kontekst = stos.at(-1);
    if (token === ':') continue;
    if (token === ',') {
      if (kontekst?.rodzaj === 'obiekt') kontekst.oczekujeKlucza = true;
      else if (kontekst?.rodzaj === 'tablica') kontekst.indeks++;
      continue;
    }
    if (token === '}' || token === ']') {
      stos.pop();
      continue;
    }
    if (
      token.startsWith('"') &&
      kontekst?.rodzaj === 'obiekt' &&
      kontekst.oczekujeKlucza
    ) {
      const klucz: string = JSON.parse(token);
      if (kontekst.klucze.has(klucz))
        powtorzenia.push([...kontekst.sciezka, klucz]);
      kontekst.klucze.add(klucz);
      kontekst.klucz = klucz;
      kontekst.oczekujeKlucza = false;
      continue;
    }
    const sciezka = kontekst
      ? [
          ...kontekst.sciezka,
          kontekst.rodzaj === 'obiekt' ? kontekst.klucz : kontekst.indeks,
        ]
      : [];
    if (token === '{')
      stos.push({
        rodzaj: 'obiekt',
        sciezka,
        klucze: new Set(),
        klucz: '',
        oczekujeKlucza: true,
      });
    else if (token === '[')
      stos.push({ rodzaj: 'tablica', sciezka, indeks: 0 });
  }
  return powtorzenia;
}
