import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { useSupervisorWeekly } from '../hooks/useSupervisorWeekly';
import { fechaOperativaHoy, toISODate } from '../lib/turnos';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function parseFecha(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysStr(fechaStr, days) {
  const d = parseFecha(fechaStr);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function mondayOf(fechaStr) {
  const d = parseFecha(fechaStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function formatRangoSemana(weekDates) {
  const start = parseFecha(weekDates[0]);
  const end = parseFecha(weekDates[6]);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MESES[start.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${MESES[start.getMonth()]} – ${end.getDate()} ${MESES[end.getMonth()]} ${end.getFullYear()}`;
}

function formatFechaLarga(str) {
  const d = parseFecha(str);
  return `${DIAS_SEM[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

export default function ResumenSemanal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { operadoresByHalcon } = useCatalog();
  const hoy = fechaOperativaHoy();
  const [fecha, setFecha] = useState(() => location.state?.fecha || hoy);
  const [expanded, setExpanded] = useState(() => new Set());
  const { data: weekly, loading } = useSupervisorWeekly(fecha);

  const esSemanaActual = weekly ? weekly.weekDates[0] === mondayOf(hoy) : false;

  function toggleExpand(halconN) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(halconN)) next.delete(halconN);
      else next.add(halconN);
      return next;
    });
  }

  function verDia(diaFecha) {
    navigate('/supervisor', { state: { fecha: diaFecha } });
  }

  return (
    <div className="screen">
      <div className="header header--supervisor">
        <div className="header-row">
          <button className="back-btn" onClick={() => navigate('/supervisor')} aria-label="Volver">
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#EE6B1E', fontWeight: 700, letterSpacing: 1.5 }}>RESUMEN SEMANAL</div>
            <div className="header-title">Historial por funcionario</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <button
            onClick={() => setFecha(addDaysStr(fecha, -7))}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ‹
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, color: '#fff', fontWeight: 700 }}>{weekly ? formatRangoSemana(weekly.weekDates) : '—'}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>{esSemanaActual ? 'Semana actual' : 'Semana anterior'}</div>
          </div>
          <button
            onClick={() => setFecha(addDaysStr(fecha, 7))}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ›
          </button>
        </div>
        {!esSemanaActual && (
          <button
            onClick={() => setFecha(hoy)}
            style={{ marginTop: 6, width: '100%', padding: '7px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
          >
            Volver a esta semana
          </button>
        )}
      </div>

      <div className="content">
        {loading && <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)', textAlign: 'center', padding: '20px 0' }}>Cargando…</div>}

        {!loading && weekly && weekly.porOperador.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)', textAlign: 'center', padding: '20px 0' }}>
            Sin actividad registrada esta semana.
          </div>
        )}

        {!loading && weekly && weekly.porOperador.map((op) => {
          const nombre = operadoresByHalcon.get(op.halconN)?.nombre ?? op.halconN;
          const maxVuelos = Math.max(1, ...weekly.porOperador.map((o) => o.totalVuelos));
          const isOpen = expanded.has(op.halconN);
          return (
            <div key={op.halconN} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => toggleExpand(op.halconN)}
                style={{ width: '100%', background: '#F7F9FC', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', borderBottom: isOpen ? '1px solid var(--fondo-app)' : 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, background: 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                  {op.halconN}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto-titulo)' }}>Halcón {op.halconN} · {nombre}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--texto-tenue)', fontWeight: 600 }}>{op.totalVuelos} vuelos · {(op.totalMinutos / 60).toFixed(1)}h</div>
                </div>
                {op.tasa !== null && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: op.tasa >= 80 ? 'var(--verde-ok)' : op.tasa >= 50 ? 'var(--ambar-texto)' : '#E53E3E', background: op.tasa >= 80 ? '#F0FFF4' : op.tasa >= 50 ? '#FFFBEB' : '#FFF5F5', padding: '3px 8px', borderRadius: 10, flex: 'none' }}>
                    {op.tasa}%
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--texto-tenue)', flex: 'none', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              </button>

              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 48, marginBottom: 4 }}>
                  {op.days.map((d) => {
                    const h = Math.max(3, (d.vuelos / maxVuelos) * 38);
                    const esHoyCol = d.fecha === hoy;
                    return (
                      <button
                        key={d.fecha}
                        onClick={() => verDia(d.fecha)}
                        disabled={d.vuelos === 0 && d.asignados === 0}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: 0, cursor: (d.vuelos > 0 || d.asignados > 0) ? 'pointer' : 'default' }}
                      >
                        <span style={{ fontSize: 9, fontWeight: 800, color: d.vuelos > 0 ? 'var(--texto-titulo)' : 'var(--texto-tenue)' }}>{d.vuelos || ''}</span>
                        <div style={{ width: '100%', height: h, borderRadius: 5, background: esHoyCol ? 'var(--naranjo)' : d.vuelos > 0 ? 'var(--azul)' : '#E8ECF1', transition: 'height .4s ease' }} />
                        <span style={{ fontSize: 9, fontWeight: esHoyCol ? 800 : 600, color: esHoyCol ? 'var(--naranjo)' : 'var(--texto-tenue)' }}>{d.label}</span>
                      </button>
                    );
                  })}
                </div>

                {!isOpen && op.totalNoRealizados > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#E53E3E' }}>
                    {op.totalNoRealizados} sobrevuelo{op.totalNoRealizados > 1 ? 's' : ''} no realizado{op.totalNoRealizados > 1 ? 's' : ''}
                  </div>
                )}

                {isOpen && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {op.days.map((d) => {
                      const tieneDatos = d.vuelos > 0 || d.asignados > 0;
                      const completo = d.asignados > 0 && d.realizados === d.asignados;
                      const parcial = d.asignados > 0 && d.realizados < d.asignados;
                      const color = !tieneDatos ? 'var(--texto-tenue)' : completo ? 'var(--verde-ok)' : parcial ? '#E53E3E' : 'var(--texto-titulo)';
                      const bg = !tieneDatos ? 'transparent' : completo ? '#F0FFF4' : parcial ? '#FFF5F5' : '#F7F9FC';
                      return (
                        <button
                          key={d.fecha}
                          onClick={() => tieneDatos && verDia(d.fecha)}
                          disabled={!tieneDatos}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 9, background: bg, border: 'none', cursor: tieneDatos ? 'pointer' : 'default', textAlign: 'left', width: '100%' }}
                        >
                          <span style={{ width: 62, flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--texto-secundario)' }}>{formatFechaLarga(d.fecha)}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color }}>
                            {tieneDatos ? `${d.vuelos} vuelos · ${d.realizados}/${d.asignados} tramos` : 'Sin actividad'}
                          </span>
                          {tieneDatos && <span style={{ fontSize: 13, color: 'var(--texto-tenue)', flex: 'none' }}>›</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
