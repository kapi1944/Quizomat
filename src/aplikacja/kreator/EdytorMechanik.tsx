import type { MechanikaOdpowiedzi, Pytanie } from '../../domena/quiz';
import { nazwyTypow, nowaMechanika } from './mechaniki';

export function EdytorMechanik({
  pytanie,
  zmien,
}: {
  pytanie: Pytanie;
  zmien: (sposoby: MechanikaOdpowiedzi[]) => void;
}) {
  return (
    <div className="mechaniki-kreatora">
      {pytanie.sposobyOdpowiedzi.map((mechanika, indeks) => {
        const ustaw = (wartosc: MechanikaOdpowiedzi) =>
          zmien(
            pytanie.sposobyOdpowiedzi.map((element) =>
              element.id === mechanika.id ? wartosc : element,
            ),
          );
        const liczba = (
          etykieta: string,
          pole:
            | 'minimum'
            | 'maksimum'
            | 'krok'
            | 'maksymalnaDlugosc'
            | 'minimumElementow',
          wartosc: number,
        ) => (
          <label>
            {etykieta}
            <input
              type="number"
              step="any"
              value={Number.isFinite(wartosc) ? wartosc : ''}
              onChange={(zdarzenie) =>
                ustaw({
                  ...mechanika,
                  [pole]: zdarzenie.target.valueAsNumber,
                } as MechanikaOdpowiedzi)
              }
            />
          </label>
        );
        return (
          <fieldset className="mechanika-kreatora" key={mechanika.id}>
            <legend>
              {pytanie.sposobyOdpowiedzi.length > 1
                ? `Sposób ${indeks + 1}`
                : 'Odpowiedź'}
            </legend>
            <label>
              Sposób odpowiedzi
              <select
                value={mechanika.rodzaj}
                onChange={(zdarzenie) =>
                  ustaw(
                    nowaMechanika(
                      zdarzenie.target.value as MechanikaOdpowiedzi['rodzaj'],
                      pytanie.warianty.length,
                      mechanika.id,
                      mechanika.wymagany,
                    ),
                  )
                }
              >
                {Object.entries(nazwyTypow).map(([wartosc, nazwa]) => (
                  <option key={wartosc} value={wartosc}>
                    {nazwa}
                  </option>
                ))}
              </select>
            </label>
            <label className="pole-wyboru-kreatora">
              <input
                type="checkbox"
                checked={mechanika.wymagany}
                onChange={(zdarzenie) =>
                  ustaw({ ...mechanika, wymagany: zdarzenie.target.checked })
                }
              />
              Wymagana odpowiedź
            </label>
            {mechanika.rodzaj === 'skala' && (
              <label>
                Cel skali
                <select
                  value={mechanika.cel}
                  onChange={(zdarzenie) =>
                    ustaw({
                      ...mechanika,
                      cel: zdarzenie.target.value as 'pytanie' | 'warianty',
                    })
                  }
                >
                  <option value="pytanie">Ocena pytania</option>
                  <option value="warianty">Ocena każdego wariantu</option>
                </select>
              </label>
            )}
            {(mechanika.rodzaj === 'wielokrotnyWybor' ||
              mechanika.rodzaj === 'ranking' ||
              mechanika.rodzaj === 'skala') && (
              <div className="zakres-kreatora">
                {liczba(
                  mechanika.rodzaj === 'skala'
                    ? 'Początek skali'
                    : 'Minimum wyborów',
                  'minimum',
                  mechanika.minimum,
                )}
                {liczba(
                  mechanika.rodzaj === 'skala'
                    ? 'Koniec skali'
                    : 'Maksimum wyborów',
                  'maksimum',
                  mechanika.maksimum,
                )}
                {mechanika.rodzaj === 'skala' &&
                  liczba('Krok skali', 'krok', mechanika.krok)}
              </div>
            )}
            {mechanika.rodzaj === 'otwarta' &&
              liczba(
                'Limit znaków',
                'maksymalnaDlugosc',
                mechanika.maksymalnaDlugosc,
              )}
            {mechanika.rodzaj === 'kombinacjaWariantow' &&
              liczba(
                'Minimum fragmentów',
                'minimumElementow',
                mechanika.minimumElementow,
              )}
            {pytanie.sposobyOdpowiedzi.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  zmien(
                    pytanie.sposobyOdpowiedzi.filter(
                      (element) => element.id !== mechanika.id,
                    ),
                  )
                }
              >
                Usuń sposób {indeks + 1}
              </button>
            )}
          </fieldset>
        );
      })}
      <button
        type="button"
        className="przycisk drugorzedny"
        onClick={() =>
          zmien([
            ...pytanie.sposobyOdpowiedzi,
            nowaMechanika('otwarta', pytanie.warianty.length),
          ])
        }
      >
        + Dodaj sposób odpowiedzi
      </button>
    </div>
  );
}
