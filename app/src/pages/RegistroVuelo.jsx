import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRegistro } from '../context/RegistroContext';
import { formatFechaCorta } from '../lib/turnos';
import ScreenHeader from '../components/ScreenHeader';

const ALTURAS = ['60 metros', '70 metros', '80 metros', '90 metros', '100 metros', '110 metros', '120 metros', '200 metros', '300 metros', '400 metros', '500 metros', '600 metros'];
const DISTANCIAS = ['100 metros', '200 metros', '300 metros', '400 metros', '500 metros', '600 metros', '700 metros', '800 metros', '900 metros', '1000 metros'];
const AERONAVES = ['DUAL', 'AUTEL', '3TD', 'MATRICE 300', 'AIR 2', 'ADVANCED', 'ZOOM'];
const TIPIFICACIONES_TRAMO = ['Paneo Preventivo', 'Paneo Focalizado', 'Informe Situacional', 'Constancia de Servicio'];
const ESTADOS = ['Realizado', 'Interrumpido', 'Reprogramado'];
const TURNOS_SELECT = ['A', 'B', 'N', 'SE'];

const FARELLONES_UBICACIONES = [
  { grupo: 'Ruta G-21', opciones: ['Base Ermita', 'Curva 01', 'Curva 12', 'Curva 16', 'Curva 21 (Plazoleta negra)', 'Curva 32', 'Drop Off', 'La Parva', 'El Colorado'] },
  { grupo: 'Ruta G-251', opciones: ['Plaza de los pumas', 'Curva 07', 'Curva 16'] },
];

export default function RegistroVuelo() {
  const { operador } = useAuth();
  const { selectedTramo, selectedTipoVuelo, form, setField } = useRegistro();
  const navigate = useNavigate();

  const esTramo = !!selectedTramo;
  const esOtroVuelo = !!selectedTipoVuelo;
  const esFarellones = selectedTipoVuelo === 'Servicio Farellones';

  if (!esTramo && !esOtroVuelo) return <Navigate to="/tramos" replace />;

  const puedeContinuar =
    form.altura &&
    form.minutos > 0 &&
    form.distancia &&
    form.aeronave &&
    form.turno &&
    form.estado &&
    (esTramo ? form.tipificacion : true) &&
    (esFarellones ? form.ubicacionManual : true);

  const headerTitle = esTramo ? 'Registro del Vuelo' : 'Registro de Vuelo';
  const headerSubtitle = esTramo
    ? `Tramo ${selectedTramo.tramo_n} · ${selectedTramo.nombre}`
    : selectedTipoVuelo;
  const backPath = esTramo ? '/tramos' : '/otros-vuelos';

  return (
    <div className="screen">
      <ScreenHeader onBack={() => navigate(backPath)} title={headerTitle} subtitle={headerSubtitle} />

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

        {esOtroVuelo && (
          <div style={{ background: '#F3F0FF', border: '1px solid #DDD6FE', borderRadius: 14, padding: '12px 15px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', letterSpacing: 0.5 }}>TIPO DE VUELO</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--texto-titulo)', marginTop: 3 }}>{selectedTipoVuelo}</div>
          </div>
        )}

        <div>
          <label className="field-label">Turno</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {TURNOS_SELECT.map((t) => (
              <button key={t} onClick={() => setField('turno', t)} className={`chip ${form.turno === t ? 'chip--on' : ''}`} style={{ flex: 1 }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {esFarellones && (
          <div>
            <label className="field-label">Ubicación</label>
            <div className="field-wrap">
              <select className="field-select" value={form.ubicacionManual} onChange={(e) => setField('ubicacionManual', e.target.value)}>
                <option value="">Seleccionar ubicación…</option>
                {FARELLONES_UBICACIONES.map((g) => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.opciones.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="field-caret">▼</span>
            </div>
          </div>
        )}

        {esOtroVuelo && !esFarellones && (
          <div>
            <label className="field-label">Lugar / Dirección</label>
            <input
              type="text"
              className="field-select"
              value={form.ubicacionManual}
              onChange={(e) => setField('ubicacionManual', e.target.value)}
              placeholder="Ej: Av. Las Condes 12345, esquina Los Militares…"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        )}

        <div>
          <label className="field-label">Altura de vuelo</label>
          <div className="field-wrap">
            <select className="field-select" value={form.altura} onChange={(e) => setField('altura', e.target.value)}>
              <option value="">Seleccionar altura…</option>
              {ALTURAS.map((a) => (
                <option key={a} value={a}>{a}</option>
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
                <option key={d} value={d}>{d}</option>
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

        {esTramo && (
          <div>
            <label className="field-label">Tipificación</label>
            <div className="field-wrap">
              <select className="field-select" value={form.tipificacion} onChange={(e) => setField('tipificacion', e.target.value)}>
                {TIPIFICACIONES_TRAMO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="field-caret">▼</span>
            </div>
          </div>
        )}

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
