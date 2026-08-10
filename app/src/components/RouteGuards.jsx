import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FullscreenLoader from './FullscreenLoader';

export function RequireAuth() {
  const { session, operador, loading } = useAuth();

  if (loading) return <FullscreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (operador === null) {
    // Sesión válida en Supabase Auth pero sin fila en `operadores` (email no
    // coincide con ningún halcon_n). No hay rol que asignarle.
    return <FullscreenLoader label="Tu usuario no está vinculado a ningún operador. Contacta al supervisor." />;
  }
  return <Outlet />;
}

// Bloquea el Panel de Supervisión y Cargar PDO a operadores, también a
// nivel de UI (además de RLS, que ya lo bloquea a nivel de datos).
export function RequireSupervisor() {
  const { isSupervisor } = useAuth();
  if (!isSupervisor) return <Navigate to="/inicio" replace />;
  return <Outlet />;
}
