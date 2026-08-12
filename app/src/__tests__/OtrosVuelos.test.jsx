import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OtrosVuelos from '../pages/OtrosVuelos';
import { RegistroProvider, useRegistro } from '../context/RegistroContext';

function renderPage() {
  let captured;
  function Spy() {
    captured = useRegistro();
    return null;
  }
  const utils = render(
    <MemoryRouter initialEntries={['/otros-vuelos']}>
      <RegistroProvider>
        <Spy />
        <Routes>
          <Route path="/otros-vuelos" element={<OtrosVuelos />} />
          <Route path="/registro" element={<div>REGISTRO_PAGE</div>} />
        </Routes>
      </RegistroProvider>
    </MemoryRouter>,
  );
  return { ...utils, getCtx: () => captured };
}

describe('OtrosVuelos — catálogo de tipos', () => {
  it('lista "Verificación de Incivilidades" como opción seleccionable', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /verificación de incivilidades/i })).toBeInTheDocument();
  });

  it('mantiene todas las tipificaciones históricas (no rompe compatibilidad)', () => {
    renderPage();
    const esperadas = [
      'Informe Situacional',
      'Detección de Ruco',
      'Constancia de Servicio',
      'Monitoreo de Quebradas',
      'Sospechoso Interior de Domicilio',
      'Sospechoso en Vía Pública',
      'Robo en Lugar Habitado',
      'Robo en Lugar no Habitado',
      'Servicio Farellones',
    ];
    for (const t of esperadas) {
      expect(screen.getByRole('button', { name: new RegExp(t, 'i') })).toBeInTheDocument();
    }
  });

  it('al seleccionar "Verificación de Incivilidades" carga el tipo en el contexto y navega a /registro', () => {
    const { getCtx } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /verificación de incivilidades/i }));
    expect(screen.getByText('REGISTRO_PAGE')).toBeInTheDocument();
    const ctx = getCtx();
    expect(ctx.selectedTipoVuelo).toBe('Verificación de Incivilidades');
    expect(ctx.form.tipificacion).toBe('Verificación de Incivilidades');
    expect(ctx.selectedTramo).toBeNull();
  });
});
