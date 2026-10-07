interface WlasciwosciEkranu {
  tytul: string;
  opis: string;
}

export function EkranWPrzygotowaniu({ tytul, opis }: WlasciwosciEkranu) {
  return (
    <section className="panel">
      <p className="nadtytul">W przygotowaniu</p>
      <h1>{tytul}</h1>
      <p>{opis}</p>
      <p className="informacja">
        Ta funkcja nie jest jeszcze dostępna w Etapie 0.
      </p>
    </section>
  );
}
