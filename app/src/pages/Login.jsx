import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

// Login por selección de Halcón (sin clave), según lo pedido por el cliente.
// El "correo" es un identificador interno halcon<N>@amszo.cl (no un buzón real)
// y la clave es una compartida, embebida, que el operador nunca ve ni escribe.
// La separación de datos por operador la sigue garantizando Supabase Auth + RLS.
// Los supervisores entran aparte, con correo + contraseña, para proteger el panel.
const DOMINIO_OPERADOR = 'amszo.cl';
const CLAVE_OPERADOR = 'HalconLB-2026';

// Etiquetas de los botones (solo visuales; el login funciona por número aunque
// cambie el nombre). Se mantienen alineadas con la tabla `operadores`.
const HALCONES = [
  { n: '1' },
  { n: '2' },
  { n: '3' },
  { n: '4' },
  { n: '5' },
  { n: '6' },
  { n: '7' },
];

export default function Login() {
  const { session, signInWithPassword } = useAuth();
  const [mode, setMode] = useState('operador'); // 'operador' | 'supervisor'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  if (session) return <Navigate to="/" replace />;

  function describirError(raw) {
    if (/email not confirmed/i.test(raw)) {
      return 'El usuario existe pero el correo no está confirmado. En Supabase, recréalo marcando "Auto Confirm User".';
    }
    if (/invalid login credentials/i.test(raw)) {
      return 'No se pudo iniciar sesión. Verifica que el usuario esté creado en Supabase Auth.';
    }
    return raw || 'No se pudo iniciar sesión. Intenta nuevamente.';
  }

  async function entrarComoHalcon(n) {
    setError('');
    setLoading(`h${n}`);
    const { error } = await signInWithPassword(`halcon${n}@${DOMINIO_OPERADOR}`, CLAVE_OPERADOR);
    setLoading('');
    if (error) setError(`No se pudo entrar como Halcón ${n}. ${describirError(error.message || '')}`);
  }

  async function entrarSupervisor(e) {
    e.preventDefault();
    setError('');
    setLoading('sup');
    const { error } = await signInWithPassword(email.trim(), password);
    setLoading('');
    if (error) setError(describirError(error.message || ''));
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(178deg,#16233F 0%,#1C2E52 55%,#16233F 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 24px 28px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, marginBottom: 22, animation: 'hkpop .5s ease both' }}>
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: '50%',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 6px rgba(238,107,30,.18), 0 0 0 1px rgba(238,107,30,.35), 0 18px 44px rgba(0,0,0,.4)',
          }}
        >
          <img src={logo} alt="Lo Barnechea Seguridad" style={{ width: 74, height: 74, objectFit: 'cover', objectPosition: 'left center', borderRadius: '50%' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#EE6B1E', fontWeight: 700, marginBottom: 6 }}>SEGURIDAD · LO BARNECHEA</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.18 }}>Sistema de Gestión Operativa de Drones</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#EE6B1E', letterSpacing: 0.5, marginTop: 2 }}>HALCÓN</div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 22, padding: '20px 18px 22px', boxShadow: '0 20px 50px rgba(0,0,0,.3)', animation: 'hkpop .6s ease both' }}>
        {mode === 'operador' ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16233F', marginBottom: 3, textAlign: 'center' }}>Selecciona tu Halcón</div>
            <div style={{ fontSize: 12, color: '#6B7480', marginBottom: 16, textAlign: 'center' }}>Toca tu operativo para ingresar</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {HALCONES.map((h) => (
                <button
                  key={h.n}
                  onClick={() => entrarComoHalcon(h.n)}
                  disabled={!!loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '11px 12px',
                    minHeight: 60,
                    border: '1.5px solid #D8DEE7',
                    borderRadius: 14,
                    background: loading === `h${h.n}` ? '#FFF3EA' : '#F7F9FC',
                    cursor: loading ? 'default' : 'pointer',
                    textAlign: 'left',
                    opacity: loading && loading !== `h${h.n}` ? 0.55 : 1,
                    transition: 'background .15s, opacity .15s',
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      flex: 'none',
                      borderRadius: 11,
                      background: 'linear-gradient(135deg,#F07D2E,#EE6B1E)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 800,
                    }}
                  >
                    {h.n}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#16233F' }}>Halcón {h.n}</span>
                  </span>
                </button>
              ))}
            </div>

            {error && <div style={{ color: '#B03A2E', fontSize: 12, fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{error}</div>}

            <button
              onClick={() => {
                setMode('supervisor');
                setError('');
              }}
              style={{ width: '100%', marginTop: 18, background: 'transparent', border: 'none', color: '#16233F', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Entrar como Supervisor
            </button>
          </>
        ) : (
          <form onSubmit={entrarSupervisor}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16233F', marginBottom: 3, textAlign: 'center' }}>Ingreso Supervisor</div>
            <div style={{ fontSize: 12, color: '#6B7480', marginBottom: 16, textAlign: 'center' }}>Correo institucional y contraseña</div>

            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#6B7480', margin: '0 0 7px 2px' }}>Correo institucional</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="supervisor@amszo.cl"
              style={{ width: '100%', height: 50, border: '1.5px solid #D8DEE7', borderRadius: 13, padding: '0 16px', fontSize: 16, color: '#1B2431', background: '#F7F9FC', marginBottom: 14 }}
            />
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#6B7480', margin: '0 0 7px 2px' }}>Contraseña</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', height: 50, border: '1.5px solid #D8DEE7', borderRadius: 13, padding: '0 16px', fontSize: 16, color: '#1B2431', background: '#F7F9FC', marginBottom: error ? 10 : 18 }}
            />
            {error && <div style={{ color: '#B03A2E', fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
            <button type="submit" disabled={loading === 'sup'} className="btn btn-primary" style={{ width: '100%' }}>
              {loading === 'sup' ? 'Ingresando…' : 'Ingresar'}
              <span style={{ fontSize: 18 }}>→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('operador');
                setError('');
              }}
              style={{ width: '100%', marginTop: 16, background: 'transparent', border: 'none', color: '#16233F', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              ← Volver a selección de Halcón
            </button>
          </form>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, color: 'rgba(255,255,255,.45)', fontSize: 11 }}>
        <span>Bitácora de Vuelo · v1.0</span>
      </div>
    </div>
  );
}
