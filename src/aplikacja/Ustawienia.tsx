import { useState as stan } from 'react';
import { odczytajRekomendacje, zapiszRekomendacje } from '../dane/ustawienia';

export function Ustawienia() {
  const [pokazuj, ustawPokazuj] = stan(odczytajRekomendacje);
  const [blad, ustawBlad] = stan('');
  return (
    <section className="panel">
      <h1>Ustawienia</h1>
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
