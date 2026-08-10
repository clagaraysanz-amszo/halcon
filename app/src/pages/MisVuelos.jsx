import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useRegistro } from '../context/RegistroContext';
import { useOperatorDay } from '../hooks/useOperatorDay';
import { TURNOS } from '../lib/turnos';
import ScreenHeader from '../components/ScreenHeader';

export default function MisVuelos() {
  const { operador } = useAuth();
  const { tramosByN } = useCatalog();
  const { startRegistro } = useRegistro();
  const day = useOperatorDay(operador.halcon_n);
  const navigate = useNavigate();
  const turnoInfo = day.turno ? TURNOS[day.turno] : null;

  function realizarVuelo(pdoRow) {
    const tramo = tramosByN.get(pdoRow.tramo_n);
    startRegistro(tramo, pdoRow);
    navigate('/registro');
  }

  return (
    <div className="screen">
      <ScreenHeader
        onBack={true}
        title="Vuelos Asignados"
        subtitle={turnoInfo ? `PDO · Turno ${day.turno} · ${turnoInfo.label} · ${turnoInfo.horas}` : 'PDO de hoy'}
      >
        <div className="header-stats">
          <div className="header-stat">
            <div className="header-stat-value">{day.pdoPend}</div>
            <div className="header-stat-label">Pendientes</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-value" style={{ color: '#3FD07A' }}>
              {day.pdoDone}
            </div>
            <div className="header-stat-label">Realizados</div>
          </div>
        </div>
      </ScreenHeader>

      <div className="content content--tight">
        <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 700, letterSpacing: 0.5, margin: '2px 2px 0' }}>
          CRONOGRAMA DE SOBREVUELOS
        </div>

        {day.pdoRows.map((row) => {
          const tramo = tramosByN.get(row.tramo_n);
          const done = row.estado === 'Realizado';
          return (
            <div key={row.id} className="list-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, flex: 'none', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--texto-tenue)', fontWeight: 700 }}>HORARIO</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--texto-titulo)', lineHeight: 1.15 }}>
                    {row.hora}
                  </div>
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--fondo-app)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--texto-titulo)',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Tramo {row.tramo_n} · {tramo?.nombre ?? '—'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--texto-secundario)', marginTop: 2 }}>
                    {tramo?.sector} · Cuad. {tramo?.cuadrante}
                  </div>
                </div>
                <span className={`badge ${done ? 'badge--done' : 'badge--pend'}`}>{row.estado}</span>
              </div>
              {!done && (
                <button
                  onClick={() => realizarVuelo(row)}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 11, height: 44, fontSize: 13.5 }}
                >
                  Realizar vuelo →
                </button>
              )}
            </div>
          );
        })}

        {!day.loading && day.pdoRows.length > 0 && day.pdoPend === 0 && (
          <div
            className="card"
            style={{ background: 'var(--verde-fondo-2)', borderColor: 'var(--verde-borde)', padding: 16, textAlign: 'center', color: 'var(--verde-ok)', fontSize: 13.5, fontWeight: 700 }}
          >
            ✓ Todos los sobrevuelos del turno completados
          </div>
        )}

        {!day.loading && day.pdoRows.length === 0 && (
          <div className="empty-state">No tienes sobrevuelos asignados hoy.</div>
        )}
      </div>
    </div>
  );
}
