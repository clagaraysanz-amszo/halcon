import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useOperatorDay } from '../hooks/useOperatorDay';
import ScreenHeader from '../components/ScreenHeader';

export default function HistorialDia() {
  const { operador } = useAuth();
  const { tramosByN } = useCatalog();
  const day = useOperatorDay(operador.halcon_n);
  const totalMinutos = day.flights.reduce((a, f) => a + f.minutos, 0);

  return (
    <div className="screen">
      <ScreenHeader
        onBack={true}
        title="Historial del Día"
        subtitle={`Halcón ${operador.halcon_n} · ${day.flights.length} vuelos · ${totalMinutos} min`}
      />

      <div className="content content--tight">
        {!day.loading && day.flights.length === 0 && (
          <div className="empty-state">Aún no has registrado vuelos hoy.</div>
        )}
        {day.flights.map((f) => {
          const tramo = tramosByN.get(f.tramo_n);
          const esOtroVuelo = !f.tramo_n;
          const nombre = esOtroVuelo ? f.tipificacion : (tramo?.nombre ?? '—');
          return (
            <div key={f.id} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  flex: 'none',
                  borderRadius: 12,
                  background: esOtroVuelo ? '#F3F0FF' : '#EEF2F8',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: esOtroVuelo ? '#7C3AED' : 'var(--texto-titulo)',
                  fontWeight: 800,
                }}
              >
                {esOtroVuelo ? (
                  <span style={{ fontSize: 20 }}>◎</span>
                ) : (
                  <>
                    <span style={{ fontSize: 8, opacity: 0.7 }}>T</span>
                    <span style={{ fontSize: 16 }}>{f.tramo_n}</span>
                  </>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--texto-titulo)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {nombre}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--texto-secundario)', marginTop: 2 }}>
                  {f.hora_inicio} · {f.altura} · {f.minutos}min{esOtroVuelo && f.ubicacion_manual ? ` · ${f.ubicacion_manual}` : !esOtroVuelo ? ` · ${f.tipificacion}` : ''}
                </div>
                {f.observaciones && (
                  <div style={{ fontSize: 11, color: 'var(--texto-tenue)', marginTop: 3, fontStyle: 'italic' }}>
                    {f.observaciones}
                  </div>
                )}
              </div>
              <span className={`badge ${f.estado === 'Realizado' ? 'badge--done' : 'badge--pend'}`}>
                {f.estado === 'Realizado' ? '✓' : f.estado}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
