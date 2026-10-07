import type { Pytanie, Quiz, RegulaAdaptacyjna } from '../../src/domena/quiz';
import type { Decyzja, Sesja, ZmianaAdaptacyjna } from '../../src/domena/sesja';

export const quizTekstowy = {
  schemaVersion: '1.0.0',
  id: 'organizacja-pracy',
  wersjaQuizu: '1.0.0',
  tytul: 'Wybierz sposób pracy',
  jezyk: 'pl',
  liczbaPytan: 1,
  pytania: [
    {
      id: 'podzial',
      tresc: 'Jaki podział wybierasz?',
      prezentacja: { rodzaj: 'tekstowa' },
      warianty: [
        {
          id: 'prosty',
          etykieta: 'Prosty',
          zalety: ['Szybkie rozpoczęcie'],
          wady: ['Mniej szczegółów'],
          konsekwencje: ['Łatwiejsze przygotowanie'],
          wyjasnienie: 'Kilka kategorii.',
        },
        { id: 'szczegolowy', etykieta: 'Szczegółowy' },
      ],
      sposobyOdpowiedzi: [
        { id: 'wybor', rodzaj: 'pojedynczyWybor', wymagany: true },
      ],
      rekomendacja: {
        wariantId: 'prosty',
        uzasadnienie: 'Ułatwia rozpoczęcie.',
      },
      innaOdpowiedz: { etykieta: 'Inne', analiza: { tryb: 'ai' } },
    },
  ],
  pytaniaDodatkowe: [],
  reguly: [],
} satisfies Quiz & { pytania: [Pytanie] };

const obraz = {
  id: 'szkic-a',
  opisAlternatywny: 'Układ z dwiema sekcjami.',
  dane: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5V8AAAAASUVORK5CYII=',
};

export const pytanieWizualne = {
  id: 'uklad',
  tresc: 'Który układ wybierasz?',
  prezentacja: { rodzaj: 'wizualna' },
  warianty: [
    { id: 'a', etykieta: 'Układ A', obrazy: [obraz] },
    {
      id: 'c',
      etykieta: 'Układ C',
      obrazy: [
        {
          ...obraz,
          id: 'szkic-c',
          opisAlternatywny: 'Alternatywny układ sekcji.',
        },
      ],
    },
  ],
  sposobyOdpowiedzi: [
    { id: 'wybor', rodzaj: 'pojedynczyWybor', wymagany: true },
  ],
} satisfies Pytanie;

export const pytanieKompozycyjne = {
  ...pytanieWizualne,
  sposobyOdpowiedzi: [
    {
      id: 'wybor',
      rodzaj: 'wielokrotnyWybor',
      wymagany: true,
      minimum: 1,
      maksimum: 2,
    },
    {
      id: 'ocena',
      rodzaj: 'skala',
      wymagany: true,
      minimum: 1,
      maksimum: 5,
      krok: 1,
      cel: 'warianty',
    },
    {
      id: 'komentarz',
      rodzaj: 'otwarta',
      wymagany: false,
      maksymalnaDlugosc: 2000,
    },
    {
      id: 'polaczenie',
      rodzaj: 'kombinacjaWariantow',
      wymagany: false,
      minimumElementow: 1,
    },
  ],
} satisfies Pytanie;

export const decyzjaKompozycyjna = {
  id: 'decyzja-uklad',
  pytanieId: 'uklad',
  zatwierdzono: '2026-10-07T10:05:00Z',
  odpowiedz: {
    rodzaj: 'standardowa',
    wartosci: [
      { sposobId: 'wybor', rodzaj: 'wielokrotnyWybor', wariantyId: ['a', 'c'] },
      {
        sposobId: 'ocena',
        rodzaj: 'skala',
        cel: 'warianty',
        oceny: [
          { wariantId: 'a', wartosc: 4 },
          { wariantId: 'c', wartosc: 5 },
        ],
      },
      {
        sposobId: 'komentarz',
        rodzaj: 'otwarta',
        tekst: 'Łączę dwa rozwiązania.',
      },
      {
        sposobId: 'polaczenie',
        rodzaj: 'kombinacjaWariantow',
        elementy: [
          { wariantId: 'a', fragment: 'układ' },
          {
            wariantId: 'c',
            fragment: 'kolorystyka',
            adnotacja: 'Jaśniejszy akcent.',
          },
        ],
      },
    ],
  },
  notatka: 'Porównać po przygotowaniu prototypu.',
  adnotacje: [
    {
      id: 'uwaga-c',
      pytanieId: 'uklad',
      wariantId: 'c',
      tekst: 'Podoba mi się kolorystyka.',
    },
  ],
} satisfies Decyzja;

export const pytanieDodatkowe = {
  id: 'nazwy',
  tresc: 'Jak nazwiesz kategorie?',
  prezentacja: { rodzaj: 'tekstowa' },
  warianty: [],
  sposobyOdpowiedzi: [
    { id: 'tekst', rodzaj: 'otwarta', wymagany: true, maksymalnaDlugosc: 1000 },
  ],
} satisfies Pytanie;

export const quizAdaptacyjny = {
  ...quizTekstowy,
  pytaniaDodatkowe: [pytanieDodatkowe],
  reguly: [
    {
      id: 'doprecyzowanie',
      powod: 'Szczegółowy podział wymaga nazw.',
      warunek: {
        pytanieId: 'podzial',
        sposobId: 'wybor',
        operator: 'rowne',
        wartosc: 'szczegolowy',
      },
      operacja: { rodzaj: 'dodaj', pytanieId: 'nazwy', poPytaniuId: 'podzial' },
    },
  ],
} satisfies Quiz & { reguly: [RegulaAdaptacyjna] };

export const zmianaAdaptacyjna = {
  id: 'zmiana-1',
  kolejnosc: 0,
  rodzaj: 'dodaj',
  powod: quizAdaptacyjny.reguly[0].powod,
  regulaId: 'doprecyzowanie',
  regula: quizAdaptacyjny.reguly[0],
  pytanieDoceloweId: 'nazwy',
  zrodlo: {
    pytanie: quizTekstowy.pytania[0],
    decyzja: {
      id: 'decyzja-podzial',
      pytanieId: 'podzial',
      zatwierdzono: '2026-10-07T10:05:00Z',
      adnotacje: [],
      odpowiedz: {
        rodzaj: 'standardowa',
        wartosci: [
          {
            sposobId: 'wybor',
            rodzaj: 'pojedynczyWybor',
            wariantId: 'szczegolowy',
          },
        ],
      },
    },
  },
  przed: null,
  po: pytanieDodatkowe,
} satisfies ZmianaAdaptacyjna;

export const sesjaPrzykladowa = {
  schemaVersion: '1.0.0',
  id: 'sesja-1',
  quizId: quizTekstowy.id,
  wersjaQuizu: '1.0.0',
  utworzono: '2026-10-07T10:00:00Z',
  zmieniono: '2026-10-07T10:05:00Z',
  stan: 'wTrakcie',
  biezacePytanieId: 'nazwy',
  decyzje: [zmianaAdaptacyjna.zrodlo.decyzja],
  historiaDecyzji: [],
  odlozonePytaniaId: [],
  szkiceWlasnychOdpowiedzi: [],
  zmianyAdaptacyjne: [zmianaAdaptacyjna],
  historiaZmianAdaptacyjnych: [],
} satisfies Sesja;
