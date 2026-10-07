import { z } from 'zod';
import {
  WERSJA_SCHEMATU,
  schematAnalizy,
  schematId,
  schematPytania,
  schematRegulyAdaptacyjnej,
  schematTekstu,
  schematWersjiTresci,
  sprawdzUnikalnosc,
} from './quiz';

const schematCzasu = z.iso.datetime();
const schematListyId = z
  .array(schematId)
  .superRefine((identyfikatory, kontekst) =>
    sprawdzUnikalnosc(identyfikatory, kontekst, []),
  );

export const schematAdnotacji = z.looseObject({
  id: schematId,
  pytanieId: schematId,
  wariantId: schematId.optional(),
  tekst: schematTekstu,
});

const podstawaWartosci = { sposobId: schematId };
export const schematWartosciOdpowiedzi = z.discriminatedUnion('rodzaj', [
  z.looseObject({
    ...podstawaWartosci,
    rodzaj: z.literal('pojedynczyWybor'),
    wariantId: schematId,
  }),
  z.looseObject({
    ...podstawaWartosci,
    rodzaj: z.literal('wielokrotnyWybor'),
    wariantyId: schematListyId,
  }),
  z.looseObject({
    ...podstawaWartosci,
    rodzaj: z.literal('takNie'),
    wartosc: z.boolean(),
  }),
  z.looseObject({
    ...podstawaWartosci,
    rodzaj: z.literal('prawdaFalsz'),
    wartosc: z.boolean(),
  }),
  z.looseObject({
    ...podstawaWartosci,
    rodzaj: z.literal('otwarta'),
    tekst: schematTekstu,
  }),
  z.discriminatedUnion('cel', [
    z.looseObject({
      ...podstawaWartosci,
      rodzaj: z.literal('skala'),
      cel: z.literal('pytanie'),
      wartosc: z.number(),
    }),
    z.looseObject({
      ...podstawaWartosci,
      rodzaj: z.literal('skala'),
      cel: z.literal('warianty'),
      oceny: z
        .array(z.looseObject({ wariantId: schematId, wartosc: z.number() }))
        .min(1)
        .superRefine((oceny, kontekst) =>
          sprawdzUnikalnosc(
            oceny.map((ocena) => ocena.wariantId),
            kontekst,
            [],
          ),
        ),
    }),
  ]),
  z.looseObject({
    ...podstawaWartosci,
    rodzaj: z.literal('ranking'),
    wariantyId: schematListyId.min(1),
  }),
  z.looseObject({
    ...podstawaWartosci,
    rodzaj: z.literal('kombinacjaWariantow'),
    elementy: z
      .array(
        z.looseObject({
          wariantId: schematId,
          fragment: schematTekstu,
          adnotacja: schematTekstu.optional(),
        }),
      )
      .min(1),
  }),
]);

export const schematOdpowiedzi = z.discriminatedUnion('rodzaj', [
  z.looseObject({
    rodzaj: z.literal('standardowa'),
    wartosci: z
      .array(schematWartosciOdpowiedzi)
      .min(1)
      .superRefine((wartosci, kontekst) =>
        sprawdzUnikalnosc(
          wartosci.map((wartosc) => wartosc.sposobId),
          kontekst,
          [],
        ),
      ),
  }),
  z.looseObject({
    rodzaj: z.literal('wlasna'),
    tekst: schematTekstu,
    analiza: schematAnalizy,
  }),
]);

export const schematDecyzji = z
  .looseObject({
    id: schematId,
    pytanieId: schematId,
    odpowiedz: schematOdpowiedzi,
    zatwierdzono: schematCzasu,
    notatka: z.string().optional(),
    adnotacje: z.array(schematAdnotacji),
  })
  .superRefine((decyzja, kontekst) => {
    sprawdzUnikalnosc(
      decyzja.adnotacje.map((adnotacja) => adnotacja.id),
      kontekst,
      ['adnotacje'],
    );
    decyzja.adnotacje.forEach((adnotacja, indeks) => {
      if (adnotacja.pytanieId !== decyzja.pytanieId)
        kontekst.addIssue({
          code: 'custom',
          path: ['adnotacje', indeks, 'pytanieId'],
          message: 'Adnotacja musi dotyczyć pytania tej decyzji.',
        });
    });
  });

export const schematSzkicuWlasnejOdpowiedzi = z.discriminatedUnion('stan', [
  z.looseObject({
    pytanieId: schematId,
    stan: z.literal('szkic'),
    tekst: z.string(),
  }),
  z.looseObject({
    pytanieId: schematId,
    stan: z.literal('oczekujeAnalizy'),
    tekst: schematTekstu,
  }),
  z.looseObject({
    pytanieId: schematId,
    stan: z.literal('przeanalizowana'),
    tekst: schematTekstu,
    analiza: schematAnalizy,
  }),
]);

const podstawaZmiany = {
  id: schematId,
  kolejnosc: z.number().int().nonnegative(),
  powod: schematTekstu,
  regulaId: schematId,
  regula: schematRegulyAdaptacyjnej,
  pytanieDoceloweId: schematId,
  zrodlo: z.looseObject({ pytanie: schematPytania, decyzja: schematDecyzji }),
};

export const schematZmianyAdaptacyjnej = z
  .discriminatedUnion('rodzaj', [
    z.looseObject({
      ...podstawaZmiany,
      rodzaj: z.literal('dodaj'),
      przed: z.null(),
      po: schematPytania,
    }),
    z.looseObject({
      ...podstawaZmiany,
      rodzaj: z.literal('pomin'),
      przed: schematPytania,
      po: z.null(),
    }),
    z.looseObject({
      ...podstawaZmiany,
      rodzaj: z.literal('modyfikuj'),
      przed: schematPytania,
      po: schematPytania,
    }),
  ])
  .superRefine((zmiana, kontekst) => {
    if (zmiana.regulaId !== zmiana.regula.id)
      kontekst.addIssue({
        code: 'custom',
        path: ['regulaId'],
        message: 'ID reguły nie pasuje do jej kopii.',
      });
    if (
      zmiana.rodzaj !== zmiana.regula.operacja.rodzaj ||
      zmiana.pytanieDoceloweId !== zmiana.regula.operacja.pytanieId
    )
      kontekst.addIssue({
        code: 'custom',
        path: ['regula'],
        message: 'Reguła nie opisuje tej operacji.',
      });
    if (zmiana.powod !== zmiana.regula.powod)
      kontekst.addIssue({
        code: 'custom',
        path: ['powod'],
        message: 'Powód musi odpowiadać regule.',
      });
    if (
      zmiana.zrodlo.pytanie.id !== zmiana.regula.warunek.pytanieId ||
      zmiana.zrodlo.decyzja.pytanieId !== zmiana.zrodlo.pytanie.id
    )
      kontekst.addIssue({
        code: 'custom',
        path: ['zrodlo'],
        message: 'Źródło zmiany nie odpowiada pytaniu warunku.',
      });
    if (
      zmiana.zrodlo.decyzja.odpowiedz.rodzaj !== 'standardowa' ||
      !zmiana.zrodlo.decyzja.odpowiedz.wartosci.some(
        (wartosc) => wartosc.sposobId === zmiana.regula.warunek.sposobId,
      )
    )
      kontekst.addIssue({
        code: 'custom',
        path: ['zrodlo', 'decyzja'],
        message: 'Brakuje zatwierdzonej wartości wskazanej przez warunek.',
      });
    for (const stan of ['przed', 'po'] as const) {
      if (zmiana[stan] && zmiana[stan].id !== zmiana.pytanieDoceloweId)
        kontekst.addIssue({
          code: 'custom',
          path: [stan, 'id'],
          message: 'Migawka musi dotyczyć zmienianego pytania.',
        });
    }
  });

export const schematSesji = z
  .looseObject({
    schemaVersion: z.literal(WERSJA_SCHEMATU),
    id: schematId,
    quizId: schematId,
    wersjaQuizu: schematWersjiTresci,
    utworzono: schematCzasu,
    zmieniono: schematCzasu,
    stan: z.enum(['wTrakcie', 'zakonczona']),
    biezacePytanieId: schematId.nullable(),
    decyzje: z.array(schematDecyzji),
    historiaDecyzji: z.array(schematDecyzji),
    odlozonePytaniaId: schematListyId,
    szkiceWlasnychOdpowiedzi: z.array(schematSzkicuWlasnejOdpowiedzi),
    zmianyAdaptacyjne: z.array(schematZmianyAdaptacyjnej),
    historiaZmianAdaptacyjnych: z.array(schematZmianyAdaptacyjnej),
  })
  .superRefine((sesja, kontekst) => {
    if (Date.parse(sesja.zmieniono) < Date.parse(sesja.utworzono))
      kontekst.addIssue({
        code: 'custom',
        path: ['zmieniono'],
        message: 'Zmiana sesji nie może poprzedzać jej utworzenia.',
      });
    sprawdzUnikalnosc(
      sesja.decyzje.map((decyzja) => decyzja.pytanieId),
      kontekst,
      ['decyzje'],
    );
    sprawdzUnikalnosc(
      [...sesja.decyzje, ...sesja.historiaDecyzji].map((decyzja) => decyzja.id),
      kontekst,
      ['decyzje'],
    );
    sprawdzUnikalnosc(
      sesja.szkiceWlasnychOdpowiedzi.map((szkic) => szkic.pytanieId),
      kontekst,
      ['szkiceWlasnychOdpowiedzi'],
    );
    sprawdzUnikalnosc(
      [...sesja.zmianyAdaptacyjne, ...sesja.historiaZmianAdaptacyjnych].map(
        (zmiana) => zmiana.id,
      ),
      kontekst,
      ['zmianyAdaptacyjne'],
    );
    sprawdzUnikalnosc(
      sesja.zmianyAdaptacyjne.map((zmiana) => String(zmiana.kolejnosc)),
      kontekst,
      ['zmianyAdaptacyjne'],
    );
    sesja.decyzje.forEach((decyzja, indeks) => {
      if (
        Date.parse(decyzja.zatwierdzono) < Date.parse(sesja.utworzono) ||
        Date.parse(decyzja.zatwierdzono) > Date.parse(sesja.zmieniono)
      )
        kontekst.addIssue({
          code: 'custom',
          path: ['decyzje', indeks, 'zatwierdzono'],
          message: 'Data decyzji musi mieścić się w czasie sesji.',
        });
      if (sesja.odlozonePytaniaId.includes(decyzja.pytanieId))
        kontekst.addIssue({
          code: 'custom',
          path: ['decyzje', indeks],
          message: 'Odłożone pytanie nie może mieć aktualnej decyzji.',
        });
    });
  });

export type Odpowiedz = z.infer<typeof schematOdpowiedzi>;
export type WartoscOdpowiedzi = z.infer<typeof schematWartosciOdpowiedzi>;
export type Decyzja = z.infer<typeof schematDecyzji>;
export type Adnotacja = z.infer<typeof schematAdnotacji>;
export type ZmianaAdaptacyjna = z.infer<typeof schematZmianyAdaptacyjnej>;
export type Sesja = z.infer<typeof schematSesji>;
export type SzkicWlasnejOdpowiedzi = z.infer<
  typeof schematSzkicuWlasnejOdpowiedzi
>;
