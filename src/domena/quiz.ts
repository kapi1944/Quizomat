import { z } from 'zod';

export const WERSJA_SCHEMATU = '1.0.0';
export const schematId = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'Wymagane jest stabilne ID.');
export const schematTekstu = z
  .string()
  .refine((tekst) => tekst.trim().length > 0, 'Tekst nie może być pusty.');
export const schematWersjiTresci = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Wersja treści musi mieć postać X.Y.Z.');
export const schematKonsekwencji = schematTekstu;

export const schematObrazu = z.union([
  z.looseObject({
    id: schematId,
    opisAlternatywny: schematTekstu,
    dane: z
      .string()
      .regex(
        /^data:image\/(png|jpeg|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
      )
      .refine(
        (dane) => dane.split(',')[1]?.length !== 0,
        'Obraz nie może być pusty.',
      ),
    url: z.never().optional(),
  }),
  z.looseObject({
    id: schematId,
    opisAlternatywny: schematTekstu,
    url: z.url({ protocol: /^https$/ }),
    dane: z.never().optional(),
  }),
]);

export const schematPrezentacji = z.looseObject({
  rodzaj: z.enum(['tekstowa', 'wizualna', 'mieszana']),
  obrazy: z.array(schematObrazu).optional(),
});

export const schematWariantu = z.looseObject({
  id: schematId,
  etykieta: schematTekstu,
  opis: schematTekstu.optional(),
  zalety: z.array(schematTekstu).optional(),
  wady: z.array(schematTekstu).optional(),
  konsekwencje: z.array(schematKonsekwencji).optional(),
  wyjasnienie: schematTekstu.optional(),
  obrazy: z.array(schematObrazu).optional(),
});

export const schematRekomendacji = z.looseObject({
  wariantId: schematId,
  uzasadnienie: schematTekstu,
});

export const schematAnalizy = z.looseObject({
  tryb: z.enum(['autorska', 'ai']),
  interpretacja: schematTekstu,
  potencjalneSkutki: z.array(schematKonsekwencji),
});

const podstawaMechaniki = { id: schematId, wymagany: z.boolean() };
const graniceWyboru = {
  minimum: z.number().int().nonnegative(),
  maksimum: z.number().int().nonnegative(),
};

export const schematMechanikiOdpowiedzi = z
  .discriminatedUnion('rodzaj', [
    z.looseObject({
      ...podstawaMechaniki,
      rodzaj: z.literal('pojedynczyWybor'),
    }),
    z.looseObject({
      ...podstawaMechaniki,
      rodzaj: z.literal('wielokrotnyWybor'),
      ...graniceWyboru,
    }),
    z.looseObject({ ...podstawaMechaniki, rodzaj: z.literal('takNie') }),
    z.looseObject({ ...podstawaMechaniki, rodzaj: z.literal('prawdaFalsz') }),
    z.looseObject({
      ...podstawaMechaniki,
      rodzaj: z.literal('otwarta'),
      maksymalnaDlugosc: z.number().int().positive(),
    }),
    z.looseObject({
      ...podstawaMechaniki,
      rodzaj: z.literal('skala'),
      minimum: z.number(),
      maksimum: z.number(),
      krok: z.number().positive(),
      cel: z.enum(['pytanie', 'warianty']),
    }),
    z.looseObject({
      ...podstawaMechaniki,
      rodzaj: z.literal('ranking'),
      minimum: z.number().int().positive(),
      maksimum: z.number().int().positive(),
    }),
    z.looseObject({
      ...podstawaMechaniki,
      rodzaj: z.literal('kombinacjaWariantow'),
      minimumElementow: z.number().int().positive(),
    }),
  ])
  .superRefine((mechanika, kontekst) => {
    if (
      mechanika.rodzaj === 'wielokrotnyWybor' ||
      mechanika.rodzaj === 'ranking' ||
      mechanika.rodzaj === 'skala'
    ) {
      if (
        mechanika.minimum > mechanika.maksimum ||
        (mechanika.rodzaj === 'skala' &&
          mechanika.minimum === mechanika.maksimum)
      ) {
        kontekst.addIssue({
          code: 'custom',
          path: ['maksimum'],
          message: 'Niepoprawny zakres odpowiedzi.',
        });
      }
    }
  });

export function sprawdzUnikalnosc(
  identyfikatory: string[],
  kontekst: z.RefinementCtx,
  sciezka: (string | number)[],
) {
  const napotkane = new Set<string>();
  identyfikatory.forEach((identyfikator, indeks) => {
    if (napotkane.has(identyfikator))
      kontekst.addIssue({
        code: 'custom',
        path: [...sciezka, indeks],
        message: `Powtórzone ID: ${identyfikator}.`,
        params: { kod: 'POWTORZONE_ID' },
      });
    napotkane.add(identyfikator);
  });
}

export const schematPytania = z
  .looseObject({
    id: schematId,
    tresc: schematTekstu,
    prezentacja: schematPrezentacji,
    warianty: z.array(schematWariantu),
    sposobyOdpowiedzi: z.array(schematMechanikiOdpowiedzi).min(1),
    wyjasnienie: schematTekstu.optional(),
    rekomendacja: schematRekomendacji.optional(),
    innaOdpowiedz: z
      .looseObject({
        etykieta: schematTekstu,
        analiza: z.discriminatedUnion('tryb', [
          schematAnalizy.extend({ tryb: z.literal('autorska') }),
          z.looseObject({ tryb: z.literal('ai') }),
        ]),
      })
      .optional(),
  })
  .superRefine((pytanie, kontekst) => {
    sprawdzUnikalnosc(
      pytanie.warianty.map((wariant) => wariant.id),
      kontekst,
      ['warianty'],
    );
    sprawdzUnikalnosc(
      pytanie.sposobyOdpowiedzi.map((mechanika) => mechanika.id),
      kontekst,
      ['sposobyOdpowiedzi'],
    );
    const obrazy = [
      ...(pytanie.prezentacja.obrazy ?? []).map((obraz, indeks) => ({
        obraz,
        sciezka: ['prezentacja', 'obrazy', indeks, 'id'],
      })),
      ...pytanie.warianty.flatMap((wariant, indeksWariantu) =>
        (wariant.obrazy ?? []).map((obraz, indeksObrazu) => ({
          obraz,
          sciezka: ['warianty', indeksWariantu, 'obrazy', indeksObrazu, 'id'],
        })),
      ),
    ];
    const identyfikatoryObrazow = new Set<string>();
    obrazy.forEach(({ obraz, sciezka }) => {
      if (identyfikatoryObrazow.has(obraz.id))
        kontekst.addIssue({
          code: 'custom',
          path: sciezka,
          message: `Powtórzone ID obrazu: ${obraz.id}.`,
        });
      identyfikatoryObrazow.add(obraz.id);
    });
    if (pytanie.prezentacja.rodzaj !== 'tekstowa' && obrazy.length === 0)
      kontekst.addIssue({
        code: 'custom',
        path: ['prezentacja'],
        message: 'Prezentacja wizualna lub mieszana wymaga obrazu.',
      });
    if (
      pytanie.rekomendacja &&
      !pytanie.warianty.some(
        (wariant) => wariant.id === pytanie.rekomendacja?.wariantId,
      )
    )
      kontekst.addIssue({
        code: 'custom',
        path: ['rekomendacja', 'wariantId'],
        message: 'Rekomendacja wskazuje nieistniejący wariant.',
      });
    pytanie.sposobyOdpowiedzi.forEach((mechanika, indeks) => {
      const sciezka = ['sposobyOdpowiedzi', indeks];
      if (
        (mechanika.rodzaj === 'pojedynczyWybor' ||
          mechanika.rodzaj === 'kombinacjaWariantow') &&
        pytanie.warianty.length < 2
      )
        kontekst.addIssue({
          code: 'custom',
          path: sciezka,
          message: 'Ta mechanika wymaga co najmniej dwóch wariantów.',
        });
      if (
        (mechanika.rodzaj === 'wielokrotnyWybor' ||
          mechanika.rodzaj === 'ranking') &&
        mechanika.maksimum > pytanie.warianty.length
      )
        kontekst.addIssue({
          code: 'custom',
          path: [...sciezka, 'maksimum'],
          message: 'Maksimum przekracza liczbę wariantów.',
        });
      if (
        mechanika.rodzaj === 'skala' &&
        mechanika.cel === 'warianty' &&
        pytanie.warianty.length === 0
      )
        kontekst.addIssue({
          code: 'custom',
          path: sciezka,
          message: 'Ocena wariantów wymaga wariantów.',
        });
    });
  });

const podstawaWarunku = { pytanieId: schematId, sposobId: schematId };
export const schematWarunku = z.discriminatedUnion('operator', [
  z.looseObject({
    ...podstawaWarunku,
    operator: z.literal('rowne'),
    wartosc: z.union([schematTekstu, z.boolean()]),
  }),
  z.looseObject({
    ...podstawaWarunku,
    operator: z.literal('zawieraWariant'),
    wartosc: schematId,
  }),
  z.looseObject({
    ...podstawaWarunku,
    operator: z.literal('coNajmniej'),
    wartosc: z.number(),
  }),
]);

export const schematOperacji = z.discriminatedUnion('rodzaj', [
  z.looseObject({
    rodzaj: z.literal('dodaj'),
    pytanieId: schematId,
    poPytaniuId: schematId,
  }),
  z.looseObject({ rodzaj: z.literal('pomin'), pytanieId: schematId }),
  z.looseObject({
    rodzaj: z.literal('modyfikuj'),
    pytanieId: schematId,
    zmiany: z
      .strictObject({
        tresc: schematTekstu.optional(),
        wyjasnienie: schematTekstu.optional(),
        rekomendacja: schematRekomendacji.optional(),
      })
      .refine(
        (zmiany) =>
          Object.values(zmiany).some((wartosc) => wartosc !== undefined),
        'Modyfikacja musi zawierać zmianę.',
      ),
  }),
]);

export const schematRegulyAdaptacyjnej = z.looseObject({
  id: schematId,
  powod: schematTekstu,
  warunek: schematWarunku,
  operacja: schematOperacji,
});

export const schematQuizu = z
  .looseObject({
    schemaVersion: z.literal(WERSJA_SCHEMATU),
    id: schematId,
    wersjaQuizu: schematWersjiTresci,
    tytul: schematTekstu,
    opis: schematTekstu.optional(),
    jezyk: schematTekstu,
    liczbaPytan: z.number().int().positive(),
    pytania: z.array(schematPytania).min(1),
    pytaniaDodatkowe: z.array(schematPytania),
    reguly: z.array(schematRegulyAdaptacyjnej),
  })
  .superRefine((quiz, kontekst) => {
    if (quiz.liczbaPytan !== quiz.pytania.length)
      kontekst.addIssue({
        code: 'custom',
        path: ['liczbaPytan'],
        message: 'Deklarowana liczba pytań różni się od faktycznej.',
        params: { kod: 'NIEZGODNA_LICZBA_PYTAN' },
      });
    const wszystkiePytania = [...quiz.pytania, ...quiz.pytaniaDodatkowe];
    const pytaniaPoId = new Map(
      wszystkiePytania.map((pytanie) => [pytanie.id, pytanie]),
    );
    sprawdzUnikalnosc(
      quiz.pytania.map((pytanie) => pytanie.id),
      kontekst,
      ['pytania'],
    );
    sprawdzUnikalnosc(
      quiz.pytaniaDodatkowe.map((pytanie) => pytanie.id),
      kontekst,
      ['pytaniaDodatkowe'],
    );
    quiz.pytaniaDodatkowe.forEach((pytanie, indeks) => {
      if (quiz.pytania.some((bazowe) => bazowe.id === pytanie.id))
        kontekst.addIssue({
          code: 'custom',
          path: ['pytaniaDodatkowe', indeks, 'id'],
          message: 'ID pytania powtarza się między pulami.',
          params: { kod: 'POWTORZONE_ID' },
        });
    });
    sprawdzUnikalnosc(
      quiz.reguly.map((regula) => regula.id),
      kontekst,
      ['reguly'],
    );
    const celeOperacji = new Set<string>();
    const zaleznosci = new Map(
      wszystkiePytania.map((pytanie) => [pytanie.id, new Set<string>()]),
    );
    const kotwice = new Map<string, string>();
    quiz.reguly.forEach((regula) => {
      if (regula.operacja.rodzaj === 'dodaj')
        kotwice.set(regula.operacja.pytanieId, regula.operacja.poPytaniuId);
    });
    function dodajZaleznosc(wczesniejsze: string, pozniejsze: string) {
      zaleznosci.get(wczesniejsze)?.add(pozniejsze);
    }
    quiz.pytania.forEach((pytanie, indeks) => {
      const nastepne = quiz.pytania[indeks + 1];
      if (nastepne) dodajZaleznosc(pytanie.id, nastepne.id);
    });
    quiz.reguly.forEach((regula, indeks) => {
      const sciezka = ['reguly', indeks];
      const zrodlo = pytaniaPoId.get(regula.warunek.pytanieId);
      const cel = pytaniaPoId.get(regula.operacja.pytanieId);
      if (!zrodlo)
        kontekst.addIssue({
          code: 'custom',
          path: [...sciezka, 'warunek', 'pytanieId'],
          message: 'Nieznane pytanie źródłowe.',
        });
      if (!cel)
        kontekst.addIssue({
          code: 'custom',
          path: [...sciezka, 'operacja', 'pytanieId'],
          message: 'Nieznane pytanie docelowe.',
        });
      if (
        quiz.pytaniaDodatkowe.some(
          (pytanie) => pytanie.id === regula.warunek.pytanieId,
        ) &&
        !kotwice.has(regula.warunek.pytanieId)
      )
        kontekst.addIssue({
          code: 'custom',
          path: [...sciezka, 'warunek', 'pytanieId'],
          message: 'Źródłowe pytanie dodatkowe nie ma reguły dodania.',
        });
      if (
        regula.operacja.rodzaj !== 'dodaj' &&
        quiz.pytaniaDodatkowe.some(
          (pytanie) => pytanie.id === regula.operacja.pytanieId,
        ) &&
        !kotwice.has(regula.operacja.pytanieId)
      )
        kontekst.addIssue({
          code: 'custom',
          path: [...sciezka, 'operacja', 'pytanieId'],
          message: 'Docelowe pytanie dodatkowe nie ma reguły dodania.',
        });
      if (celeOperacji.has(regula.operacja.pytanieId))
        kontekst.addIssue({
          code: 'custom',
          path: [...sciezka, 'operacja'],
          message:
            'Wiele operacji na jednym pytaniu jest niejednoznaczne w wersji 1.0.0.',
        });
      celeOperacji.add(regula.operacja.pytanieId);
      const mechanika = zrodlo?.sposobyOdpowiedzi.find(
        (sposob) => sposob.id === regula.warunek.sposobId,
      );
      if (!mechanika)
        kontekst.addIssue({
          code: 'custom',
          path: [...sciezka, 'warunek', 'sposobId'],
          message: 'Nieznana mechanika źródłowej odpowiedzi.',
        });
      else {
        const warunek = regula.warunek;
        const wariantIstnieje = zrodlo?.warianty.some(
          (wariant) => wariant.id === warunek.wartosc,
        );
        const poprawny =
          warunek.operator === 'coNajmniej'
            ? mechanika.rodzaj === 'skala' && mechanika.cel === 'pytanie'
            : warunek.operator === 'zawieraWariant'
              ? ['wielokrotnyWybor', 'ranking', 'kombinacjaWariantow'].includes(
                  mechanika.rodzaj,
                ) && wariantIstnieje
              : (mechanika.rodzaj === 'pojedynczyWybor' && wariantIstnieje) ||
                (['takNie', 'prawdaFalsz'].includes(mechanika.rodzaj) &&
                  typeof warunek.wartosc === 'boolean') ||
                (mechanika.rodzaj === 'otwarta' &&
                  typeof warunek.wartosc === 'string');
        if (!poprawny)
          kontekst.addIssue({
            code: 'custom',
            path: [...sciezka, 'warunek'],
            message: 'Operator lub wartość nie pasują do mechaniki odpowiedzi.',
          });
      }
      if (regula.operacja.rodzaj === 'modyfikuj') {
        const rekomendacja = regula.operacja.zmiany.rekomendacja;
        if (
          rekomendacja &&
          !cel?.warianty.some(
            (wariant) => wariant.id === rekomendacja.wariantId,
          )
        )
          kontekst.addIssue({
            code: 'custom',
            path: [...sciezka, 'operacja', 'zmiany', 'rekomendacja'],
            message: 'Zmieniona rekomendacja wskazuje nieznany wariant.',
          });
      }
      dodajZaleznosc(regula.warunek.pytanieId, regula.operacja.pytanieId);
      if (regula.operacja.rodzaj === 'dodaj') {
        const kotwica = regula.operacja.poPytaniuId;
        if (!pytaniaPoId.has(kotwica))
          kontekst.addIssue({
            code: 'custom',
            path: [...sciezka, 'operacja', 'poPytaniuId'],
            message: 'Nieznane miejsce dodania pytania.',
          });
        if (
          quiz.pytaniaDodatkowe.some((pytanie) => pytanie.id === kotwica) &&
          !kotwice.has(kotwica)
        )
          kontekst.addIssue({
            code: 'custom',
            path: [...sciezka, 'operacja', 'poPytaniuId'],
            message: 'Pytanie miejsca dodania nie ma własnej reguły dodania.',
          });
        if (
          !quiz.pytaniaDodatkowe.some(
            (pytanie) => pytanie.id === regula.operacja.pytanieId,
          )
        )
          kontekst.addIssue({
            code: 'custom',
            path: [...sciezka, 'operacja', 'pytanieId'],
            message: 'Dodawane pytanie musi należeć do puli dodatkowej.',
          });
        dodajZaleznosc(kotwica, regula.operacja.pytanieId);
        if (regula.warunek.pytanieId !== kotwica)
          dodajZaleznosc(regula.warunek.pytanieId, kotwica);
        let korzen = kotwica;
        const odwiedzone = new Set<string>();
        while (kotwice.has(korzen) && !odwiedzone.has(korzen)) {
          odwiedzone.add(korzen);
          korzen = kotwice.get(korzen)!;
        }
        const nastepne =
          quiz.pytania[
            quiz.pytania.findIndex((pytanie) => pytanie.id === korzen) + 1
          ];
        if (quiz.pytania.some((pytanie) => pytanie.id === korzen) && nastepne)
          dodajZaleznosc(regula.operacja.pytanieId, nastepne.id);
      }
    });
    const stopnie = new Map(wszystkiePytania.map((pytanie) => [pytanie.id, 0]));
    for (const nastepniki of zaleznosci.values())
      for (const identyfikator of nastepniki)
        if (stopnie.has(identyfikator))
          stopnie.set(identyfikator, stopnie.get(identyfikator)! + 1);
    const kolejka = [...stopnie]
      .filter(([, stopien]) => stopien === 0)
      .map(([identyfikator]) => identyfikator);
    let przetworzone = 0;
    for (let indeks = 0; indeks < kolejka.length; indeks++) {
      const identyfikator = kolejka[indeks]!;
      przetworzone++;
      for (const nastepnik of zaleznosci.get(identyfikator) ?? []) {
        if (!stopnie.has(nastepnik)) continue;
        const stopien = stopnie.get(nastepnik)! - 1;
        stopnie.set(nastepnik, stopien);
        if (stopien === 0) kolejka.push(nastepnik);
      }
    }
    if (przetworzone !== stopnie.size)
      kontekst.addIssue({
        code: 'custom',
        path: ['reguly'],
        message:
          'Reguły zawierają cykl lub zależność od późniejszej odpowiedzi.',
      });
  });

export type Quiz = z.infer<typeof schematQuizu>;
export type Pytanie = z.infer<typeof schematPytania>;
export type Wariant = z.infer<typeof schematWariantu>;
export type PrezentacjaPytania = z.infer<typeof schematPrezentacji>;
export type MechanikaOdpowiedzi = z.infer<typeof schematMechanikiOdpowiedzi>;
export type Rekomendacja = z.infer<typeof schematRekomendacji>;
export type Konsekwencja = z.infer<typeof schematKonsekwencji>;
export type RegulaAdaptacyjna = z.infer<typeof schematRegulyAdaptacyjnej>;
