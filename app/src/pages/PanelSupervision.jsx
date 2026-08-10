import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useSupervisorDay } from '../hooks/useSupervisorDay';
import { TURNOS } from '../lib/turnos';
import { googleMapsUrl } from '../lib/geo';

const TURNO_OPTS = ['A', 'B', 'N'];

export default function PanelSupervision() {
  const { operador } = useAuth();
  const { tramosByN, operadoresByHalcon } = useCatalog();
  const day = useSupervisorDay();
  const navigate = useNavigate();

  const porTurno = useMemo(() => {
    const groups = { A: [], B: [], N: [] };
    day.pdoRows.forEach((r) => groups[r.turno]?.push(r));
    return TURNO_OPTS.map((turno) => {
      const rows = groups[turno];
      const porOperador = new Map();
      rows.forEach((r) => {
        if (!porOperador.has(r.halcon_n)) porOperador.set(r.halcon_n, []);
        porOperador.get(r.halcon_n).push(r);
      });
      const operadoresTurno = [...porOperador.entries()].map(([halconN, entries]) => {
        const sorted = [...entries].sort((a, b) => a.hora.localeCompare(b.hora));
        const done = sorted.filter((e) => e.estado === 'Realizado').length;
        return { halconN, nombre: operadoresByHalcon.get(halconN)?.nombre ?? halconN, entries: sorted, done, total: sorted.length };
      });
      return { turno, operadoresTurno };
    }).filter((t) => t.operadoresTurno.length > 0);
  }, [day.pdoRows, operadoresByHalcon]);

  const opStats = useMemo(() => {
    const enTurno = new Set(day.pdoRows.map((r) => r.halcon_n));
    const counts = new Map();
    enTurno.forEach((hn) => counts.set(hn, 0));
    day.flights.forEach((f) => {
      if (counts.has(f.halcon_n)) counts.set(f.halcon_n, counts.get(f.halcon_n) + 1);
    });
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()]
      .map(([halconN, count]) => ({ halconN, count, pct: Math.round((count / max) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [day.pdoRows, day.flights]);

  const sectorStats = useMemo(() => {
    const counts = new Map();
    day.flights
      .filter((f) => f.estado === 'Realizado')
      .forEach((f) => {
        const sector = tramosByN.get(f.tramo_n)?.sector ?? '—';
        counts.set(sector, (counts.get(sector) ?? 0) + 1);
      });
    return [...counts.entries()].map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count);
  }, [day.flights, tramosByN]);

  const recentFlights = day.flights.slice(0, 6);
  const totalHoras = (day.totalMinutos / 60).toFixed(1);
  const ringPct = day.pdoTotal ? day.pdoDone / day.pdoTotal : 0;
  const ringOffset = (251.3 * (1 - ringPct)).toFixed(1);

  return (
    <div className="screen">
      <div className="header header--supervisor">
        <div className="header-row">
          <button className="back-btn" onClick={() => navigate('/inicio')} aria-label="Volver">
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#EE6B1E', fontWeight: 700, letterSpacing: 1.5 }}>PANEL DE SUPERVISIÓN</div>
            <div className="header-title">Operación en tiempo real</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#3FD07A', flex: 'none' }}>
            <span className="status-dot" style={{ background: '#3FD07A', boxShadow: '0 0 0 3px rgba(63,208,122,.2)' }} />
            EN VIVO
          </div>
        </div>
        <div style={{ marginTop: 14, width: '100%', background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 13, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--naranjo)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>
            {operador.nombre.split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Supervisor a cargo · {operador.halcon_n}</div>
            <div style={{ fontSize: 14.5, color: '#fff', fontWeight: 700 }}>{operador.nombre}</div>
          </div>
        </div>
      </div>

      <div className="content">
        <button
          onClick={() => navigate('/supervisor/pdo')}
          className="card"
          style={{ width: '100%', padding: '14px 15px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, background: 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            📋
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)' }}>PDO del día</div>
            <div style={{ fontSize: 11.5, color: day.pdoTotal ? 'var(--verde-ok)' : 'var(--texto-tenue)', fontWeight: 600, marginTop: 1 }}>
              {day.pdoTotal ? `✓ Cargado · ${day.pdoTotal} sobrevuelos` : 'Sin PDO cargado hoy'}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--naranjo)' }}>{day.pdoTotal ? 'Actualizar ›' : 'Cargar ›'}</span>
        </button>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 13 }}>Cumplimiento por funcionario en turno</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {porTurno.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)' }}>Nadie en turno hoy.</div>}
            {porTurno.map(({ turno, operadoresTurno }) =>
              operadoresTurno.map((op) => (
                <div key={`${turno}-${op.halconN}`} style={{ border: '1px solid var(--fondo-app)', borderRadius: 13, overflow: 'hidden' }}>
                  <div style={{ background: '#F7F9FC', padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--fondo-app)' }}>
                    <div style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                      {turno}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--texto-titulo)' }}>Halcón {op.halconN} · {op.nombre}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--texto-tenue)', fontWeight: 600 }}>{TURNOS[turno].label} · {TURNOS[turno].horas}</div>
                    </div>
                    <span className={`badge ${op.done === op.total ? 'badge--done' : 'badge--pend'}`}>{op.done}/{op.total}</span>
                  </div>
                  <div style={{ padding: '6px 13px 9px', display: 'flex', flexDirection: 'column' }}>
                    {op.entries.map((e) => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
                        <span style={{ width: 16, flex: 'none', textAlign: 'center', fontSize: 13, fontWeight: 800, color: e.estado === 'Realizado' ? 'var(--verde-ok)' : 'var(--texto-tenue)' }}>
                          {e.estado === 'Realizado' ? '✓' : '○'}
                        </span>
                        <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: 'var(--texto-tenue)', width: 50 }}>{e.hora}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color: 'var(--texto-titulo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Tramo {e.tramo_n} · {tramosByN.get(e.tramo_n)?.nombre ?? '—'}
                        </span>
                        <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, color: e.estado === 'Realizado' ? 'var(--verde-ok)' : 'var(--ambar-texto)' }}>{e.estado}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ padding: '14px 15px' }}>
            <div className="kpi-value" style={{ fontSize: 27 }}>{day.flights.length}</div>
            <div className="kpi-label">Vuelos del día</div>
          </div>
          <div className="card" style={{ padding: '14px 15px' }}>
            <div className="kpi-value kpi-value--accent" style={{ fontSize: 27 }}>{totalHoras}h</div>
            <div className="kpi-label">Horas de vuelo</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="90" height="90" viewBox="0 0 100 100" style={{ flex: 'none' }}>
            <circle cx="50" cy="50" r="40" fill="none" stroke="#EEF2F8" strokeWidth="13" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="var(--naranjo)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray="251.3"
              strokeDashoffset={ringOffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset .8s ease' }}
            />
            <text x="50" y="47" textAnchor="middle" fontSize="24" fontWeight="800" fill="#16233F">{day.pdoDone}</text>
            <text x="50" y="64" textAnchor="middle" fontSize="10" fontWeight="600" fill="#8B93A1">de {day.pdoTotal}</text>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)' }}>Avance del PDO del día</div>
            <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 600, marginBottom: 10 }}>Sobrevuelos programados hoy</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--naranjo)' }} />
              <span style={{ fontSize: 12.5, color: 'var(--texto-secundario)', fontWeight: 600 }}>Realizados</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: 'var(--texto-titulo)' }}>{day.pdoDone}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: '#D5DCE5' }} />
              <span style={{ fontSize: 12.5, color: 'var(--texto-secundario)', fontWeight: 600 }}>Pendientes</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: 'var(--texto-titulo)' }}>{day.pdoPend}</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 3 }}>Vuelos por operador</div>
          <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 600, marginBottom: 14 }}>Solo funcionarios en turno según PDO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {opStats.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)' }}>Sin datos.</div>}
            {opStats.map((o) => (
              <div key={o.halconN} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--texto-titulo)', width: 64, flex: 'none' }}>Halcón {o.halconN}</span>
                <div style={{ flex: 1, height: 22, background: '#F1F3F7', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${o.pct}%`, background: 'linear-gradient(90deg,#F07D2E,#EE6B1E)', borderRadius: 7, transition: 'width .8s ease' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--texto-titulo)', width: 22, textAlign: 'right', flex: 'none' }}>{o.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 12 }}>Tramos por sector</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sectorStats.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)' }}>Aún no hay tramos realizados hoy.</div>}
            {sectorStats.map((s) => (
              <div key={s.sector} style={{ border: '1px solid var(--borde-1)', borderRadius: 11, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--azul)' }} />
                <span style={{ fontSize: 12.5, color: 'var(--texto-titulo)', fontWeight: 600 }}>{s.sector}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--naranjo)' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 12 }}>Mapa de tramos ejecutados</div>
          <div
            style={{
              height: 150,
              borderRadius: 12,
              background: 'repeating-linear-gradient(45deg,#EEF2F8,#EEF2F8 12px,#E6EBF3 12px,#E6EBF3 24px)',
              border: '1px dashed var(--texto-placeholder)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              color: 'var(--texto-tenue)',
            }}
          >
            <span style={{ fontSize: 30 }}>🗺</span>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Vista de mapa en desarrollo</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--texto-secundario)', marginTop: 10, textAlign: 'center' }}>
            Mientras tanto, abre la ubicación de cada vuelo con el enlace <span style={{ fontWeight: 700, color: 'var(--azul)' }}>📍 Mapa</span> en “Últimos vuelos”.
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 12 }}>Últimos vuelos</div>
          {recentFlights.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)', padding: '6px 0' }}>Aún no hay vuelos registrados hoy.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {recentFlights.map((f) => {
              const tramo = tramosByN.get(f.tramo_n);
              // GPS capturado al confirmar el vuelo; si no hubo, respaldo a la
              // coordenada maestra del tramo (README §6.10).
              const lat = f.latitud ?? tramo?.latitud;
              const lng = f.longitud ?? tramo?.longitud;
              const mapsUrl = googleMapsUrl(lat, lng);
              const gpsPropio = f.latitud != null && f.longitud != null;
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 11, paddingBottom: 9, borderBottom: '1px solid #F1F3F7' }}>
                  <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                    {f.tramo_n}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--texto-titulo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tramo?.nombre ?? '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--texto-secundario)', marginTop: 1 }}>
                      Halcón {f.halcon_n} · {f.hora_inicio}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flex: 'none' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--verde-ok)' }}>{f.minutos}min</span>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={gpsPropio ? 'Ubicación GPS del vuelo' : 'Ubicación del tramo (sin GPS del vuelo)'}
                        style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--azul)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        📍 Mapa{gpsPropio ? '' : '*'}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {recentFlights.some((f) => (f.latitud == null || f.longitud == null) && tramosByN.get(f.tramo_n)) && (
            <div style={{ fontSize: 10, color: 'var(--texto-tenue)', marginTop: 9 }}>
              * Ubicación aproximada del tramo (el vuelo no registró GPS propio).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
