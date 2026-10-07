import { useRegisterSW as uzyjRejestracjiPwa } from 'virtual:pwa-register/react';

export function KomunikatPwa() {
  const {
    needRefresh: [wymagaOdswiezenia, ustawWymagaOdswiezenia],
    updateServiceWorker: zaktualizujAplikacje,
  } = uzyjRejestracjiPwa({
    onRegisterError: (blad: unknown) =>
      console.error('Nie udało się uruchomić obsługi offline Quizomatu.', blad),
  });

  if (!wymagaOdswiezenia) return null;

  return (
    <aside className="aktualizacja panel" aria-label="Aktualizacja aplikacji">
      <p role="status">Dostępna jest nowa wersja Quizomatu.</p>
      <button
        className="przycisk"
        onClick={() => void zaktualizujAplikacje(true)}
      >
        Zaktualizuj
      </button>
      <button
        className="przycisk drugorzedny"
        onClick={() => ustawWymagaOdswiezenia(false)}
      >
        Później
      </button>
    </aside>
  );
}
