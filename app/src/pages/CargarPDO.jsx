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

/**
 * Interpreta la línea "SOBREVUELOS: ..." tal cual del PDO diario y extrae los
 * sobrevuelos de sector. Cada tramo del texto se separa por "/". Se toma como
 * hora la PRIMERA hora del segmento (la de inicio) y como tramo el número que
 * sigue a "SECTOR". Los segmentos sin "SECTOR" (disposición, servicio colegio,
 * etc.) se ignoran. Devuelve { items: [{tramo_n, hora}], skipped }.
 *
 * Ej.: "SOBREVUELOS: 07:15 A 08:00 DISPOSICION J.O RPA / SERVICIO COLEGIO /
 *       09:10 A 10:00 HRS. SECTOR 68 / 10:30 A 11:00 HRS. SECTOR. 15"
 *   -> [{tramo_n:68, hora:'09:10'}, {tramo_n:15, hora:'10:30'}]
 */
function parseSobrevuelos(text) {
  const chunks = String(text).split('/');
  const items = [];
  let skipped = 0;
  for (const chunk of chunks) {
    const sectorMatch = chunk.match(/SECTOR\.?\s*(\d{1,3})/i);
    if (!sectorMatch) continue; // no es un sobrevuelo de sector
    const timeMatch = chunk.match(/(\d{1,2}):(\d{2})/); // primera hora = inicio
    if (!timeMatch) {
      skipped++;
      continue;
    }
    const hora = `${String(Number(timeMatch[1])).padStart(2, '0')}:${timeMatch[2]}`;
    items.push({ tramo_n: Number(sectorMatch[1]), hora });
  }
  return { items, skipped };
}

export default function CargarPDO() {
  const navigate = useNavigate();
  const { operadores, tramosByN, operadoresByHalcon } = useCatalog();
  const operadoresOperativos = useMemo(() => operadores.filter((o) => o.rol === 'Operador'), [operadores]);

  const [fecha, setFecha] = useState(fechaOperativaHoy());
  const [draft, setDraft] = useState(blankDraft());
  const [pega, setPega] = useState({ turno: 'A', halconN: '', text: '' });
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

  function agregarSobrevuelos() {
    if (!pega.halconN) {
      setError('Selecciona el funcionario (Halcón) antes de interpretar los sobrevuelos.');
      return;
    }
    const { items } = parseSobrevuelos(pega.text);
    if (items.length === 0) {
      setError('No se detectaron sobrevuelos con "SECTOR N" en el texto. Revisa que hayas pegado la línea completa de SOBREVUELOS.');
      return;
    }
    const nuevas = [];
    const inexistentes = [];
    for (const it of items) {
      if (!tramosByN.has(it.tramo_n)) {
        inexistentes.push(it.tramo_n);
        continue;
      }
      nuevas.push({ fecha, turno: pega.turno, halcon_n: pega.halconN, tramo_n: it.tramo_n, hora: it.hora });
    }
    setPending((p) => [...p, ...nuevas]);
    setPega((s) => ({ ...s, text: '' }));
    if (inexistentes.length) {
      setError(`Se agregaron ${nuevas.length} sobrevuelos. Se omitieron sectores que no existen entre los 69 tramos: ${inexistentes.join(', ')}.`);
    } else {
      setError('');
    }
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
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 3 }}>Pegar sobrevuelos del PDO</div>
          <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', marginBottom: 10, lineHeight: 1.45 }}>
            Elige turno y funcionario, y pega la línea <strong>SOBREVUELOS: …</strong> tal cual del PDO. La app detecta cada “SECTOR N” con su hora de inicio e ignora lo demás (disposición, servicio colegio…).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <select className="field-select" style={{ height: 44 }} value={pega.turno} onChange={(e) => setPega((s) => ({ ...s, turno: e.target.value }))}>
              {TURNO_OPTS.map((t) => (
                <option key={t} value={t}>
                  Turno {t} · {TURNOS[t].label}
                </option>
              ))}
            </select>
            <select className="field-select" style={{ height: 44 }} value={pega.halconN} onChange={(e) => setPega((s) => ({ ...s, halconN: e.target.value }))}>
              <option value="">Halcón…</option>
              {operadoresOperativos.map((o) => (
                <option key={o.halcon_n} value={o.halcon_n}>
                  Halcón {o.halcon_n} · {o.nombre}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="field-textarea"
            style={{ minHeight: 84, marginBottom: 8 }}
            value={pega.text}
            onChange={(e) => setPega((s) => ({ ...s, text: e.target.value }))}
            placeholder="SOBREVUELOS: 09:10 A 10:00 HRS. SECTOR 68 / 10:30 A 11:00 HRS. SECTOR 15 / 11:30 A 12:00 HRS. SECTOR 31 …"
          />
          <button onClick={agregarSobrevuelos} className="btn btn-primary" style={{ width: '100%', height: 44 }}>
            Interpretar y agregar
          </button>
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
