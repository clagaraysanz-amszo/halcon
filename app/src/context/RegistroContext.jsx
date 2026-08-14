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
    turno: '',
    ubicacionManual: '',
  };
}

export function RegistroProvider({ children, initialLastFlight = null }) {
  const [selectedTramo, setSelectedTramo] = useState(null);
  const [selectedPdo, setSelectedPdo] = useState(null);
  const [selectedTipoVuelo, setSelectedTipoVuelo] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [lastFlight, setLastFlight] = useState(initialLastFlight);

  function startRegistro(tramo, pdoRow = null) {
    setSelectedTramo(tramo);
    setSelectedPdo(pdoRow);
    setSelectedTipoVuelo(null);
    setForm({ ...blankForm(), horaInicio: nowHHMM(), tipificacion: 'Paneo Preventivo', turno: pdoRow?.turno || '' });
  }

  function startOtroVuelo(tipo) {
    setSelectedTramo(null);
    setSelectedPdo(null);
    setSelectedTipoVuelo(tipo);
    setForm({ ...blankForm(), horaInicio: nowHHMM(), tipificacion: tipo });
  }

  // Sobrevuelo asignado por el PDO pero sin tramo/sector puntual (p.ej. días
  // de lluvia donde solo se asigna "vigilancia general" de zona). Reutiliza
  // el flujo de "Otro Vuelo" pero conserva el link al pdoRow para que al
  // confirmar se marque Realizado en pdo_dia igual que un tramo normal.
  function startVigilanciaGeneral(pdoRow) {
    setSelectedTramo(null);
    setSelectedPdo(pdoRow);
    setSelectedTipoVuelo('Vigilancia General (Dron)');
    setForm({
      ...blankForm(),
      horaInicio: nowHHMM(),
      tipificacion: 'Vigilancia General (Dron)',
      turno: pdoRow?.turno || '',
      ubicacionManual: pdoRow?.descripcion || '',
    });
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setSelectedTramo(null);
    setSelectedPdo(null);
    setSelectedTipoVuelo(null);
    setForm(blankForm());
  }

  const value = {
    selectedTramo,
    selectedPdo,
    selectedTipoVuelo,
    form,
    setField,
    startRegistro,
    startOtroVuelo,
    startVigilanciaGeneral,
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
