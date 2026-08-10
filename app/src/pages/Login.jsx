import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

export default function Login() {
  const { session, signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signInWithPassword(email.trim(), password);
    setLoading(false);
    if (error) {
      const raw = error.message || '';
      if (/email not confirmed/i.test(raw)) {
        setError('El usuario existe pero el correo no está confirmado. En Supabase, recrea el usuario marcando "Auto Confirm User".');
      } else if (/invalid login credentials/i.test(raw)) {
        setError('Correo o contraseña incorrectos.');
      } else {
        setError(raw || 'No se pudo iniciar sesión. Intenta nuevamente.');
      }
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(178deg,#16233F 0%,#1C2E52 55%,#16233F 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '44px 30px 30px',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 26,
          animation: 'hkpop .5s ease both',
        }}
      >
        <div
          style={{
            width: 118,
            height: 118,
            borderRadius: '50%',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 6px rgba(238,107,30,.18), 0 0 0 1px rgba(238,107,30,.35), 0 18px 44px rgba(0,0,0,.4)',
          }}
        >
          <img
            src={logo}
            alt="Lo Barnechea Seguridad"
            style={{ width: 96, height: 96, objectFit: 'cover', objectPosition: 'left center', borderRadius: '50%' }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, letterSpacing: 3.5, color: '#EE6B1E', fontWeight: 700, marginBottom: 8 }}>
            SEGURIDAD · LO BARNECHEA
          </div>
          <div style={{ fontSize: 25, fontWeight: 700, color: '#fff', lineHeight: 1.18, letterSpacing: 0.2 }}>
            Sistema de Gestión
            <br />
            Operativa de Drones
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#EE6B1E', letterSpacing: 0.5, marginTop: 2 }}>
            HALCÓN
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          borderRadius: 22,
          padding: '22px 20px 24px',
          boxShadow: '0 20px 50px rgba(0,0,0,.3)',
          animation: 'hkpop .6s ease both',
        }}
      >
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#6B7480', margin: '0 0 7px 2px' }}>
          Correo institucional
        </label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="halcon1@lobarnechea.cl"
          style={{
            width: '100%',
            height: 52,
            border: '1.5px solid #D8DEE7',
            borderRadius: 13,
            padding: '0 16px',
            fontSize: 16,
            color: '#1B2431',
            background: '#F7F9FC',
            marginBottom: 16,
          }}
        />
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#6B7480', margin: '0 0 7px 2px' }}>
          Contraseña
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{
            width: '100%',
            height: 52,
            border: '1.5px solid #D8DEE7',
            borderRadius: 13,
            padding: '0 16px',
            fontSize: 16,
            color: '#1B2431',
            background: '#F7F9FC',
            marginBottom: error ? 10 : 20,
          }}
        />
        {error && (
          <div style={{ color: '#B03A2E', fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%' }}
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
          <span style={{ fontSize: 18 }}>→</span>
        </button>
      </form>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 16,
          color: 'rgba(255,255,255,.45)',
          fontSize: 11,
        }}
      >
        <span>Bitácora de Vuelo · v1.0</span>
      </div>
    </div>
  );
}
