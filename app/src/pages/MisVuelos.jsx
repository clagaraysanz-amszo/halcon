import { useState } from 'react';
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
  const { startRegistro, startVigilanciaGeneral } = useRegistro();
  const day = useOperatorDay(operador.halcon_n);
  const navigate = useNavigate();
  const turnoInfo = day.turno ? TURNOS[day.turno] : null;
  const [showMotivo, setShowMotivo] = useState(null);
  const [showJustificado, setShowJustificado] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [motivoJustificado, setMotivoJustificado] = useState('');
  const [saving, setSaving] = useState(false);

  const MOTIVOS_JUSTIFICADO = [
    'Apoyo / Cooperación',
    'Colación',
    'Sobrevuelo extra solicitado por Central SIC',
    'Sobrevuelo extra solicitado por Jefatura directa',
  ];

  function realizarVuelo(pdoRow) {
    if (!pdoRow.tramo_n) {
      startVigilanciaGeneral(pdoRow);
      navigate('/registro');
      return;
    }
    const tramo = tramosByN.get(pdoRow.tramo_n);
    startRegistro(tramo, pdoRow);
    navigate('/registro');
  }

  async function handleNoRealizado(pdoRow) {
    setSaving(true);
    try {
      await day.markNoRealizado(pdoRow, motivo);
      setShowMotivo(null);
      setMotivo('');
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleJustificado(pdoRow) {
    if (!motivoJustificado) return;
    setSaving(true);
    try {
      await day.markJustificado(pdoRow, motivoJustificado);
      setShowJustificado(null);
      setMotivoJustificado('');
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
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

        <div className="list-grid">
        {day.pdoRows.map((row) => {
          const tramo = tramosByN.get(row.tramo_n);
          const done = row.estado === 'Realizado';
          const noRealizado = row.estado === 'No realizado';
          const justificado = row.estado === 'Justificado';
          const pending = row.estado === 'Pendiente';
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
                    {row.tramo_n ? `Tramo ${row.tramo_n} · ${tramo?.nombre ?? '—'}` : (row.descripcion || 'Vigilancia general')}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--texto-secundario)', marginTop: 2 }}>
                    {row.tramo_n ? `${tramo?.sector} · Cuad. ${tramo?.cuadrante}` : 'Zona sin sector asignado'}
                  </div>
                </div>
                <span className={`badge ${done ? 'badge--done' : noRealizado ? 'badge--noreal' : justificado ? 'badge--justificado' : 'badge--pend'}`}>
                  {row.estado}
                </span>
              </div>

              {justificado && row.motivo && (
                <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--ambar-fondo)', border: '1px solid var(--ambar-borde)', borderRadius: 8, fontSize: 11.5, color: 'var(--texto-secundario)', fontStyle: 'italic' }}>
                  Justificación: {row.motivo}
                </div>
              )}

              {noRealizado && row.motivo && (
                <div style={{ marginTop: 8, padding: '7px 10px', background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8, fontSize: 11.5, color: 'var(--texto-secundario)', fontStyle: 'italic' }}>
                  Motivo: {row.motivo}
                </div>
              )}

              {pending && showMotivo !== row.id && showJustificado !== row.id && (
                <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                  <button
                    onClick={() => realizarVuelo(row)}
                    className="btn btn-primary"
                    style={{ flex: 1, height: 44, fontSize: 13.5 }}
                  >
                    Realizar vuelo →
                  </button>
                  <button
                    onClick={() => { setShowJustificado(row.id); setShowMotivo(null); setMotivoJustificado(''); }}
                    style={{
                      flex: 'none',
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      border: '1.5px solid var(--ambar-texto)',
                      background: 'var(--ambar-fondo)',
                      color: 'var(--ambar-texto)',
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Justificar"
                  >
                    ⚡
                  </button>
                  <button
                    onClick={() => { setShowMotivo(row.id); setShowJustificado(null); setMotivo(''); }}
                    style={{
                      flex: 'none',
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      border: '1.5px solid #E53E3E',
                      background: '#FFF5F5',
                      color: '#E53E3E',
                      fontSize: 18,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="No realizado"
                  >
                    ✕
                  </button>
                </div>
              )}

              {pending && showJustificado === row.id && (
                <div style={{ marginTop: 11, padding: 12, background: 'var(--ambar-fondo)', border: '1px solid var(--ambar-borde)', borderRadius: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ambar-texto)', marginBottom: 8 }}>
                    Selecciona el motivo
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {MOTIVOS_JUSTIFICADO.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMotivoJustificado(m)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 9,
                          border: motivoJustificado === m ? '2px solid var(--ambar-texto)' : '1px solid var(--ambar-borde)',
                          background: motivoJustificado === m ? '#fff' : 'rgba(255,255,255,.6)',
                          fontSize: 12.5,
                          fontWeight: motivoJustificado === m ? 700 : 600,
                          color: 'var(--texto-titulo)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => setShowJustificado(null)}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 10,
                        border: '1px solid #DDE6F0',
                        background: '#fff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--texto-titulo)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleJustificado(row)}
                      disabled={saving || !motivoJustificado}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 10,
                        border: 'none',
                        background: 'var(--ambar-texto)',
                        color: '#fff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: saving || !motivoJustificado ? 'not-allowed' : 'pointer',
                        opacity: saving || !motivoJustificado ? 0.5 : 1,
                      }}
                    >
                      {saving ? 'Guardando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}

              {pending && showMotivo === row.id && (
                <div style={{ marginTop: 11, padding: 12, background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E53E3E', marginBottom: 8 }}>
                    Marcar como no realizado
                  </div>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo (opcional): ej. clima, batería, zona restringida..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '9px 11px',
                      borderRadius: 8,
                      border: '1px solid #FED7D7',
                      fontSize: 13,
                      resize: 'none',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => setShowMotivo(null)}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 10,
                        border: '1px solid #DDE6F0',
                        background: '#fff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--texto-titulo)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleNoRealizado(row)}
                      disabled={saving}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 10,
                        border: 'none',
                        background: '#E53E3E',
                        color: '#fff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: saving ? 'wait' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? 'Guardando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>

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
