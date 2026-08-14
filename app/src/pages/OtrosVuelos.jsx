import { useNavigate } from 'react-router-dom';
import { useRegistro } from '../context/RegistroContext';
import ScreenHeader from '../components/ScreenHeader';

const OTROS_TIPOS = [
  { tipo: 'Informe Situacional', icono: '📄' },
  { tipo: 'Detección de Ruco', icono: '🔍' },
  { tipo: 'Verificación de Incivilidades', icono: '⚠️' },
  { tipo: 'Constancia de Servicio', icono: '📋' },
  { tipo: 'Monitoreo de Quebradas', icono: '🏔' },
  { tipo: 'Sospechoso Interior de Domicilio', icono: '🏠' },
  { tipo: 'Sospechoso en Vía Pública', icono: '🚶' },
  { tipo: 'Robo en Lugar Habitado', icono: '🚨' },
  { tipo: 'Robo en Lugar no Habitado', icono: '🔒' },
  { tipo: 'Servicio Farellones', icono: '⛰' },
];

export default function OtrosVuelos() {
  const { startOtroVuelo } = useRegistro();
  const navigate = useNavigate();

  function seleccionar(tipo) {
    startOtroVuelo(tipo);
    navigate('/registro');
  }

  return (
    <div className="screen">
      <ScreenHeader onBack={true} title="Otros Vuelos" subtitle="Selecciona el tipo de vuelo a registrar" />

      <div className="content content--tight">
        <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 700, letterSpacing: 0.5, margin: '2px 2px 0' }}>
          TIPOS DE VUELO
        </div>

        <div className="list-grid">
        {OTROS_TIPOS.map(({ tipo, icono }) => (
          <button
            key={tipo}
            onClick={() => seleccionar(tipo)}
            className="list-item"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--borde-1)' }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                flex: 'none',
                borderRadius: 13,
                background: tipo === 'Servicio Farellones' ? '#DBEAFE' : '#F3F0FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              {icono}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)', lineHeight: 1.2 }}>
                {tipo}
              </div>
            </div>
            <span style={{ color: 'var(--texto-placeholder)', fontSize: 16 }}>›</span>
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}
