import { useState as stan } from 'react';
import {
  odczytajRekomendacje,
  zapiszRekomendacje,
  odczytajMotyw,
  zapiszMotyw,
  type Motyw,
} from '../dane/ustawienia';

const motywy: { wartosc: Motyw; etykieta: string; sciezka: string }[] = [
  {
    wartosc: 'jasny',
    etykieta: 'Jasny',
    sciezka:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  },
  {
    wartosc: 'kolorowy',
    etykieta: 'Kolorowy',
    sciezka: 'M20 3C9 2 3 7 5 14c2 7 15 6 15-11Z M4 21 16 9 M9 16v-5 M9 16h5',
  },
  {
    wartosc: 'ciemny',
    etykieta: 'Ciemny',
    sciezka: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
  },
  {
    wartosc: 'systemowy',
    etykieta: 'Systemowy',
    sciezka: 'M3 4h18v13H3Z M8 21h8 M12 17v4',
  },
];

export function Ustawienia() {
  const [pokazuj, ustawPokazuj] = stan(odczytajRekomendacje);
  const [blad, ustawBlad] = stan('');
  const [motyw, ustawMotyw] = stan(odczytajMotyw);
  const [bladMotywu, ustawBladMotywu] = stan('');
  return (
    <section className="panel">
      <h1>Ustawienia</h1>
      <fieldset className="ustawienie-motywu">
        <legend>Motyw wyglądu</legend>
        <div className="przelacznik-motywu">
          <span
            className="suwak-motywu"
            aria-hidden="true"
            style={{
              transform: `translateX(${motywy.findIndex((opcja) => opcja.wartosc === motyw) * 100}%)`,
            }}
          />
          {motywy.map((opcja) => (
            <label className="opcja-motywu" key={opcja.wartosc}>
              <input
                className="tylko-czytnik"
                type="radio"
                name="motyw"
                value={opcja.wartosc}
                checked={motyw === opcja.wartosc}
                onChange={() => {
                  try {
                    zapiszMotyw(opcja.wartosc);
                    ustawMotyw(opcja.wartosc);
                    ustawBladMotywu('');
                  } catch {
                    ustawBladMotywu(
                      'Nie zapisano motywu lokalnie. Spróbuj ponownie.',
                    );
                  }
                }}
              />
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={opcja.sciezka} />
              </svg>
              <span>{opcja.etykieta}</span>
            </label>
          ))}
        </div>
        {bladMotywu && <p role="alert">{bladMotywu}</p>}
      </fieldset>
      <label className="ustawienie-rekomendacji">
        <input
          type="checkbox"
          checked={pokazuj}
          onChange={(zdarzenie) => {
            const wartosc = zdarzenie.target.checked;
            try {
              zapiszRekomendacje(wartosc);
              ustawPokazuj(wartosc);
              ustawBlad('');
            } catch {
              ustawBlad('Nie zapisano ustawienia lokalnie. Spróbuj ponownie.');
            }
          }}
        />
        Pokazuj rekomendacje
      </label>
      {blad && <p role="alert">{blad}</p>}
    </section>
  );
}
