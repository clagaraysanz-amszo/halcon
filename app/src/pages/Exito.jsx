import { Navigate, useNavigate } from 'react-router-dom';
import { useRegistro } from '../context/RegistroContext';

export default function Exito() {
  const { lastFlight, reset } = useRegistro();
  const navigate = useNavigate();

  if (!lastFlight) return <Navigate to="/inicio" replace />;

  function volverInicio() {
    reset();
    navigate('/inicio');
  }

  function registrarOtro() {
    reset();
    navigate('/tramos');
  }

  return (
    <div
      style={{
        minHeight: '100%',
        background: 'linear-gradient(175deg,#16233F,#1E3057)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 30px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 112,
          height: 112,
          borderRadius: '50%',
          background: 'var(--verde-ok)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 16px 40px rgba(30,135,75,.45)',
          animation: 'hkcheck .5s cubic-bezier(.2,1.3,.5,1) both',
        }}
      >
        <svg width="58" height="58" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: '#fff', marginTop: 26 }}>
        Tramo registrado
        <br />
        correctamente
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', marginTop: 12, lineHeight: 1.5 }}>
        Tramo {lastFlight.tramo_n} · {lastFlight.nombre}
        <br />
        registrado en la bitácora del día
      </div>
      <button onClick={volverInicio} className="btn btn-primary" style={{ marginTop: 40, width: '100%' }}>
        Volver al inicio
      </button>
      <button onClick={registrarOtro} className="btn-ghost btn" style={{ marginTop: 12, color: 'rgba(255,255,255,.75)', background: 'transparent' }}>
        Registrar otro tramo
      </button>
    </div>
  );
}
