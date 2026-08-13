import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ResumenSemanal from '../pages/ResumenSemanal';

vi.mock('../context/CatalogContext', () => ({
  useCatalog: () => ({
    operadoresByHalcon: new Map([['1', { nombre: 'Carlos Tapia' }]]),
  }),
}));

vi.mock('../hooks/useSupervisorWeekly', () => ({
  useSupervisorWeekly: () => ({
    loading: false,
    data: {
      weekDates: ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'],
      semanaLabel: '10–16 Ago 2026',
      porOperador: [
        {
          halconN: '1',
          totalVuelos: 5,
          totalMinutos: 120,
          totalAsignados: 6,
          totalRealizados: 5,
          totalNoRealizados: 1,
          tasa: 83,
          days: [
            { fecha: '2026-08-10', label: 'Lun', vuelos: 2, asignados: 2, realizados: 2 },
            { fecha: '2026-08-11', label: 'Mar', vuelos: 3, asignados: 4, realizados: 3 },
            { fecha: '2026-08-12', label: 'Mié', vuelos: 0, asignados: 0, realizados: 0 },
            { fecha: '2026-08-13', label: 'Jue', vuelos: 0, asignados: 0, realizados: 0 },
            { fecha: '2026-08-14', label: 'Vie', vuelos: 0, asignados: 0, realizados: 0 },
            { fecha: '2026-08-15', label: 'Sáb', vuelos: 0, asignados: 0, realizados: 0 },
            { fecha: '2026-08-16', label: 'Dom', vuelos: 0, asignados: 0, realizados: 0 },
          ],
        },
      ],
    },
  }),
}));

function SupervisorHomeStub() {
  const location = useLocation();
  return <div data-testid="supervisor-home">SUPERVISOR_HOME:{location.state?.fecha ?? 'sin-fecha'}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/supervisor/semanal']}>
      <Routes>
        <Route path="/supervisor/semanal" element={<ResumenSemanal />} />
        <Route path="/supervisor" element={<SupervisorHomeStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResumenSemanal — vista lista compacta y detalle por funcionario', () => {
  it('muestra la lista de operadores con stats resumidas', () => {
    renderPage();
    expect(screen.getByTestId('toggle-1')).toBeInTheDocument();
    expect(screen.getByText(/5 vuelos/)).toBeInTheDocument();
  });

  it('tocar un funcionario muestra su vista de detalle con chart y días', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('toggle-1'));
    expect(screen.getByTestId('mini-chart-1')).toBeInTheDocument();
    expect(screen.getByTestId('dia-1-2026-08-11')).toBeInTheDocument();
    expect(screen.queryByTestId('supervisor-home')).not.toBeInTheDocument();
  });

  it('tocar un día en el detalle navega al panel de supervisor con esa fecha', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('toggle-1'));
    fireEvent.click(screen.getByTestId('dia-1-2026-08-11'));
    expect(screen.getByTestId('supervisor-home')).toHaveTextContent('SUPERVISOR_HOME:2026-08-11');
  });

  it('un día sin actividad dentro del detalle está deshabilitado y no navega', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('toggle-1'));
    const diaVacio = screen.getByTestId('dia-1-2026-08-13');
    expect(diaVacio).toBeDisabled();
    fireEvent.click(diaVacio);
    expect(screen.queryByTestId('supervisor-home')).not.toBeInTheDocument();
  });

  it('el mini gráfico del detalle no contiene botones interactivos', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('toggle-1'));
    const miniChart = screen.getByTestId('mini-chart-1');
    expect(miniChart.querySelectorAll('button')).toHaveLength(0);
  });
});
