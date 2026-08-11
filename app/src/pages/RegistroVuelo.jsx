import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRegistro } from '../context/RegistroContext';
import { formatFechaCorta } from '../lib/turnos';
import ScreenHeader from '../components/ScreenHeader';

const ALTURAS = ['60 metros', '70 metros', '80 metros', '90 metros', '100 metros', '110 metros', '120 metros', '200 metros', '300 metros', '400 metros', '500 metros', '600 metros'];
const DISTANCIAS = ['100 metros', '200 metros', '300 metros', '400 metros', '500 metros', '600 metros', '700 metros', '800 metros', '900 metros', '1000 metros'];
const AERONAVES = ['DUAL', 'AUTEL', '3TD', 'MATRICE 300', 'AIR 2'];
const TIPIFICACIONES = ['Paneo Preventivo', 'Paneo Focalizado', 'Informe Situacional', 'Monitoreo Preventivo', 'Constancia de Servicio'];
const ESTADOS = ['Realizado', 'Interrumpido', 'Reprogramado'];

export default function RegistroVuelo() {
  const { operador } = useAuth();
  const { selectedTramo, form, setField } = useRegistro();
  const navigate = useNavigate();

  if (!selectedTramo) return <Navigate to="/tramos" replace />;

  const puedeContinuar = form.altura && form.minutos > 0 && form.distancia && form.aeronave && form.tipificacion && form.estado;

  return (
    <div className="screen">
      <ScreenHeader onBack={() => navigate('/tramos')} title="Registro del Vuelo" subtitle={`Tramo ${selectedTramo.tramo_n} · ${selectedTramo.nombre}`} />

      <div className="content">
        <div style={{ background: 'var(--verde-fondo-2)', border: '1px solid var(--verde-borde)', borderRadius: 16, padding: '14px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 700, color: 'var(--verde-ok)', marginBottom: 11 }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--verde-ok)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
              ✓
            </span>
            COMPLETADO AUTOMÁTICAMENTE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 14px' }}>
            <Campo label="Fecha" valor={formatFechaCorta(new Date())} />
            <Campo label="Hora de inicio" valor={form.horaInicio} />
            <Campo label="Funcionario" valor={operador.nombre} />
            <Campo label="Operativo" valor={`Halcón ${operador.halcon_n}`} />
          </div>
        </div>

        <div>
          <label className="field-label">Altura de vuelo</label>
          <div className="field-wrap">
            <select className="field-select" value={form.altura} onChange={(e) => setField('altura', e.target.value)}>
              <option value="">Seleccionar altura…</option>
              {ALTURAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className="field-caret">▼</span>
          </div>
        </div>

        <div>
          <label className="field-label">Minutos de vuelo</label>
          <div className="stepper">
            <button className="stepper-btn stepper-btn--dec" onClick={() => setField('minutos', Math.max(1, form.minutos - 5))}>
              −
            </button>
            <div className="stepper-value">
              <span>{form.minutos}</span>
              <span>min</span>
            </div>
            <button className="stepper-btn stepper-btn--inc" onClick={() => setField('minutos', form.minutos + 5)}>
              +
            </button>
          </div>
        </div>

        <div>
          <label className="field-label">Distancia recorrida</label>
          <div className="field-wrap">
            <select className="field-select" value={form.distancia} onChange={(e) => setField('distancia', e.target.value)}>
              {DISTANCIAS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span className="field-caret">▼</span>
          </div>
        </div>

        <div>
          <label className="field-label">Aeronave utilizada</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AERONAVES.map((a) => (
              <button key={a} onClick={() => setField('aeronave', a)} className={`chip ${form.aeronave === a ? 'chip--on' : ''}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">Tipificación</label>
          <div className="field-wrap">
            <select className="field-select" value={form.tipificacion} onChange={(e) => setField('tipificacion', e.target.value)}>
              {TIPIFICACIONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="field-caret">▼</span>
          </div>
        </div>

        <div>
          <label className="field-label">Estado del vuelo</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {ESTADOS.map((e) => (
              <button key={e} onClick={() => setField('estado', e)} className={`chip ${form.estado === e ? 'chip--on' : ''}`} style={{ flex: 1 }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">Observaciones</label>
          <textarea
            className="field-textarea"
            value={form.observaciones}
            onChange={(e) => setField('observaciones', e.target.value)}
            placeholder="Novedades, hallazgos o comentarios del vuelo…"
          />
        </div>

        <button disabled={!puedeContinuar} onClick={() => navigate('/registro/confirmar')} className="btn btn-dark" style={{ width: '100%' }}>
          Revisar y confirmar<span style={{ fontSize: 18 }}>→</span>
        </button>
      </div>
    </div>
  );
}

function Campo({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--texto-secundario)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--texto-titulo)', fontWeight: 700 }}>{valor}</div>
    </div>
  );
}
