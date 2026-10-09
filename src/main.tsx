import { StrictMode as TrybScisly } from 'react';
import { createRoot as utworzKorzen } from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';
import { Aplikacja } from './aplikacja/Aplikacja';
import './aplikacja/style.css';
import { odczytajMotyw, zastosujMotyw } from './dane/ustawienia';

zastosujMotyw(odczytajMotyw());
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    if (document.documentElement.dataset.motyw === 'systemowy') {
      zastosujMotyw('systemowy');
    }
  });

const kontener = document.getElementById('aplikacja');

if (!kontener) {
  throw new Error('Nie znaleziono kontenera aplikacji Quizomat.');
}

utworzKorzen(kontener).render(
  <TrybScisly>
    <Router>
      <Aplikacja />
    </Router>
  </TrybScisly>,
);
