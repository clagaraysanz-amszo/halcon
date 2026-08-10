import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useCatalog } from '../context/CatalogContext';
import { fechaOperativaHoy, TURNOS } from '../lib/turnos';
import ScreenHeader from '../components/ScreenHeader';

const TURNO_OPTS = ['A', 'B', 'N'];

function blankDraft() {
  return { turno: 'A', halconN: '', tramoN: '', hora: '' };
}

/**
 * Parsea el CSV de datos/PDO_Dia_ejemplo.csv: Fecha,Turno,HalconN,TramoN,Hora
 * Valida cada fila y descarta las inválidas. Si el archivo es binario (p.ej.
 * subieron un .xlsx en vez de un .csv), lanza 'BINARIO'.
 * Devuelve { rows, invalid }.
 */
function parsePdoCsv(text) {
  // Bytes de control (excepto tab/CR/LF) => no es texto CSV, es un binario.
  if (/[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 4000))) {
    throw new Error('BINARIO');
  }
  const lines = text.trim().split(/\r?\n/);
  const rows = [];
  let invalid = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if ((cols[0] || '').toLowerCase() === 'fecha') continue; // encabezado
    const [fecha, turno, halconN, tramoN, hora] = cols;
    const tramoNum = Number(tramoN);
    const valida =
      /^\d{4}-\d{2}-\d{2}$/.test(fecha || '') &&
      ['A', 'B', 'N'].includes((turno || '').toUpperCase()) &&
      !!halconN &&
      Number.isInteger(tramoNum) &&
      tramoNum >= 1 &&
      tramoNum <= 69 &&
      /^\d{1,2}:\d{2}$/.test(hora || '');
    if (!valida) {
      invalid++;
      continue;
    }
    rows.push({ fecha, turno: turno.toUpperCase(), halcon_n: halconN, tramo_n: tramoNum, hora });
  }
  return { rows, invalid };
}

export default function CargarPDO() {
  const navigate = useNavigate();
  const { operadores, tramosByN, operadoresByHalcon } = useCatalog();
  const operadoresOperativos = useMemo(() => operadores.filter((o) => o.rol === 'Operador'), [operadores]);

  const [fecha, setFecha] = useState(fechaOperativaHoy());
  const [draft, setDraft] = useState(blankDraft());
  const [pending, setPending] = useState([]);
  const [existing, setExisting] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingExisting(true);
    supabase
      .from('pdo_dia')
      .select('*')
      .eq('fecha', fecha)
      .order('hora')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setExisting(data ?? []);
        setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fecha, success]);

  const distribucion = useMemo(() => {
    const porTurno = { A: [], B: [], N: [] };
    existing.forEach((r) => porTurno[r.turno]?.push(r));
    return TURNO_OPTS.map((turno) => {
      const rows = porTurno[turno];
      const porOperador = new Map();
      rows.forEach((r) => porOperador.set(r.halcon_n, (porOperador.get(r.halcon_n) ?? 0) + 1));
      return { turno, count: rows.length, operadores: [...porOperador.entries()] };
    });
  }, [existing]);

  function addDraft() {
    if (!draft.halconN || !draft.tramoN || !draft.hora) {
      setError('Completa halcón, tramo y hora antes de agregar la fila.');
      return;
    }
    setError('');
    setPending((p) => [...p, { fecha, turno: draft.turno, halcon_n: draft.halconN, tramo_n: Number(draft.tramoN), hora: draft.hora }]);
    setDraft((d) => ({ ...blankDraft(), turno: d.turno }));
  }

  function removePending(idx) {
    setPending((p) => p.filter((_, i) => i !== idx));
  }

  function handleCsvFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { rows, invalid } = parsePdoCsv(String(reader.result));
        if (rows.length === 0) {
          setError('No se encontraron filas válidas. El archivo debe ser un CSV de texto con columnas Fecha,Turno,HalconN,TramoN,Hora (no un Excel .xlsx).');
          return;
        }
        setPending((p) => [...p, ...rows]);
        setError(invalid > 0 ? `Se importaron ${rows.length} filas; se omitieron ${invalid} con formato inválido.` : '');
      } catch (err) {
        if (err.message === 'BINARIO') {
          setError('Ese archivo no es un CSV de texto (parece un Excel .xlsx u otro binario). Guárdalo como CSV, o carga las filas manualmente con "+ Agregar fila".');
        } else {
          setError('No se pudo leer el archivo CSV. Verifica el formato (Fecha,Turno,HalconN,TramoN,Hora).');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function confirmarYDistribuir() {
    if (pending.length === 0) {
      setError('Agrega al menos una fila (manualmente o desde un CSV) antes de confirmar.');
      return;
    }
    setSaving(true);
    setError('');
    const { error } = await supabase.from('pdo_dia').insert(pending);
    setSaving(false);
    if (error) {
      setError('Error al guardar el PDO: ' + error.message);
      return;
    }
    setPending([]);
    setSuccess(`PDO distribuido: ${pending.length} filas agregadas para ${fecha}.`);
  }

  return (
    <div className="screen">
      <ScreenHeader onBack={() => navigate('/supervisor')} title="Cargar PDO del día" subtitle="Plan de Despliegue Operativo" variant="dark" />

      <div className="content">
        <div style={{ fontSize: 13, color: 'var(--texto-secundario)', lineHeight: 1.5 }}>
          Agrega las filas del PDO (fecha, turno, halcón, tramo y hora). El sistema asignará automáticamente los
          sobrevuelos a cada operador según su turno.
        </div>

        <div>
          <label className="field-label">Fecha operativa del PDO</label>
          <input type="date" className="field-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>

        <div className="card" style={{ padding: 15 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 10 }}>Agregar fila manualmente</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <select className="field-select" style={{ height: 44 }} value={draft.turno} onChange={(e) => setDraft((d) => ({ ...d, turno: e.target.value }))}>
              {TURNO_OPTS.map((t) => (
                <option key={t} value={t}>
                  Turno {t} · {TURNOS[t].label}
                </option>
              ))}
            </select>
            <select className="field-select" style={{ height: 44 }} value={draft.halconN} onChange={(e) => setDraft((d) => ({ ...d, halconN: e.target.value }))}>
              <option value="">Halcón…</option>
              {operadoresOperativos.map((o) => (
                <option key={o.halcon_n} value={o.halcon_n}>
                  Halcón {o.halcon_n} · {o.nombre}
                </option>
              ))}
            </select>
            <select className="field-select" style={{ height: 44 }} value={draft.tramoN} onChange={(e) => setDraft((d) => ({ ...d, tramoN: e.target.value }))}>
              <option value="">Tramo…</option>
              {[...tramosByN.values()].map((t) => (
                <option key={t.tramo_n} value={t.tramo_n}>
                  {t.tramo_n} · {t.nombre}
                </option>
              ))}
            </select>
            <input type="time" className="field-input" style={{ height: 44 }} value={draft.hora} onChange={(e) => setDraft((d) => ({ ...d, hora: e.target.value }))} />
          </div>
          <button onClick={addDraft} className="btn btn-outline" style={{ width: '100%', height: 44 }}>
            + Agregar fila
          </button>
        </div>

        <label className="card" style={{ border: '2px dashed var(--texto-placeholder)', background: '#F7F9FC', padding: '20px 16px', textAlign: 'center', cursor: 'pointer', display: 'block' }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>📄</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--texto-titulo)' }}>O importar desde CSV</div>
          <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', marginTop: 4 }}>Columnas: Fecha,Turno,HalconN,TramoN,Hora</div>
          <input type="file" accept=".csv" onChange={handleCsvFile} style={{ display: 'none' }} />
        </label>

        {pending.length > 0 && (
          <div className="card" style={{ padding: 15 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 10 }}>
              Filas por guardar ({pending.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {pending.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--texto-titulo)' }}>
                  <span style={{ fontWeight: 700 }}>{r.turno}</span>
                  <span>Halcón {r.halcon_n}</span>
                  <span style={{ flex: 1 }}>Tramo {r.tramo_n} · {tramosByN.get(r.tramo_n)?.nombre ?? '—'}</span>
                  <span style={{ color: 'var(--texto-secundario)' }}>{r.hora}</span>
                  <button onClick={() => removePending(i)} style={{ border: 'none', background: 'transparent', color: 'var(--rojo)', cursor: 'pointer', fontSize: 16 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ color: 'var(--rojo)', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
        {success && (
          <div className="card" style={{ background: 'var(--verde-fondo-2)', borderColor: 'var(--verde-borde)', padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--verde-ok)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none' }}>
              ✓
            </span>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--verde-ok)' }}>{success}</div>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 700, letterSpacing: 0.5, marginTop: 4 }}>
          DISTRIBUCIÓN ACTUAL PARA {fecha}
        </div>
        {!loadingExisting &&
          distribucion.map((p) => (
            <div key={p.turno} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 11, background: 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800 }}>
                {p.turno}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--texto-titulo)' }}>
                  {TURNOS[p.turno].label} · {TURNOS[p.turno].horas}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--texto-secundario)', marginTop: 1 }}>
                  {p.operadores.length === 0
                    ? 'Sin asignaciones'
                    : p.operadores.map(([hn, c]) => `Halcón ${hn} (${operadoresByHalcon.get(hn)?.nombre ?? hn}): ${c}`).join(' · ')}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--naranjo)' }}>{p.count} vuelos</span>
            </div>
          ))}

        <div className="spacer" />
        <button onClick={confirmarYDistribuir} disabled={saving} className="btn btn-primary" style={{ width: '100%' }}>
          {saving ? 'Guardando…' : 'Confirmar y distribuir PDO'}
        </button>
      </div>
    </div>
  );
}
