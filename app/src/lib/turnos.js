// Reglas de negocio de turnos — ver README §5.
// Turno A: 07:00–14:00 · B: 14:00–22:00 · N: 22:00–07:00 (cruza medianoche).
// El PDO se fecha por el día en que INICIA el turno, por lo que el límite
// operativo del día completo (los 3 turnos) es las 07:00, no la medianoche.

export const TURNOS = {
  A: { label: 'Mañana', horas: '07:00–14:00', dotColor: '#EE6B1E' },
  B: { label: 'Tarde', horas: '14:00–22:00', dotColor: '#2C6FB5' },
  N: { label: 'Noche', horas: '22:00–07:00', dotColor: '#6B5FB0' },
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Formatea un Date a 'YYYY-MM-DD' en hora LOCAL (no UTC). */
export function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Fecha operativa "de hoy": antes de las 07:00 todavía corresponde al día
 * operativo anterior (cola del turno Noche, que se fechó al iniciar a las
 * 22:00 del día anterior). Devuelve un string 'YYYY-MM-DD'.
 */
export function fechaOperativaHoy(now = new Date()) {
  const base = now.getHours() < 7 ? addDays(now, -1) : now;
  return toISODate(base);
}

/** Turno vigente según la hora actual (para mostrar en UI, referencial). */
export function turnoVigente(now = new Date()) {
  const h = now.getHours();
  if (h >= 7 && h < 14) return 'A';
  if (h >= 14 && h < 22) return 'B';
  return 'N';
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatFechaCorta(date = new Date()) {
  return `${DIAS[date.getDay()]} ${pad2(date.getDate())} ${MESES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatHoraActual(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Compara dos filas de PDO por hora, respetando el orden real del turno noche
 * (22:xx → 23:xx → 00:xx → … → 06:xx).
 */
export function compararHoraTurno(horaA, horaB, turno) {
  const toMin = (h) => {
    const [hh, mm] = h.split(':').map(Number);
    if (turno === 'N' && hh < 7) return (hh + 24) * 60 + mm;
    return hh * 60 + mm;
  };
  return toMin(horaA) - toMin(horaB);
}
