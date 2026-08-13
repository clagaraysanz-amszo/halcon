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

function OperadorDetalle({ op, nombre, hoy, onVerDia, maxVuelos }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>
          {op.halconN}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--texto-titulo)' }}>Halcón {op.halconN}</div>
          <div style={{ fontSize: 12, color: 'var(--texto-secundario)', fontWeight: 600 }}>{nombre}</div>
        </div>
        {op.tasa !== null && (
          <span style={{ fontSize: 13, fontWeight: 800, color: op.tasa >= 80 ? 'var(--verde-ok)' : op.tasa >= 50 ? 'var(--ambar-texto)' : '#E53E3E', background: op.tasa >= 80 ? '#F0FFF4' : op.tasa >= 50 ? '#FFFBEB' : '#FFF5F5', padding: '4px 10px', borderRadius: 10 }}>
            {op.tasa}%
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div style={{ textAlign: 'center', padding: '10px 0', background: '#F7F9FC', borderRadius: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--azul)' }}>{op.totalVuelos}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--texto-tenue)', marginTop: 2 }}>Vuelos</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 0', background: '#F7F9FC', borderRadius: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--naranjo)' }}>{(op.totalMinutos / 60).toFixed(1)}h</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--texto-tenue)', marginTop: 2 }}>Horas vuelo</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 0', background: '#F7F9FC', borderRadius: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--verde-ok)' }}>{op.totalRealizados}/{op.totalAsignados}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--texto-tenue)', marginTop: 2 }}>Tramos</div>
        </div>
      </div>

      <div data-testid={`mini-chart-${op.halconN}`} style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 64, pointerEvents: 'none' }}>
        {op.days.map((d) => {
          const h = Math.max(4, (d.vuelos / maxVuelos) * 52);
          const esHoyCol = d.fecha === hoy;
          return (
            <div key={d.fecha} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: d.vuelos > 0 ? 'var(--texto-titulo)' : 'var(--texto-tenue)' }}>{d.vuelos || ''}</span>
              <div style={{ width: '100%', height: h, borderRadius: 6, background: esHoyCol ? 'var(--naranjo)' : d.vuelos > 0 ? 'var(--azul)' : '#E8ECF1', transition: 'height .4s ease' }} />
              <span style={{ fontSize: 9.5, fontWeight: esHoyCol ? 800 : 600, color: esHoyCol ? 'var(--naranjo)' : 'var(--texto-tenue)' }}>{d.label}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 2 }}>Detalle por día</div>
        {op.days.map((d) => {
          const tieneDatos = d.vuelos > 0 || d.asignados > 0;
          const completo = d.asignados > 0 && d.realizados === d.asignados;
          const parcial = d.asignados > 0 && d.realizados < d.asignados;
          const color = !tieneDatos ? 'var(--texto-tenue)' : completo ? 'var(--verde-ok)' : parcial ? '#E53E3E' : 'var(--texto-titulo)';
          const bg = !tieneDatos ? 'transparent' : completo ? '#F0FFF4' : parcial ? '#FFF5F5' : '#F7F9FC';
          return (
            <button
              key={d.fecha}
              onClick={() => tieneDatos && onVerDia(d.fecha)}
              disabled={!tieneDatos}
              data-testid={`dia-${op.halconN}-${d.fecha}`}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, background: bg, border: 'none', cursor: tieneDatos ? 'pointer' : 'default', textAlign: 'left', width: '100%' }}
            >
              <span style={{ width: 66, flex: 'none', fontSize: 11.5, fontWeight: 700, color: 'var(--texto-secundario)' }}>{formatFechaLarga(d.fecha)}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color }}>
                {tieneDatos ? `${d.vuelos} vuelos · ${d.realizados}/${d.asignados} tramos` : 'Sin actividad'}
              </span>
              {tieneDatos && <span style={{ fontSize: 13, color: 'var(--texto-tenue)', flex: 'none' }}>›</span>}
            </button>
          );
        })}
      </div>

      {op.totalNoRealizados > 0 && (
        <div style={{ padding: '8px 12px', background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#E53E3E', textAlign: 'center' }}>
          {op.totalNoRealizados} sobrevuelo{op.totalNoRealizados > 1 ? 's' : ''} no realizado{op.totalNoRealizados > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export default function ResumenSemanal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { operadoresByHalcon } = useCatalog();
  const hoy = fechaOperativaHoy();
  const [fecha, setFecha] = useState(() => location.state?.fecha || hoy);
  const [selectedOp, setSelectedOp] = useState(null);
  const { data: weekly, loading } = useSupervisorWeekly(fecha);

  const esSemanaActual = weekly ? weekly.weekDates[0] === mondayOf(hoy) : false;

  function verDia(diaFecha) {
    navigate('/supervisor', { state: { fecha: diaFecha } });
  }

  const maxVuelos = weekly ? Math.max(1, ...weekly.porOperador.map((o) => o.totalVuelos)) : 1;

  const opSeleccionado = selectedOp && weekly ? weekly.porOperador.find((o) => o.halconN === selectedOp) : null;

  return (
    <div className="screen">
      <div className="header header--supervisor" style={{ padding: '10px 16px 10px' }}>
        <div className="header-row">
          <button
            className="back-btn"
            onClick={() => {
              if (selectedOp) { setSelectedOp(null); return; }
              navigate('/supervisor');
            }}
            aria-label="Volver"
          >
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#EE6B1E', fontWeight: 700, letterSpacing: 1.5 }}>RESUMEN SEMANAL</div>
            <div className="header-title" style={{ fontSize: 15 }}>
              {selectedOp
                ? `Halcón ${selectedOp} · ${operadoresByHalcon.get(selectedOp)?.nombre ?? selectedOp}`
                : 'Historial por funcionario'}
            </div>
          </div>
        </div>

        {!selectedOp && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
            <button
              onClick={() => setFecha(addDaysStr(fecha, -7))}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ‹
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, color: '#fff', fontWeight: 700 }}>{weekly ? formatRangoSemana(weekly.weekDates) : '—'}</div>
            </div>
            <button
              onClick={() => setFecha(addDaysStr(fecha, 7))}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ›
            </button>
            {!esSemanaActual && (
              <button
                onClick={() => setFecha(hoy)}
                style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', flex: 'none' }}
              >
                Actual
              </button>
            )}
          </div>
        )}

        {selectedOp && weekly && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>
            {esSemanaActual ? 'Semana actual' : formatRangoSemana(weekly.weekDates)}
          </div>
        )}
      </div>

      <div className="content">
        {loading && <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)', textAlign: 'center', padding: '20px 0' }}>Cargando...</div>}

        {!loading && weekly && weekly.porOperador.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--texto-tenue)', textAlign: 'center', padding: '20px 0' }}>
            Sin actividad registrada esta semana.
          </div>
        )}

        {!loading && weekly && !selectedOp && weekly.porOperador.map((op) => {
          const nombre = operadoresByHalcon.get(op.halconN)?.nombre ?? op.halconN;
          return (
            <button
              key={op.halconN}
              onClick={() => setSelectedOp(op.halconN)}
              data-testid={`toggle-${op.halconN}`}
              className="card"
              style={{ width: '100%', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', border: '1px solid var(--borde-1)' }}
            >
              <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>
                {op.halconN}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--texto-titulo)' }}>Halcón {op.halconN} · {nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--texto-tenue)', fontWeight: 600, marginTop: 1 }}>
                  {op.totalVuelos} vuelos · {(op.totalMinutos / 60).toFixed(1)}h · {op.totalRealizados}/{op.totalAsignados} tramos
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                {op.tasa !== null && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: op.tasa >= 80 ? 'var(--verde-ok)' : op.tasa >= 50 ? 'var(--ambar-texto)' : '#E53E3E', background: op.tasa >= 80 ? '#F0FFF4' : op.tasa >= 50 ? '#FFFBEB' : '#FFF5F5', padding: '3px 8px', borderRadius: 10 }}>
                    {op.tasa}%
                  </span>
                )}
                <span style={{ fontSize: 14, color: 'var(--texto-tenue)' }}>›</span>
              </div>
            </button>
          );
        })}

        {!loading && weekly && selectedOp && opSeleccionado && (
          <div className="card" style={{ padding: 16 }}>
            <OperadorDetalle
              op={opSeleccionado}
              nombre={operadoresByHalcon.get(selectedOp)?.nombre ?? selectedOp}
              hoy={hoy}
              onVerDia={verDia}
              maxVuelos={maxVuelos}
            />
          </div>
        )}
      </div>
    </div>
  );
}
