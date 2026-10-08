import type { Pytanie, Quiz } from '../domena/quiz';
import type { Decyzja, Odpowiedz, Sesja } from '../domena/sesja';
import { wznowSesje } from '../silnik/sesja';

export function utworzRaport(
  quiz: Quiz,
  sesja: Sesja,
  niekompletnyImport = false,
) {
  const wynik = wznowSesje(quiz, sesja);
  if (wynik.stan !== 'gotowy') throw new Error(wynik.opis);
  const aktualna = wynik.wartosc;
  if (aktualna.sesja.stan !== 'zakonczona')
    throw new Error('Podsumowanie wymaga zakończenia sesji.');
  const specyfikacja = aktualna.przebieg.pytania.flatMap((pytanie) => {
    const decyzja = aktualna.sesja.decyzje.find(
      (decyzja) => decyzja.pytanieId === pytanie.id,
    );
    return decyzja ? [{ pytanie, decyzja }] : [];
  });
  const nierozstrzygniete = aktualna.przebieg.pytania
    .filter(
      (pytanie) => !specyfikacja.some((wpis) => wpis.pytanie.id === pytanie.id),
    )
    .map((pytanie) => ({
      pytanie,
      stan: aktualna.sesja.odlozonePytaniaId.includes(pytanie.id)
        ? ('odlozone' as const)
        : ('bezDecyzji' as const),
      szkic:
        aktualna.sesja.szkiceWlasnychOdpowiedzi.find(
          (szkic) => szkic.pytanieId === pytanie.id,
        ) ?? null,
    }));
  return structuredClone({
    schemaVersion: '1.0.0' as const,
    rodzaj: 'raportDecyzji' as const,
    quiz: {
      id: quiz.id,
      wersjaQuizu: quiz.wersjaQuizu,
      tytul: quiz.tytul,
      jezyk: quiz.jezyk,
      ...(quiz.opis !== undefined ? { opis: quiz.opis } : {}),
    },
    sesja: {
      id: aktualna.sesja.id,
      stan: aktualna.sesja.stan,
      zmieniono: aktualna.sesja.zmieniono,
    },
    niekompletnyImport,
    specyfikacja,
    nierozstrzygniete,
    zmianyAdaptacyjne: aktualna.sesja.zmianyAdaptacyjne,
  });
}

export type RaportDecyzji = ReturnType<typeof utworzRaport>;
export type FormatEksportu = 'md' | 'json' | 'txt';
type PoleRaportu = { etykieta: string; tekst: string };

function nazwaWariantu(pytanie: Pytanie, id: string) {
  return pytanie.warianty.find((wariant) => wariant.id === id)?.etykieta ?? id;
}

export function opiszOdpowiedz(
  pytanie: Pytanie,
  odpowiedz: Odpowiedz,
): PoleRaportu[] {
  if (odpowiedz.rodzaj === 'wlasna') {
    const analiza = odpowiedz.analiza;
    return [
      { etykieta: 'Zatwierdzona odpowiedź własna', tekst: odpowiedz.tekst },
      {
        etykieta: `Zatwierdzona analiza (${analiza.tryb})`,
        tekst: analiza.interpretacja,
      },
      ...(
        [
          'potencjalneSkutki',
          'zalety',
          'wady',
          'niejednoznacznosci',
          'dotknietePytaniaId',
        ] as const
      ).flatMap((pole) =>
        analiza[pole]?.length
          ? [
              {
                etykieta: {
                  potencjalneSkutki: 'Potencjalne skutki analizy',
                  zalety: 'Zalety analizy',
                  wady: 'Wady analizy',
                  niejednoznacznosci: 'Niejednoznaczności analizy',
                  dotknietePytaniaId: 'ID pytań wskazanych w analizie',
                }[pole],
                tekst: analiza[pole].join('\n'),
              },
            ]
          : [],
      ),
    ];
  }
  const nazwa = (id: string) => nazwaWariantu(pytanie, id);
  return odpowiedz.wartosci.map((wartosc) => {
    switch (wartosc.rodzaj) {
      case 'pojedynczyWybor':
        return {
          etykieta: 'Twój pojedynczy wybór',
          tekst: nazwa(wartosc.wariantId),
        };
      case 'wielokrotnyWybor':
        return {
          etykieta: 'Twój wielokrotny wybór',
          tekst: wartosc.wariantyId.length
            ? wartosc.wariantyId.map(nazwa).join('\n')
            : 'Nie wybrano wariantów.',
        };
      case 'takNie':
        return {
          etykieta: 'Twoja odpowiedź TAK / NIE',
          tekst: wartosc.wartosc ? 'TAK' : 'NIE',
        };
      case 'prawdaFalsz':
        return {
          etykieta: 'Twoja odpowiedź PRAWDA / FAŁSZ',
          tekst: wartosc.wartosc ? 'PRAWDA' : 'FAŁSZ',
        };
      case 'otwarta':
        return {
          etykieta: 'Twoja odpowiedź tekstowa / komentarz',
          tekst: wartosc.tekst,
        };
      case 'skala':
        return {
          etykieta: 'Twoje wartości skali',
          tekst:
            wartosc.cel === 'pytanie'
              ? String(wartosc.wartosc)
              : wartosc.oceny
                  .map((ocena) => `${nazwa(ocena.wariantId)}: ${ocena.wartosc}`)
                  .join('\n'),
        };
      case 'ranking':
        return {
          etykieta: 'Twój ranking',
          tekst: wartosc.wariantyId
            .map((id, indeks) => `${indeks + 1}. ${nazwa(id)}`)
            .join('\n'),
        };
      case 'kombinacjaWariantow':
        return {
          etykieta: 'Twoja kombinacja — wybrane fragmenty',
          tekst: wartosc.elementy
            .map(
              (element) =>
                `${nazwa(element.wariantId)}: ${element.fragment}${element.adnotacja ? `\nAdnotacja: ${element.adnotacja}` : ''}`,
            )
            .join('\n'),
        };
    }
  });
}

function opiszRekomendacje(pytanie: Pytanie): PoleRaportu[] {
  return pytanie.rekomendacja
    ? [
        {
          etykieta: 'Rekomendacja autora (nie jest decyzją użytkownika)',
          tekst: `${nazwaWariantu(pytanie, pytanie.rekomendacja.wariantId)}\n${pytanie.rekomendacja.uzasadnienie}`,
        },
      ]
    : [];
}

function opiszDecyzje(pytanie: Pytanie, decyzja: Decyzja): PoleRaportu[] {
  const odpowiedz = decyzja.odpowiedz;
  const przywolane =
    odpowiedz.rodzaj === 'wlasna'
      ? []
      : odpowiedz.wartosci.flatMap((wartosc) => {
          switch (wartosc.rodzaj) {
            case 'pojedynczyWybor':
              return [wartosc.wariantId];
            case 'wielokrotnyWybor':
            case 'ranking':
              return wartosc.wariantyId;
            case 'kombinacjaWariantow':
              return wartosc.elementy.map((element) => element.wariantId);
            case 'skala':
              return wartosc.cel === 'warianty'
                ? wartosc.oceny.map((ocena) => ocena.wariantId)
                : [];
            default:
              return [];
          }
        });
  return [
    ...(pytanie.wyjasnienie
      ? [{ etykieta: 'Wyjaśnienie pytania', tekst: pytanie.wyjasnienie }]
      : []),
    ...opiszOdpowiedz(pytanie, odpowiedz),
    ...pytanie.warianty
      .filter((wariant) => przywolane.includes(wariant.id))
      .flatMap((wariant) => [
        {
          etykieta: 'Wariant przywołany w odpowiedzi — pełna treść autora',
          tekst: wariant.etykieta,
        },
        ...(wariant.opis
          ? [{ etykieta: 'Opis wariantu', tekst: wariant.opis }]
          : []),
        ...(['zalety', 'wady', 'konsekwencje'] as const).flatMap((pole) =>
          wariant[pole]?.length
            ? [
                {
                  etykieta: {
                    zalety: 'Zalety wariantu',
                    wady: 'Wady wariantu',
                    konsekwencje: 'Konsekwencje wariantu',
                  }[pole],
                  tekst: wariant[pole].join('\n'),
                },
              ]
            : [],
        ),
        ...(wariant.wyjasnienie
          ? [{ etykieta: 'Wyjaśnienie wariantu', tekst: wariant.wyjasnienie }]
          : []),
      ]),
    ...(decyzja.notatka !== undefined
      ? [{ etykieta: 'Twój komentarz', tekst: decyzja.notatka }]
      : []),
    ...decyzja.adnotacje.map((adnotacja) => ({
      etykieta: adnotacja.wariantId
        ? `Twoja adnotacja — ${nazwaWariantu(pytanie, adnotacja.wariantId)}`
        : 'Twoja adnotacja',
      tekst: adnotacja.tekst,
    })),
    ...opiszRekomendacje(pytanie),
    { etykieta: 'Zatwierdzono decyzję', tekst: decyzja.zatwierdzono },
  ];
}

export function sekcjeRaportu(
  raport: RaportDecyzji,
): { tytul: string; pola: PoleRaportu[] }[] {
  return [
    {
      tytul: 'Zakres specyfikacji',
      pola: [
        {
          etykieta: 'Zatwierdzone decyzje',
          tekst: String(raport.specyfikacja.length),
        },
        {
          etykieta: 'Nierozstrzygnięte pytania',
          tekst: String(raport.nierozstrzygniete.length),
        },
        {
          etykieta: 'Źródło quizu',
          tekst: raport.niekompletnyImport
            ? 'Import częściowy — niekompletny względem źródła.'
            : 'Zatwierdzona definicja quizu.',
        },
        { etykieta: 'Ostatni zapis sesji', tekst: raport.sesja.zmieniono },
      ],
    },
    ...raport.specyfikacja.map(({ pytanie, decyzja }, indeks) => ({
      tytul: `Decyzja ${indeks + 1}: ${pytanie.tresc}`,
      pola: opiszDecyzje(pytanie, decyzja),
    })),
    ...raport.nierozstrzygniete.map(({ pytanie, stan, szkic }) => ({
      tytul: `Nierozstrzygnięte: ${pytanie.tresc}`,
      pola: [
        {
          etykieta: 'Stan',
          tekst:
            stan === 'odlozone'
              ? 'Odłożone — brak zatwierdzonej decyzji.'
              : 'Brak zatwierdzonej decyzji.',
        },
        ...(szkic
          ? [
              {
                etykieta: 'Niezatwierdzony szkic (nie stanowi specyfikacji)',
                tekst: szkic.tekst,
              },
            ]
          : []),
        ...opiszRekomendacje(pytanie),
      ],
    })),
    ...raport.zmianyAdaptacyjne.map((zmiana) => ({
      tytul: `Zmiana adaptacyjna: ${{ dodaj: 'dodanie', pomin: 'pominięcie', modyfikuj: 'modyfikacja' }[zmiana.rodzaj]}`,
      pola: [
        { etykieta: 'Powód', tekst: zmiana.powod },
        { etykieta: 'Reguła', tekst: zmiana.regulaId },
        { etykieta: 'Pytanie źródłowe', tekst: zmiana.zrodlo.pytanie.tresc },
        ...opiszOdpowiedz(
          zmiana.zrodlo.pytanie,
          zmiana.zrodlo.decyzja.odpowiedz,
        ),
        {
          etykieta: 'Treść przed zmianą',
          tekst: zmiana.przed?.tresc ?? 'Pytania nie było na ścieżce.',
        },
        {
          etykieta: 'Treść po zmianie',
          tekst: zmiana.po?.tresc ?? 'Pytanie pominięto na ścieżce.',
        },
        ...(zmiana.przed?.wyjasnienie
          ? [
              {
                etykieta: 'Wyjaśnienie przed zmianą',
                tekst: zmiana.przed.wyjasnienie,
              },
            ]
          : []),
        ...(zmiana.po?.wyjasnienie
          ? [
              {
                etykieta: 'Wyjaśnienie po zmianie',
                tekst: zmiana.po.wyjasnienie,
              },
            ]
          : []),
        ...(zmiana.przed
          ? opiszRekomendacje(zmiana.przed).map((pole) => ({
              ...pole,
              etykieta: 'Rekomendacja autora przed zmianą',
            }))
          : []),
        ...(zmiana.po
          ? opiszRekomendacje(zmiana.po).map((pole) => ({
              ...pole,
              etykieta: 'Rekomendacja autora po zmianie',
            }))
          : []),
      ],
    })),
  ];
}

export function generujEksport(raport: RaportDecyzji, format: FormatEksportu) {
  const nazwa = `quizomat-${raport.sesja.id.slice(0, 80)}.${format}`;
  if (format === 'json')
    return {
      nazwa,
      typ: 'application/json;charset=utf-8',
      tresc: JSON.stringify(raport, null, 2) + '\n',
    };
  const zabezpiecz = (tekst: string) =>
    format === 'md'
      ? tekst
          .replace(/([\\`*_{}[\]<>()#+.!|~>-])/g, '\\$1')
          .replace(/\r\n|\r|\n/g, '  \n')
      : tekst;
  const naglowek = (tekst: string, poziom: number) =>
    `${format === 'md' ? '#'.repeat(poziom) + ' ' : ''}${zabezpiecz(tekst)}`;
  const tresc =
    [
      naglowek(`Specyfikacja decyzji: ${raport.quiz.tytul}`, 1),
      ...sekcjeRaportu(raport).map((sekcja) =>
        [
          naglowek(sekcja.tytul, 2),
          ...sekcja.pola.map(
            (pole) =>
              `${format === 'md' ? `**${zabezpiecz(pole.etykieta)}:**` : pole.etykieta + ':'}\n${zabezpiecz(pole.tekst)}`,
          ),
        ].join('\n\n'),
      ),
    ].join('\n\n') + '\n';
  return {
    nazwa,
    typ: `${format === 'md' ? 'text/markdown' : 'text/plain'};charset=utf-8`,
    tresc,
  };
}
