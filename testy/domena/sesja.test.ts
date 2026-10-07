import { describe as opisz, expect as oczekuj, it as sprawdz } from 'vitest';
import {
  schematAdnotacji,
  schematDecyzji,
  schematOdpowiedzi,
  schematSesji,
  schematSzkicuWlasnejOdpowiedzi,
  schematWartosciOdpowiedzi,
  schematZmianyAdaptacyjnej,
} from '../../src/domena/sesja';
import {
  decyzjaKompozycyjna,
  pytanieDodatkowe,
  sesjaPrzykladowa,
  zmianaAdaptacyjna,
} from './przyklady';

const analiza = {
  tryb: 'autorska',
  interpretacja: 'Połączenie elementów dwóch wariantów.',
  potencjalneSkutki: ['Potrzeba sprawdzenia spójności.'],
};

opisz('Odpowiedzi i decyzje', () => {
  sprawdz(
    'zachowuje wielokrotny wybór, oceny, komentarz, kombinację i adnotację po zapisie JSON',
    () => {
      const dane: unknown = JSON.parse(JSON.stringify(decyzjaKompozycyjna));
      oczekuj(schematDecyzji.parse(dane)).toEqual(decyzjaKompozycyjna);
    },
  );

  sprawdz.each([
    { rodzaj: 'pojedynczyWybor', wariantId: 'a' },
    { rodzaj: 'wielokrotnyWybor', wariantyId: ['a', 'c'] },
    { rodzaj: 'takNie', wartosc: false },
    { rodzaj: 'prawdaFalsz', wartosc: true },
    { rodzaj: 'otwarta', tekst: 'Własny komentarz' },
    { rodzaj: 'skala', cel: 'pytanie', wartosc: 2.5 },
    {
      rodzaj: 'skala',
      cel: 'warianty',
      oceny: [{ wariantId: 'a', wartosc: 4 }],
    },
    { rodzaj: 'ranking', wariantyId: ['c', 'a'] },
    {
      rodzaj: 'kombinacjaWariantow',
      elementy: [
        { wariantId: 'a', fragment: 'Układ' },
        { wariantId: 'a', fragment: 'Odstępy' },
      ],
    },
  ])('obsługuje wartość $rodzaj (%#)', (wartosc) => {
    const dane = { sposobId: 'sposob', ...wartosc };
    oczekuj(schematWartosciOdpowiedzi.parse(dane)).toEqual(dane);
  });

  sprawdz.each([
    { rodzaj: 'pojedynczyWybor', wariantId: '' },
    { rodzaj: 'wielokrotnyWybor', wariantyId: ['a', 'a'] },
    { rodzaj: 'takNie', wartosc: 'TAK' },
    { rodzaj: 'prawdaFalsz', wartosc: 1 },
    { rodzaj: 'otwarta', tekst: '  ' },
    { rodzaj: 'skala', cel: 'pytanie', wartosc: NaN },
    { rodzaj: 'skala', cel: 'warianty', wartosc: 4 },
    {
      rodzaj: 'skala',
      cel: 'warianty',
      oceny: [
        { wariantId: 'a', wartosc: 4 },
        { wariantId: 'a', wartosc: 5 },
      ],
    },
    { rodzaj: 'ranking', wariantyId: [] },
    { rodzaj: 'ranking', wariantyId: ['a', 'a'] },
    {
      rodzaj: 'kombinacjaWariantow',
      elementy: [{ wariantId: 'a', fragment: '' }],
    },
  ])('odrzuca błędną wartość (%#)', (wartosc) =>
    oczekuj(
      schematWartosciOdpowiedzi.safeParse({ sposobId: 'sposob', ...wartosc })
        .success,
    ).toBe(false),
  );

  sprawdz(
    'odrzuca powtórzoną wartość tej samej mechaniki oraz pustą odpowiedź',
    () => {
      const odpowiedz = {
        rodzaj: 'standardowa',
        wartosci: [
          { sposobId: 'wybor', rodzaj: 'takNie', wartosc: true },
          { sposobId: 'wybor', rodzaj: 'takNie', wartosc: false },
        ],
      };
      oczekuj(schematOdpowiedzi.safeParse(odpowiedz).success).toBe(false);
      oczekuj(
        schematOdpowiedzi.safeParse({ rodzaj: 'standardowa', wartosci: [] })
          .success,
      ).toBe(false);
    },
  );

  sprawdz(
    'własna odpowiedź wymaga analizy, a decyzja wymaga potwierdzenia',
    () => {
      const odpowiedz = { rodzaj: 'wlasna', tekst: 'Połączę układ i kolory.' };
      oczekuj(schematOdpowiedzi.safeParse(odpowiedz).success).toBe(false);
      const decyzja = {
        ...decyzjaKompozycyjna,
        odpowiedz: { ...odpowiedz, analiza },
        zatwierdzono: undefined,
      };
      oczekuj(schematDecyzji.safeParse(decyzja).success).toBe(false);
      oczekuj(
        schematDecyzji.safeParse({
          ...decyzja,
          zatwierdzono: decyzjaKompozycyjna.zatwierdzono,
        }).success,
      ).toBe(true);
      oczekuj(
        schematOdpowiedzi.safeParse({
          ...odpowiedz,
          analiza: { ...analiza, tryb: 'ai' },
        }).success,
      ).toBe(true);
    },
  );

  sprawdz.each([
    { stan: 'szkic', tekst: '' },
    { stan: 'oczekujeAnalizy', tekst: 'Nowy wariant' },
    { stan: 'przeanalizowana', tekst: 'Nowy wariant', analiza },
  ])('szkic $stan nie staje się zatwierdzoną odpowiedzią', (szkic) => {
    const dane = { pytanieId: 'uklad', ...szkic };
    oczekuj(schematSzkicuWlasnejOdpowiedzi.safeParse(dane).success).toBe(true);
    oczekuj(schematOdpowiedzi.safeParse(dane).success).toBe(false);
  });
  sprawdz('nie pozwala oznaczyć analizy jako zakończonej bez wyniku', () => {
    oczekuj(
      schematSzkicuWlasnejOdpowiedzi.safeParse({
        pytanieId: 'uklad',
        stan: 'przeanalizowana',
        tekst: 'Nowy wariant',
      }).success,
    ).toBe(false);
  });
  sprawdz('sprawdza ID, treść i powiązanie adnotacji', () => {
    oczekuj(
      schematAdnotacji.safeParse({
        id: 'uwaga',
        pytanieId: 'uklad',
        tekst: ' ',
      }).success,
    ).toBe(false);
    const decyzja = schematDecyzji.parse(decyzjaKompozycyjna);
    decyzja.adnotacje[0]!.pytanieId = 'inne';
    oczekuj(schematDecyzji.safeParse(decyzja).success).toBe(false);
    decyzja.adnotacje[0]!.pytanieId = decyzja.pytanieId;
    decyzja.adnotacje.push(structuredClone(decyzja.adnotacje[0]!));
    oczekuj(schematDecyzji.safeParse(decyzja).success).toBe(false);
  });
});

opisz('Źródło jawnej zmiany adaptacyjnej', () => {
  sprawdz('zachowuje pełną regułę, pytanie i zatwierdzoną odpowiedź', () =>
    oczekuj(schematZmianyAdaptacyjnej.parse(zmianaAdaptacyjna)).toEqual(
      zmianaAdaptacyjna,
    ),
  );
  sprawdz.each(['pomin', 'modyfikuj'] as const)(
    'obsługuje migawki operacji %s',
    (rodzaj) => {
      const operacja =
        rodzaj === 'pomin'
          ? { rodzaj, pytanieId: 'nazwy' }
          : { rodzaj, pytanieId: 'nazwy', zmiany: { tresc: 'Nowa treść' } };
      const dane = {
        ...zmianaAdaptacyjna,
        rodzaj,
        regula: { ...zmianaAdaptacyjna.regula, operacja },
        przed: pytanieDodatkowe,
        po:
          rodzaj === 'pomin'
            ? null
            : { ...pytanieDodatkowe, tresc: 'Nowa treść' },
      };
      oczekuj(schematZmianyAdaptacyjnej.safeParse(dane).success).toBe(true);
    },
  );
  sprawdz.each([
    { regulaId: 'inna' },
    { powod: 'Inny powód' },
    { pytanieDoceloweId: 'inne' },
    { przed: pytanieDodatkowe },
    { po: null },
    { zrodlo: undefined },
    { kolejnosc: -1 },
    { po: { ...pytanieDodatkowe, id: 'inne' } },
    {
      zrodlo: {
        ...zmianaAdaptacyjna.zrodlo,
        decyzja: { ...zmianaAdaptacyjna.zrodlo.decyzja, pytanieId: 'inne' },
      },
    },
    {
      zrodlo: {
        ...zmianaAdaptacyjna.zrodlo,
        decyzja: {
          ...zmianaAdaptacyjna.zrodlo.decyzja,
          zatwierdzono: undefined,
        },
      },
    },
    {
      zrodlo: {
        ...zmianaAdaptacyjna.zrodlo,
        decyzja: {
          ...zmianaAdaptacyjna.zrodlo.decyzja,
          odpowiedz: {
            rodzaj: 'standardowa',
            wartosci: [{ sposobId: 'inne', rodzaj: 'takNie', wartosc: true }],
          },
        },
      },
    },
  ])('odrzuca niespójny lub niepełny ślad (%#)', (zmiany) =>
    oczekuj(
      schematZmianyAdaptacyjnej.safeParse({ ...zmianaAdaptacyjna, ...zmiany })
        .success,
    ).toBe(false),
  );
});

opisz('Wersjonowana sesja', () => {
  sprawdz('przyjmuje sesję i nie zmienia wejścia', () => {
    const kopia = structuredClone(sesjaPrzykladowa);
    oczekuj(schematSesji.parse(kopia)).toEqual(sesjaPrzykladowa);
    oczekuj(kopia).toEqual(sesjaPrzykladowa);
  });
  sprawdz(
    'przechowuje oczekującą edycję bez zastępowania wcześniejszej decyzji',
    () => {
      const sesja = schematSesji.parse(sesjaPrzykladowa);
      sesja.szkiceWlasnychOdpowiedzi.push({
        pytanieId: 'podzial',
        stan: 'oczekujeAnalizy',
        tekst: 'Nowe rozwiązanie',
      });
      oczekuj(schematSesji.parse(sesja).decyzje).toEqual(
        sesjaPrzykladowa.decyzje,
      );
    },
  );
  sprawdz('rozróżnia historię, odłożenie i aktualną decyzję', () => {
    const sesja = schematSesji.parse(sesjaPrzykladowa);
    sesja.historiaDecyzji.push(sesja.decyzje.pop()!);
    sesja.odlozonePytaniaId.push('podzial');
    oczekuj(schematSesji.safeParse(sesja).success).toBe(true);
  });
  sprawdz.each([
    { schemaVersion: '0.1.0' },
    { quizId: '' },
    { utworzono: 'wczoraj' },
    { zmieniono: '2026-10-07T09:00:00Z' },
    { stan: 'szkic' },
    { decyzje: [sesjaPrzykladowa.decyzje[0], sesjaPrzykladowa.decyzje[0]] },
    { historiaDecyzji: sesjaPrzykladowa.decyzje },
    { odlozonePytaniaId: ['podzial'] },
    { odlozonePytaniaId: ['nazwy', 'nazwy'] },
    {
      szkiceWlasnychOdpowiedzi: [
        { pytanieId: 'nazwy', stan: 'szkic', tekst: '' },
        { pytanieId: 'nazwy', stan: 'szkic', tekst: '' },
      ],
    },
    { historiaZmianAdaptacyjnych: [zmianaAdaptacyjna] },
    {
      zmianyAdaptacyjne: [
        zmianaAdaptacyjna,
        { ...zmianaAdaptacyjna, id: 'zmiana-2' },
      ],
    },
    {
      decyzje: [
        {
          ...sesjaPrzykladowa.decyzje[0],
          zatwierdzono: '2026-10-08T10:00:00Z',
        },
      ],
    },
  ])('odrzuca niespójny zapis (%#)', (zmiany) =>
    oczekuj(
      schematSesji.safeParse({ ...sesjaPrzykladowa, ...zmiany }).success,
    ).toBe(false),
  );
});
