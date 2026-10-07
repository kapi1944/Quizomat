import { schematSzkicuWlasnejOdpowiedzi } from '../domena/sesja';
import type { SzkicWlasnejOdpowiedzi } from '../domena/sesja';
import { biezacePytanie, zatwierdzDecyzje } from './runtime';
import type { Wynik } from './runtime';
import { aktualizujSesje } from './sesja';
import type { PrzebiegSesji } from './sesja';
import { sprawdzAnalize } from '../ai/analizator';

export function zapiszSzkic(
  stan: PrzebiegSesji,
  dane: unknown,
): Wynik<PrzebiegSesji> {
  const wynik = schematSzkicuWlasnejOdpowiedzi.safeParse(dane);
  const pytanie = biezacePytanie(stan.przebieg);
  if (
    !wynik.success ||
    !pytanie?.innaOdpowiedz ||
    wynik.data.pytanieId !== pytanie.id
  )
    return { stan: 'blad', opis: 'Niepoprawny szkic własnej odpowiedzi.' };
  const szkic =
    wynik.data.stan === 'szkic'
      ? {
          pytanieId: wynik.data.pytanieId,
          stan: 'szkic' as const,
          tekst: wynik.data.tekst,
        }
      : wynik.data;
  const poprzedni = stan.sesja.szkiceWlasnychOdpowiedzi.find(
    (szkic) => szkic.pytanieId === pytanie.id,
  );
  if (
    szkic.stan !== 'szkic' &&
    (szkic.stan === 'oczekujeAnalizy'
      ? !poprzedni || poprzedni.tekst !== szkic.tekst
      : poprzedni?.stan !== 'oczekujeAnalizy' ||
        poprzedni.tekst !== szkic.tekst)
  )
    return { stan: 'blad', opis: 'Analiza nie odpowiada aktualnemu szkicowi.' };
  if (szkic.stan === 'przeanalizowana') {
    try {
      sprawdzAnalize(szkic.analiza, stan.przebieg.quiz);
    } catch {
      return {
        stan: 'blad',
        opis: 'Niepoprawny wynik analizy. Szkic pozostał zapisany.',
      };
    }
  }
  return {
    stan: 'gotowy',
    wartosc: {
      ...stan,
      sesja: {
        ...stan.sesja,
        szkiceWlasnychOdpowiedzi: [
          ...stan.sesja.szkiceWlasnychOdpowiedzi.filter(
            (szkic) => szkic.pytanieId !== pytanie.id,
          ),
          structuredClone(szkic),
        ],
      },
    },
  };
}

export function zatwierdzOdpowiedzWlasna(
  stan: PrzebiegSesji,
  zdarzenie: { id: string; zatwierdzono: string },
): Wynik<PrzebiegSesji> {
  const pytanie = biezacePytanie(stan.przebieg);
  const szkic: SzkicWlasnejOdpowiedzi | undefined =
    stan.sesja.szkiceWlasnychOdpowiedzi.find(
      (szkic) => szkic.pytanieId === pytanie?.id,
    );
  if (!pytanie?.innaOdpowiedz || szkic?.stan !== 'przeanalizowana')
    return {
      stan: 'blad',
      opis: 'Przed zatwierdzeniem wymagana jest analiza aktualnego szkicu.',
    };
  const wynik = aktualizujSesje(
    stan,
    zatwierdzDecyzje(stan.przebieg, {
      ...zdarzenie,
      pytanieId: pytanie.id,
      odpowiedz: {
        rodzaj: 'wlasna',
        tekst: szkic.tekst,
        analiza: szkic.analiza,
      },
      adnotacje: [],
    }),
    zdarzenie.zatwierdzono,
  );
  if (wynik.stan !== 'gotowy') return wynik;
  return {
    stan: 'gotowy',
    wartosc: {
      ...wynik.wartosc,
      sesja: {
        ...wynik.wartosc.sesja,
        szkiceWlasnychOdpowiedzi:
          wynik.wartosc.sesja.szkiceWlasnychOdpowiedzi.filter(
            (szkic) => szkic.pytanieId !== pytanie.id,
          ),
      },
    },
  };
}
