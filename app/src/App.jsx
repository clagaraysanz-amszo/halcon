import { BrowserRouter, Navigate, Route, Routes, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { RegistroProvider } from './context/RegistroContext';
import { RequireAuth, RequireSupervisor } from './components/RouteGuards';
import FullscreenLoader from './components/FullscreenLoader';

import Login from './pages/Login';
import Home from './pages/Home';
import MisVuelos from './pages/MisVuelos';
import SeleccionTramo from './pages/SeleccionTramo';
import RegistroVuelo from './pages/RegistroVuelo';
import Confirmacion from './pages/Confirmacion';
import Exito from './pages/Exito';
import HistorialDia from './pages/HistorialDia';
import CargarPDO from './pages/CargarPDO';
import PanelSupervision from './pages/PanelSupervision';
import OtrosVuelos from './pages/OtrosVuelos';

function RootRedirect() {
  const { loading, isSupervisor } = useAuth();
  if (loading) return <FullscreenLoader />;
  return <Navigate to={isSupervisor ? '/supervisor' : '/inicio'} replace />;
}

function ProtectedLayout() {
  return (
    <CatalogProvider>
      <RegistroProvider>
        <div className="app-shell">
          <Outlet />
        </div>
      </RegistroProvider>
    </CatalogProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/inicio" element={<Home />} />
              <Route path="/mis-vuelos" element={<MisVuelos />} />
              <Route path="/tramos" element={<SeleccionTramo />} />
              <Route path="/registro" element={<RegistroVuelo />} />
              <Route path="/registro/confirmar" element={<Confirmacion />} />
              <Route path="/registro/exito" element={<Exito />} />
              <Route path="/otros-vuelos" element={<OtrosVuelos />} />
              <Route path="/historial" element={<HistorialDia />} />

              <Route element={<RequireSupervisor />}>
                <Route path="/supervisor" element={<PanelSupervision />} />
                <Route path="/supervisor/pdo" element={<CargarPDO />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
