import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useSupervisorDay } from '../hooks/useSupervisorDay';
import { TURNOS, compararHoraTurno, fechaOperativaHoy, toISODate } from '../lib/turnos';
import { googleMapsUrl } from '../lib/geo';
import { descargarBitacora } from '../lib/exportBitacora';

const TURNO_OPTS = ['A', 'B', 'N'];
const DIAS_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function parseFecha(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFechaLabel(str) {
  const d = parseFecha(str);
  return `${DIAS_SEM[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

function addDaysStr(fechaStr, days) {
  const d = parseFecha(fechaStr);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export default function PanelSupervision() {
  const { operador } = useAuth();
  const { tramosByN, operadoresByHalcon } = useCatalog();
  const navigate = useNavigate();
  const hoy = fechaOperativaHoy();
  const [fecha, setFecha] = useState(hoy);
  const esHoy = fecha === hoy;
  const day = useSupervisorDay(fecha);

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
        const sorted = [...entries].sort((a, b) => compararHoraTurno(a.hora, b.hora, turno));
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

  const noRealizados = useMemo(() => {
    return day.pdoRows.filter((r) => r.estado !== 'Realizado');
  }, [day.pdoRows]);

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
            <div className="header-title">{esHoy ? 'Operación en tiempo real' : 'Revisión histórica'}</div>
          </div>
          {esHoy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#3FD07A', flex: 'none' }}>
              <span className="status-dot" style={{ background: '#3FD07A', boxShadow: '0 0 0 3px rgba(63,208,122,.2)' }} />
              EN VIVO
            </div>
          )}
        </div>

        {/* Navegación por fecha */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <button
            onClick={() => setFecha(addDaysStr(fecha, -1))}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ‹
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, color: '#fff', fontWeight: 700 }}>{formatFechaLabel(fecha)}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>{fecha}</div>
          </div>
          <button
            onClick={() => setFecha(addDaysStr(fecha, 1))}
            disabled={fecha >= hoy}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: fecha >= hoy ? 'rgba(255,255,255,.2)' : '#fff', fontSize: 18, fontWeight: 700, cursor: fecha >= hoy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ›
          </button>
        </div>
        {!esHoy && (
          <button
            onClick={() => setFecha(hoy)}
            style={{ marginTop: 6, width: '100%', padding: '7px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
          >
            Volver a hoy
          </button>
        )}

        <div style={{ marginTop: 10, width: '100%', background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 13, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
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
        {esHoy && (
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
        )}

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 13 }}>
            Cumplimiento por funcionario {esHoy ? 'en turno' : `· ${formatFechaLabel(fecha)}`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {porTurno.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)' }}>{esHoy ? 'Nadie en turno hoy.' : 'Sin PDO cargado para esta fecha.'}</div>}
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
            <div className="kpi-label">Vuelos {esHoy ? 'del día' : ''}</div>
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
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)' }}>Avance del PDO</div>
            <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 600, marginBottom: 10 }}>Sobrevuelos programados</div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)' }}>Vuelos no realizados</div>
            {noRealizados.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#E53E3E', padding: '3px 9px', borderRadius: 12 }}>
                {noRealizados.length}
              </span>
            )}
          </div>
          {noRealizados.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--verde-ok)', fontWeight: 600, padding: '8px 0' }}>
              {day.pdoTotal > 0 ? '✓ Todos los sobrevuelos fueron realizados' : (esHoy ? 'Sin PDO cargado.' : 'Sin PDO para esta fecha.')}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {noRealizados.map((r) => {
              const tramo = tramosByN.get(r.tramo_n);
              const op = operadoresByHalcon.get(r.halcon_n);
              return (
                <div key={r.id} style={{ border: '1px solid #FED7D7', borderRadius: 11, padding: '10px 12px', background: '#FFF5F5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 30, height: 30, flex: 'none', borderRadius: 8, background: '#E53E3E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                      {r.turno}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--texto-titulo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Halcón {r.halcon_n} · {op?.nombre ?? '—'}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--texto-secundario)' }}>
                        {r.hora} · Tramo {r.tramo_n} · {tramo?.nombre ?? '—'}
                      </div>
                    </div>
                    <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, color: r.estado === 'No realizado' ? '#E53E3E' : 'var(--ambar-texto)' }}>
                      {r.estado}
                    </span>
                  </div>
                  {r.motivo && (
                    <div style={{ marginTop: 6, padding: '6px 9px', background: '#fff', borderRadius: 7, border: '1px solid #FED7D7', fontSize: 11.5, color: 'var(--texto-secundario)', fontStyle: 'italic' }}>
                      Motivo: {r.motivo}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 12 }}>Últimos vuelos</div>
          {recentFlights.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)', padding: '6px 0' }}>{esHoy ? 'Aún no hay vuelos registrados hoy.' : 'Sin vuelos registrados.'}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {recentFlights.map((f) => {
              const tramo = tramosByN.get(f.tramo_n);
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

        {/* Descargar bitácora Excel */}
        {day.flights.length > 0 && (
          <button
            onClick={() => descargarBitacora(day.flights, day.pdoRows, fecha, tramosByN, operadoresByHalcon)}
            className="card"
            style={{ width: '100%', padding: '14px 15px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, background: '#217346', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              📊
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)' }}>Descargar Bitácora</div>
              <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 600, marginTop: 1 }}>
                Excel con {day.flights.length} vuelos · {formatFechaLabel(fecha)}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#217346' }}>Descargar ›</span>
          </button>
        )}

      </div>
    </div>
  );
}
