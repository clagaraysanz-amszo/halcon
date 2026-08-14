import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useSupervisorDay } from '../hooks/useSupervisorDay';
import { TURNOS, compararHoraTurno, fechaOperativaHoy, toISODate } from '../lib/turnos';
import { googleMapsUrl } from '../lib/geo';

const TURNO_OPTS = ['A', 'B', 'N'];
const DIAS_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MAX_VUELOS_INICIALES = 4;

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
  const location = useLocation();
  const hoy = fechaOperativaHoy();
  const [fecha, setFecha] = useState(() => location.state?.fecha || hoy);
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

  const estadoSobrevuelos = useMemo(() => {
    const turnoOrder = { A: 0, B: 1, N: 2 };
    const sorted = [...day.pdoRows].sort((a, b) => {
      const tDiff = (turnoOrder[a.turno] ?? 3) - (turnoOrder[b.turno] ?? 3);
      if (tDiff !== 0) return tDiff;
      const hDiff = a.halcon_n.localeCompare(b.halcon_n, undefined, { numeric: true });
      if (hDiff !== 0) return hDiff;
      return compararHoraTurno(a.hora, b.hora, a.turno);
    });
    const groups = [];
    let current = null;
    sorted.forEach((r) => {
      const key = `${r.turno}-${r.halcon_n}`;
      if (!current || current.key !== key) {
        current = { key, turno: r.turno, halconN: r.halcon_n, nombre: operadoresByHalcon.get(r.halcon_n)?.nombre ?? r.halcon_n, entries: [] };
        groups.push(current);
      }
      current.entries.push(r);
    });
    return groups;
  }, [day.pdoRows, operadoresByHalcon]);

  const noRealizadosCount = day.pdoRows.filter((r) => r.estado !== 'Realizado').length;

  const [estadoOpen, setEstadoOpen] = useState(false);
  const [vuelosOpen, setVuelosOpen] = useState(false);
  const [bitacoraStatus, setBitacoraStatus] = useState(null);

  const recentFlights = day.flights.slice(0, vuelosOpen ? undefined : MAX_VUELOS_INICIALES);
  const hayMasVuelos = day.flights.length > MAX_VUELOS_INICIALES;
  const totalHoras = (day.totalMinutos / 60).toFixed(1);
  const ringPct = day.pdoTotal ? day.pdoDone / day.pdoTotal : 0;
  const ringOffset = (251.3 * (1 - ringPct)).toFixed(1);

  return (
    <div className="screen">
      <div className="header header--supervisor" style={{ padding: '10px 16px 10px' }}>
        <div className="header-row">
          <button className="back-btn" onClick={() => navigate('/inicio')} aria-label="Volver">
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#EE6B1E', fontWeight: 700, letterSpacing: 1.5 }}>PANEL DE SUPERVISIÓN</div>
            <div className="header-title" style={{ fontSize: 15 }}>{esHoy ? 'Operación en tiempo real' : 'Revisión histórica'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            {esHoy && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#3FD07A' }}>
                <span className="status-dot" style={{ background: '#3FD07A', boxShadow: '0 0 0 3px rgba(63,208,122,.2)' }} />
                EN VIVO
              </div>
            )}
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--naranjo)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
              {operador.nombre.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </div>
          </div>
        </div>

        <div className="datenav-row" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <button
            onClick={() => setFecha(addDaysStr(fecha, -1))}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ‹
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, color: '#fff', fontWeight: 700 }}>{formatFechaLabel(fecha)}</div>
          </div>
          <button
            onClick={() => setFecha(addDaysStr(fecha, 1))}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ›
          </button>
          {!esHoy && (
            <button
              onClick={() => setFecha(hoy)}
              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', flex: 'none' }}
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      <div className="content content--split">
      <div className="content-col">
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

        <button
          onClick={() => navigate('/supervisor/semanal', { state: { fecha } })}
          className="card"
          style={{ width: '100%', padding: '14px 15px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, background: '#2C6FB5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            📊
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)' }}>Resumen semanal</div>
            <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 600, marginTop: 1 }}>Historial por funcionario</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#2C6FB5' }}>Ver ›</span>
        </button>

        <button
          onClick={async () => {
            if (bitacoraStatus === 'loading') return;
            setBitacoraStatus('loading');
            try {
              const res = await fetch(`/api/bitacora/nocturna?fecha=${fecha}`, { method: 'POST' });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Error al generar');
              setBitacoraStatus(`ok:${data.vuelos}`);
              setTimeout(() => setBitacoraStatus(null), 5000);
            } catch (e) {
              setBitacoraStatus('error:' + e.message);
              setTimeout(() => setBitacoraStatus(null), 6000);
            }
          }}
          className="card"
          style={{ width: '100%', padding: '14px 15px', cursor: bitacoraStatus === 'loading' ? 'wait' : 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, opacity: bitacoraStatus === 'loading' ? 0.7 : 1 }}
        >
          <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, background: '#6B5FB0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            🌙
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)' }}>Bitácora nocturna</div>
            <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 600, marginTop: 1 }}>
              {bitacoraStatus === 'loading'
                ? 'Generando documento...'
                : bitacoraStatus?.startsWith('ok:')
                  ? `✓ Generada con ${bitacoraStatus.split(':')[1]} vuelos`
                  : bitacoraStatus?.startsWith('error:')
                    ? `✗ ${bitacoraStatus.split(':').slice(1).join(':')}`
                    : 'Generar Word DGAC y subir a SharePoint'}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6B5FB0' }}>
            {bitacoraStatus === 'loading' ? '...' : 'Generar ›'}
          </span>
        </button>

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
      </div>

      <div className="content-col">
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

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setEstadoOpen(!estadoOpen)}
            style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: estadoOpen ? '#F7F9FC' : 'var(--superficie)', cursor: 'pointer', textAlign: 'left', borderBottom: estadoOpen ? '1px solid var(--borde-1)' : 'none' }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', flex: 1 }}>Estado de sobrevuelos</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
              {noRealizadosCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#E53E3E', padding: '2px 8px', borderRadius: 10 }}>
                  {noRealizadosCount} pend.
                </span>
              )}
              {noRealizadosCount === 0 && day.pdoTotal > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--verde-ok)', padding: '2px 8px', borderRadius: 10 }}>
                  Todo OK
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto-tenue)' }}>{day.pdoDone}/{day.pdoTotal}</span>
              <span style={{ fontSize: 12, color: 'var(--texto-tenue)', transform: estadoOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
            </div>
          </button>
          {estadoOpen && (
            <div style={{ padding: '8px 12px 12px' }}>
              {estadoSobrevuelos.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)', fontWeight: 600, padding: '8px 0' }}>
                  {esHoy ? 'Sin PDO cargado.' : 'Sin PDO para esta fecha.'}
                </div>
              )}
              {noRealizadosCount === 0 && day.pdoTotal > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--verde-ok)', fontWeight: 600, padding: '0 0 10px' }}>
                  ✓ Todos los sobrevuelos fueron realizados
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {estadoSobrevuelos.map((group) => (
                  <div key={group.key} style={{ border: '1px solid var(--fondo-app)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ background: '#F7F9FC', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: '1px solid var(--fondo-app)' }}>
                      <div style={{ width: 28, height: 28, flex: 'none', borderRadius: 8, background: 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                        {group.turno}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--texto-titulo)' }}>Halcón {group.halconN} · {group.nombre}</div>
                        <div style={{ fontSize: 10, color: 'var(--texto-tenue)', fontWeight: 600 }}>{TURNOS[group.turno].label} · {TURNOS[group.turno].horas}</div>
                      </div>
                    </div>
                    <div style={{ padding: '4px 12px 8px' }}>
                      {group.entries.map((r) => {
                        const tramo = tramosByN.get(r.tramo_n);
                        const esRealizado = r.estado === 'Realizado';
                        const esNoRealizado = r.estado === 'No realizado';
                        const colorFondo = esRealizado ? '#F0FFF4' : esNoRealizado ? '#FFF5F5' : 'transparent';
                        const colorBorde = esRealizado ? '#C6F6D5' : esNoRealizado ? '#FED7D7' : 'transparent';
                        const colorEstado = esRealizado ? 'var(--verde-ok)' : esNoRealizado ? '#E53E3E' : 'var(--ambar-texto)';
                        const iconColor = esRealizado ? 'var(--verde-ok)' : 'var(--texto-tenue)';
                        return (
                          <div key={r.id} style={{ marginTop: 2, borderRadius: 8, background: colorFondo, border: colorBorde !== 'transparent' ? `1px solid ${colorBorde}` : 'none', padding: colorFondo !== 'transparent' ? '6px 9px' : '6px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <span style={{ width: 16, flex: 'none', textAlign: 'center', fontSize: 13, fontWeight: 800, color: iconColor }}>
                                {esRealizado ? '✓' : esNoRealizado ? '✗' : '○'}
                              </span>
                              <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: 'var(--texto-tenue)', width: 44 }}>{r.hora}</span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color: 'var(--texto-titulo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Tramo {r.tramo_n} · {tramo?.nombre ?? '—'}
                              </span>
                              <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, color: colorEstado }}>{r.estado}</span>
                            </div>
                            {esNoRealizado && r.motivo && (
                              <div style={{ marginTop: 5, marginLeft: 25, padding: '5px 9px', background: '#fff', borderRadius: 7, border: '1px solid #FED7D7', fontSize: 11, color: 'var(--texto-secundario)', fontStyle: 'italic' }}>
                                Motivo: {r.motivo}
                              </div>
                            )}
                            {esNoRealizado && !r.motivo && (
                              <div style={{ marginTop: 5, marginLeft: 25, fontSize: 10.5, color: '#E53E3E', fontStyle: 'italic' }}>
                                Sin motivo registrado
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 12 }}>Últimos vuelos</div>
          {day.flights.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)', padding: '6px 0' }}>{esHoy ? 'Aún no hay vuelos registrados hoy.' : 'Sin vuelos registrados.'}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {recentFlights.map((f) => {
              const tramo = tramosByN.get(f.tramo_n);
              const esOtroVuelo = !f.tramo_n;
              const nombre = esOtroVuelo ? f.tipificacion : (tramo?.nombre ?? '—');
              const lat = f.latitud ?? tramo?.latitud;
              const lng = f.longitud ?? tramo?.longitud;
              const mapsUrl = googleMapsUrl(lat, lng);
              const gpsPropio = f.latitud != null && f.longitud != null;
              return (
                <div key={f.id} style={{ paddingBottom: 9, borderBottom: '1px solid #F1F3F7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: esOtroVuelo ? '#7C3AED' : 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: esOtroVuelo ? 16 : 13, fontWeight: 800 }}>
                      {esOtroVuelo ? '◎' : f.tramo_n}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--texto-titulo)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nombre}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--texto-secundario)', marginTop: 1 }}>
                        Halcón {f.halcon_n} · {f.hora_inicio}{f.ubicacion_manual ? ` · ${f.ubicacion_manual}` : ''}
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
                  {f.observaciones && (
                    <div style={{ marginTop: 5, marginLeft: 47, padding: '5px 9px', background: '#F7F9FC', borderRadius: 7, border: '1px solid #EEF2F8', fontSize: 11, color: 'var(--texto-secundario)', fontStyle: 'italic' }}>
                      {f.observaciones}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {hayMasVuelos && (
            <button
              onClick={() => setVuelosOpen(!vuelosOpen)}
              style={{ width: '100%', marginTop: 10, padding: '8px 0', border: '1px solid var(--borde-2)', borderRadius: 9, background: '#F7F9FC', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--azul)' }}
            >
              {vuelosOpen ? 'Ver menos' : `Ver todos (${day.flights.length})`}
            </button>
          )}
          {recentFlights.some((f) => (f.latitud == null || f.longitud == null) && tramosByN.get(f.tramo_n)) && (
            <div style={{ fontSize: 10, color: 'var(--texto-tenue)', marginTop: 9 }}>
              * Ubicación aproximada del tramo (el vuelo no registró GPS propio).
            </div>
          )}
        </div>
      </div>

      </div>
    </div>
  );
}
