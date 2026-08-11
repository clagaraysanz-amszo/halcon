import { createContext, useContext, useState } from 'react';

const RegistroContext = createContext(null);

export function blankForm() {
  return {
    altura: '',
    minutos: 20,
    distancia: 400,
    aeronave: 'DUAL',
    tipificacion: 'Paneo Preventivo',
    estado: 'Realizado',
    observaciones: '',
    horaInicio: '',
  };
}

// Estado efímero del flujo Selección de Tramo -> Registro -> Confirmación -> Éxito.
// Vive en memoria durante la sesión (no persiste al recargar), igual que en el prototipo.
export function RegistroProvider({ children }) {
  const [selectedTramo, setSelectedTramo] = useState(null);
  const [selectedPdo, setSelectedPdo] = useState(null); // fila de pdo_dia si vino de una asignación
  const [form, setForm] = useState(blankForm());
  const [lastFlight, setLastFlight] = useState(null);

  function startRegistro(tramo, pdoRow = null) {
    setSelectedTramo(tramo);
    setSelectedPdo(pdoRow);
    setForm({ ...blankForm(), horaInicio: nowHHMM() });
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setSelectedTramo(null);
    setSelectedPdo(null);
    setForm(blankForm());
  }

  const value = {
    selectedTramo,
    selectedPdo,
    form,
    setField,
    startRegistro,
    lastFlight,
    setLastFlight,
    reset,
  };

  return <RegistroContext.Provider value={value}>{children}</RegistroContext.Provider>;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function useRegistro() {
  const ctx = useContext(RegistroContext);
  if (!ctx) throw new Error('useRegistro debe usarse dentro de <RegistroProvider>');
  return ctx;
}
