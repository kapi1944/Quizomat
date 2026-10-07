import { StrictMode as TrybScisly } from 'react';
import { createRoot as utworzKorzen } from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';
import { Aplikacja } from './aplikacja/Aplikacja';
import './aplikacja/style.css';

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
