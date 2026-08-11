import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRegistro } from '../context/RegistroContext';
import { useOperatorDay } from '../hooks/useOperatorDay';
import ScreenHeader from '../components/ScreenHeader';

export default function Confirmacion() {
  const { operador } = useAuth();
  const { selectedTramo, selectedPdo, selectedTipoVuelo, form, setLastFlight } = useRegistro();
  const day = useOperatorDay(operador.halcon_n);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const esTramo = !!selectedTramo;
  const esOtroVuelo = !!selectedTipoVuelo;

  if (!esTramo && !esOtroVuelo) return <Navigate to="/tramos" replace />;

  const summary = [
    { k: 'Turno', v: form.turno || '—' },
    { k: 'Altura de vuelo', v: form.altura || '—' },
    { k: 'Duración', v: `${form.minutos} minutos` },
    { k: 'Distancia recorrida', v: form.distancia || '—' },
    { k: 'Aeronave', v: form.aeronave },
    { k: 'Tipificación', v: form.tipificacion },
    ...(esTramo ? [{ k: 'Cuadrante', v: selectedTramo.cuadrante }] : []),
    ...(esOtroVuelo && form.ubicacionManual ? [{ k: 'Ubicación', v: form.ubicacionManual }] : []),
    { k: 'Estado', v: form.estado },
    { k: 'Observaciones', v: form.observaciones || 'Sin observaciones' },
  ];

  async function confirmar() {
    setSaving(true);
    setError('');
    try {
      const inserted = await day.confirmFlight({
        tramoN: esTramo ? selectedTramo.tramo_n : null,
        form,
        pdoRow: selectedPdo,
        tramoInfo: selectedTramo,
        operadorNombre: operador.nombre,
        tipoVuelo: selectedTipoVuelo,
      });
      setLastFlight({ ...inserted, nombre: esTramo ? selectedTramo.nombre : selectedTipoVuelo });
      navigate('/registro/exito');
    } catch (e) {
      setError('No se pudo guardar el registro. Intenta nuevamente.');
      setSaving(false);
    }
  }

  const headerBg = esTramo
    ? 'linear-gradient(135deg,#16233F,#22375F)'
    : 'linear-gradient(135deg,#4C1D95,#6D28D9)';

  return (
    <div className="screen">
      <ScreenHeader onBack={() => navigate('/registro')} title="Confirmación" subtitle="Revisa antes de guardar" />

      <div className="content">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ background: headerBg, padding: '16px 18px', color: '#fff', display: 'flex', alignItems: 'center', gap: 13 }}>
            {esTramo ? (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 13,
                  background: 'var(--naranjo)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                }}
              >
                <span style={{ fontSize: 8, opacity: 0.8 }}>TRAMO</span>
                <span style={{ fontSize: 19 }}>{selectedTramo.tramo_n}</span>
              </div>
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 13,
                  background: 'rgba(255,255,255,.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                ◎
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.2 }}>
                {esTramo ? selectedTramo.nombre : selectedTipoVuelo}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 2 }}>
                {esTramo
                  ? `${selectedTramo.sector} · Cuad. ${selectedTramo.cuadrante}`
                  : form.ubicacionManual || 'Vuelo operativo'}
              </div>
            </div>
          </div>
          <div style={{ padding: '6px 18px' }}>
            {summary.map((s) => (
              <div key={s.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--fondo-app)' }}>
                <span style={{ fontSize: 13, color: 'var(--texto-secundario)', fontWeight: 600 }}>{s.k}</span>
                <span style={{ fontSize: 13.5, color: 'var(--texto-titulo)', fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>

        {error && <div style={{ color: 'var(--rojo)', fontSize: 12.5, fontWeight: 600, textAlign: 'center' }}>{error}</div>}

        <div className="spacer" />
        <div style={{ display: 'flex', gap: 11 }}>
          <button onClick={() => navigate('/registro')} className="btn btn-outline" style={{ flex: 1 }} disabled={saving}>
            ✎ Editar
          </button>
          <button onClick={confirmar} className="btn btn-primary" style={{ flex: 1.4 }} disabled={saving}>
            {saving ? 'Guardando…' : '✓ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
