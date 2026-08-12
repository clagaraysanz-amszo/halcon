import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Exito from '../pages/Exito';
import { RegistroProvider } from '../context/RegistroContext';

function Location() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}</div>;
}

function renderExito(lastFlight) {
  return render(
    <MemoryRouter initialEntries={['/registro/exito']}>
      <RegistroProvider initialLastFlight={lastFlight}>
        <Routes>
          <Route path="/registro/exito" element={<Exito />} />
          <Route path="/inicio" element={<div>INICIO_PAGE</div>} />
          <Route path="/tramos" element={<div>TRAMOS_PAGE</div>} />
          <Route path="/otros-vuelos" element={<div>OTROS_VUELOS_PAGE</div>} />
        </Routes>
        <Location />
      </RegistroProvider>
    </MemoryRouter>,
  );
}

describe('Exito — vuelo desde un TRAMO', () => {
  const tramoFlight = { tramo_n: 42, nombre: 'La Dehesa Alta' };

  it('muestra título "Tramo registrado correctamente"', () => {
    renderExito(tramoFlight);
    const titulo = screen.getByTestId('exito-titulo');
    expect(titulo).toHaveTextContent(/tramo registrado/i);
    expect(titulo).toHaveTextContent(/correctamente/i);
  });

  it('muestra el número y nombre del tramo en el detalle', () => {
    renderExito(tramoFlight);
    expect(screen.getByTestId('exito-detalle')).toHaveTextContent('Tramo 42 · La Dehesa Alta');
  });

  it('el botón secundario dice "Registrar otro tramo" y navega a /tramos', () => {
    renderExito(tramoFlight);
    const btn = screen.getByTestId('exito-registrar-otro');
    expect(btn).toHaveTextContent(/registrar otro tramo/i);
    fireEvent.click(btn);
    expect(screen.getByText('TRAMOS_PAGE')).toBeInTheDocument();
  });
});

describe('Exito — vuelo desde OTROS VUELOS (regresión de navegación)', () => {
  const otroFlight = { tramo_n: null, nombre: 'Verificación de Incivilidades' };

  it('BUG-FIX #1: título dice "Vuelo registrado correctamente" (NO "Tramo registrado")', () => {
    renderExito(otroFlight);
    const titulo = screen.getByTestId('exito-titulo');
    expect(titulo).toHaveTextContent(/vuelo registrado/i);
    expect(titulo).not.toHaveTextContent(/tramo registrado/i);
  });

  it('BUG-FIX #2: el detalle NO empieza con "Tramo" ni contiene "undefined" / "null"', () => {
    renderExito(otroFlight);
    const detalle = screen.getByTestId('exito-detalle');
    expect(detalle).toHaveTextContent('Verificación de Incivilidades');
    expect(detalle.textContent.toLowerCase()).not.toContain('undefined');
    expect(detalle.textContent.toLowerCase()).not.toContain('null');
    expect(detalle.textContent).not.toMatch(/^\s*Tramo/);
  });

  it('BUG-FIX #3: "Registrar otro vuelo" navega a /otros-vuelos, no a /tramos', () => {
    renderExito(otroFlight);
    const btn = screen.getByTestId('exito-registrar-otro');
    expect(btn).toHaveTextContent(/registrar otro vuelo/i);
    fireEvent.click(btn);
    expect(screen.getByText('OTROS_VUELOS_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('TRAMOS_PAGE')).not.toBeInTheDocument();
  });
});

describe('Exito — protección de ruta', () => {
  it('sin lastFlight redirige a /inicio (evita pantalla vacía si el usuario recarga)', () => {
    renderExito(null);
    expect(screen.getByText('INICIO_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent('/inicio');
  });

  it('"Volver al inicio" navega a /inicio y limpia el contexto', () => {
    renderExito({ tramo_n: 7, nombre: 'Los Trapenses' });
    fireEvent.click(screen.getByTestId('exito-volver'));
    expect(screen.getByText('INICIO_PAGE')).toBeInTheDocument();
  });
});
