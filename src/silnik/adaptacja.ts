import type { Pytanie, RegulaAdaptacyjna } from '../domena/quiz';
import type { Decyzja, ZmianaAdaptacyjna } from '../domena/sesja';
import type { StanQuizu } from './runtime';

function spelniaWarunek(regula: RegulaAdaptacyjna, decyzja: Decyzja) {
  if (decyzja.odpowiedz.rodzaj !== 'standardowa') return false;
  const warunek = regula.warunek;
  const wartosc = decyzja.odpowiedz.wartosci.find(
    (wartosc) => wartosc.sposobId === warunek.sposobId,
  );
  if (!wartosc) return false;
  if (warunek.operator === 'rowne') {
    const porownywana =
      wartosc.rodzaj === 'pojedynczyWybor'
        ? wartosc.wariantId
        : wartosc.rodzaj === 'otwarta'
          ? wartosc.tekst
          : wartosc.rodzaj === 'takNie' || wartosc.rodzaj === 'prawdaFalsz'
            ? wartosc.wartosc
            : undefined;
    return porownywana === warunek.wartosc;
  }
  if (warunek.operator === 'coNajmniej')
    return (
      wartosc.rodzaj === 'skala' &&
      wartosc.cel === 'pytanie' &&
      wartosc.wartosc >= warunek.wartosc
    );
  return wartosc.rodzaj === 'wielokrotnyWybor' || wartosc.rodzaj === 'ranking'
    ? wartosc.wariantyId.includes(warunek.wartosc)
    : wartosc.rodzaj === 'kombinacjaWariantow' &&
        wartosc.elementy.some(
          (element) => element.wariantId === warunek.wartosc,
        );
}

export function przeliczAdaptacje(stan: StanQuizu): StanQuizu {
  const pytania = structuredClone(stan.quiz.pytania);
  const zmiany: ZmianaAdaptacyjna[] = [];
  const odwiedzone = new Map<string, Pytanie>();
  const wykonane = new Set<string>();
  const ostatnieDodatkowe = new Map<string, string>();
  for (let indeks = 0; indeks < pytania.length; indeks++) {
    const pytanie = pytania[indeks]!;
    odwiedzone.set(pytanie.id, pytanie);
    let wykonano: boolean;
    do {
      wykonano = false;
      for (const regula of stan.quiz.reguly) {
        if (wykonane.has(regula.id)) continue;
        const zrodlo = odwiedzone.get(regula.warunek.pytanieId);
        const decyzja = stan.decyzje.find(
          (decyzja) => decyzja.pytanieId === zrodlo?.id,
        );
        if (!zrodlo || !decyzja || !spelniaWarunek(regula, decyzja)) continue;
        const operacja = regula.operacja;
        const cel = pytania.findIndex(
          (pytanie) => pytanie.id === operacja.pytanieId,
        );
        const podstawa = {
          id: `adaptacja-${regula.id.length}-${regula.id}-${decyzja.id}`,
          kolejnosc: zmiany.length,
          powod: regula.powod,
          regulaId: regula.id,
          regula: structuredClone(regula),
          pytanieDoceloweId: operacja.pytanieId,
          zrodlo: structuredClone({ pytanie: zrodlo, decyzja }),
        };
        if (operacja.rodzaj === 'dodaj') {
          const kotwica =
            ostatnieDodatkowe.get(operacja.poPytaniuId) ?? operacja.poPytaniuId;
          const miejsce = pytania.findIndex(
            (pytanie) => pytanie.id === kotwica,
          );
          const dodatkowe = stan.quiz.pytaniaDodatkowe.find(
            (pytanie) => pytanie.id === operacja.pytanieId,
          );
          if (miejsce < 0 || !dodatkowe) continue;
          const po = structuredClone(dodatkowe);
          pytania.splice(miejsce + 1, 0, po);
          ostatnieDodatkowe.set(operacja.poPytaniuId, po.id);
          zmiany.push({ ...podstawa, rodzaj: 'dodaj', przed: null, po });
        } else {
          if (cel < 0) continue;
          const przed = pytania[cel]!;
          if (operacja.rodzaj === 'pomin') {
            pytania.splice(cel, 1);
            zmiany.push({ ...podstawa, rodzaj: 'pomin', przed, po: null });
          } else {
            const po = structuredClone(przed);
            if (operacja.zmiany.tresc !== undefined)
              po.tresc = operacja.zmiany.tresc;
            if (operacja.zmiany.wyjasnienie !== undefined)
              po.wyjasnienie = operacja.zmiany.wyjasnienie;
            if (operacja.zmiany.rekomendacja !== undefined)
              po.rekomendacja = structuredClone(operacja.zmiany.rekomendacja);
            pytania[cel] = po;
            zmiany.push({ ...podstawa, rodzaj: 'modyfikuj', przed, po });
          }
        }
        wykonane.add(regula.id);
        wykonano = true;
      }
    } while (wykonano);
  }
  const aktywne = new Set(pytania.map((pytanie) => pytanie.id));
  const osierocone = stan.decyzje.filter(
    (decyzja) => !aktywne.has(decyzja.pytanieId),
  );
  if (osierocone.length > 0)
    return przeliczAdaptacje({
      ...stan,
      decyzje: stan.decyzje.filter((decyzja) => aktywne.has(decyzja.pytanieId)),
      historiaDecyzji: [...stan.historiaDecyzji, ...osierocone],
    });
  const biezaceId = stan.pytania[stan.indeksPytania]?.id;
  return {
    ...stan,
    indeksPytania:
      biezaceId === undefined
        ? pytania.length
        : Math.max(
            0,
            pytania.findIndex((pytanie) => pytanie.id === biezaceId),
          ),
    pytania,
    zmianyAdaptacyjne: zmiany,
    decyzje: stan.decyzje.filter((decyzja) => aktywne.has(decyzja.pytanieId)),
    historiaDecyzji: [
      ...stan.historiaDecyzji,
      ...stan.decyzje.filter((decyzja) => !aktywne.has(decyzja.pytanieId)),
    ],
  };
}
