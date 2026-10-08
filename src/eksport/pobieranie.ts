import { generujEksport } from './raport';
import type { FormatEksportu, RaportDecyzji } from './raport';

export function pobierzRaport(raport: RaportDecyzji, format: FormatEksportu) {
  const plik = generujEksport(raport, format);
  const adres = URL.createObjectURL(new Blob([plik.tresc], { type: plik.typ }));
  const odnosnik = document.createElement('a');
  try {
    odnosnik.href = adres;
    odnosnik.download = plik.nazwa;
    document.body.append(odnosnik);
    odnosnik.click();
  } finally {
    odnosnik.remove();
    setTimeout(() => URL.revokeObjectURL(adres), 1000);
  }
}
