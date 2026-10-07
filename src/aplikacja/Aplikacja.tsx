import {
  Link as Odnosnik,
  NavLink as OdnosnikNawigacji,
  Route as Trasa,
  Routes as Trasy,
} from 'react-router-dom';
import { EkranWPrzygotowaniu } from '../komponenty/EkranWPrzygotowaniu';
import { KomunikatPwa } from '../komponenty/KomunikatPwa';
import { ImportQuizu } from './ImportQuizu';
import { Biblioteka } from './Biblioteka';

export function Aplikacja() {
  return (
    <div className="aplikacja">
      <a
        className="pomin-nawigacje"
        href="#tresc"
        onClick={(zdarzenie) => {
          zdarzenie.preventDefault();
          document.getElementById('tresc')?.focus();
        }}
      >
        Przejdź do treści
      </a>
      <header className="naglowek">
        <Odnosnik
          to="/"
          className="marka"
          aria-label="Quizomat — ekran startowy"
        >
          <img src="/ikona.svg" alt="" width="40" height="40" />
          Quizomat
        </Odnosnik>
        <span className="etykieta">Prywatna przestrzeń decyzji</span>
      </header>
      <nav className="nawigacja" aria-label="Główna nawigacja">
        <OdnosnikNawigacji to="/" end>
          Start
        </OdnosnikNawigacji>
        <OdnosnikNawigacji to="/biblioteka">Biblioteka</OdnosnikNawigacji>
        <OdnosnikNawigacji to="/import">Import</OdnosnikNawigacji>
        <OdnosnikNawigacji to="/ustawienia">Ustawienia</OdnosnikNawigacji>
      </nav>
      <main id="tresc" tabIndex={-1}>
        <Trasy>
          <Trasa
            path="/"
            element={
              <section className="panel start">
                <p className="nadtytul">Od pytania do specyfikacji</p>
                <h1>
                  Twoje decyzje. <br />
                  Spójny projekt.
                </h1>
                <p>
                  Quizomat pomoże porównywać warianty, rozumieć ich konsekwencje
                  i zbierać decyzje w kompletną specyfikację.
                </p>
                <Odnosnik className="przycisk" to="/biblioteka">
                  Przejdź do biblioteki
                </Odnosnik>
                <p className="informacja">
                  Import JSON i lokalna biblioteka są dostępne. Przechodzenie
                  quizów jest w przygotowaniu.
                </p>
              </section>
            }
          />
          <Trasa path="/biblioteka" element={<Biblioteka />} />
          <Trasa path="/import" element={<ImportQuizu />} />
          <Trasa
            path="/ustawienia"
            element={
              <EkranWPrzygotowaniu
                tytul="Ustawienia"
                opis="Tutaj ustawisz między innymi widoczność rekomendacji. Ustawienia są w przygotowaniu."
              />
            }
          />
          <Trasa
            path="*"
            element={
              <section className="panel">
                <h1>Nie znaleziono strony</h1>
                <Odnosnik to="/">Wróć na start</Odnosnik>
              </section>
            }
          />
        </Trasy>
      </main>
      <KomunikatPwa />
      <footer>Quizomat · narzędzie wspomagające decyzje projektowe</footer>
    </div>
  );
}
