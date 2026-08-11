import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { useCatalog } from '../context/CatalogContext';
import { fechaOperativaHoy, TURNOS, toISODate, formatFechaCorta } from '../lib/turnos';
import ScreenHeader from '../components/ScreenHeader';

const TURNO_OPTS = ['A', 'B', 'N'];

/** Parse 'YYYY-MM-DD' como fecha LOCAL (evita el bug de UTC que corre el día
 *  hacia atrás en zonas horarias negativas como Chile UTC-4). */
function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Suma N días a una fecha ISO manteniendo hora local. */
function addDaysISO(iso, days) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Extrae todo el texto de un Excel (todas las hojas, fila por fila) para que
 *  interpretarPDO pueda buscar los operadores de dron y sus sobrevuelos. */
function excelATexto(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const lineas = [];
  for (const nombre of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: false, defval: '' });
    for (const r of rows) {
      const linea = r.map((c) => String(c)).join(' ');
      if (linea.trim()) lineas.push(linea);
    }
  }
  return lineas.join('\n');
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

/** Normaliza texto para comparar nombres: sin acentos, en minúsculas. */
function normaliza(s) {
  return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Tokens de palabras (>=3 letras) de un texto. */
function tokensDe(s) {
  return normaliza(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}

/** Turno según la hora de inicio (README §5.4). N cubre 22:00–07:00. */
function turnoDeHora(hora) {
  const h = Number(String(hora).split(':')[0]);
  if (h >= 7 && h < 14) return 'A';
  if (h >= 14 && h < 22) return 'B';
  return 'N';
}

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Busca una fecha escrita "DD de MES de AAAA" dentro del texto del PDO. */
function fechaDesdeTexto(text) {
  const m = normaliza(text).match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (m && MESES[m[2]]) {
    return `${m[3]}-${String(MESES[m[2]]).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
  }
  return null;
}

/** Busca una fecha DD-MM-AAAA (o con . / _) en el nombre del archivo. */
function fechaDesdeNombre(name) {
  const m = String(name).match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/**
 * Interpreta el PDO COMPLETO pegado como texto. Por cada bloque "SOBREVUELOS…"
 * busca hacia atrás el nombre del operador de dron y lo empareja con la tabla
 * `operadores` por coincidencia de tokens (nombre y apellido, sin importar el
 * orden ni los acentos). El turno se deduce de la hora de cada sobrevuelo.
 * Devuelve { asignaciones: [{halcon_n, nombre, rows:[{tramo_n,hora,turno}]}], noReconocidos }.
 */
function interpretarPDO(text, operadores) {
  const ops = operadores
    .filter((o) => o.rol === 'Operador')
    .map((o) => ({ ...o, toks: tokensDe(o.nombre) }));
  const re = /SOBREVUELOS?/gi;
  const pos = [];
  let m;
  while ((m = re.exec(text)) !== null) pos.push(m.index);

  const asignaciones = [];
  const noReconocidos = [];
  for (let i = 0; i < pos.length; i++) {
    const start = pos[i];
    const end = i + 1 < pos.length ? pos[i + 1] : text.length;
    const { items } = parseSobrevuelos(text.slice(start, end));
    if (items.length === 0) continue; // bloque sin sectores (disposición, servicio colegio…)

    const winToks = tokensDe(text.slice(Math.max(0, start - 140), start));
    let best = null;
    let bestScore = 0;
    for (const o of ops) {
      const score = o.toks.filter((t) => winToks.includes(t)).length;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    // Requiere >=2 tokens (nombre + apellido) para evitar falsos positivos.
    if (!best || bestScore < 2) {
      noReconocidos.push(text.slice(Math.max(0, start - 45), start).replace(/\s+/g, ' ').trim());
      continue;
    }
    asignaciones.push({
      halcon_n: best.halcon_n,
      nombre: best.nombre,
      rows: items.map((it) => ({ ...it, turno: turnoDeHora(it.hora) })),
    });
  }
  return { asignaciones, noReconocidos };
}

export default function CargarPDO() {
  const navigate = useNavigate();
  const { operadores, tramosByN, operadoresByHalcon } = useCatalog();

  const [fecha, setFecha] = useState(fechaOperativaHoy());
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [pending, setPending] = useState([]);
  const [existing, setExisting] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  function removePending(idx) {
    setPending((p) => p.filter((_, i) => i !== idx));
  }

  function procesarTextoPdo(text, fechaUsar) {
    const f = fechaUsar || fecha;
    const { asignaciones, noReconocidos } = interpretarPDO(text, operadores);
    if (asignaciones.length === 0) {
      setResumen(null);
      setError('No se detectó ningún operador de dron con sobrevuelos en el archivo. Revisa que el PDO incluya las líneas "SOBREVUELOS: … SECTOR N".');
      return;
    }
    const nuevas = [];
    const detalle = [];
    const sectoresInexistentes = new Set();
    for (const a of asignaciones) {
      let n = 0;
      for (const r of a.rows) {
        if (!tramosByN.has(r.tramo_n)) {
          sectoresInexistentes.add(r.tramo_n);
          continue;
        }
        nuevas.push({ fecha: f, turno: r.turno, halcon_n: a.halcon_n, tramo_n: r.tramo_n, hora: r.hora });
        n += 1;
      }
      const turnos = [...new Set(a.rows.map((r) => r.turno))].join('/');
      detalle.push({ halcon_n: a.halcon_n, nombre: a.nombre, turno: turnos, count: n });
    }
    setPending((p) => [...p, ...nuevas]);
    setResumen({ fecha: f, detalle, noReconocidos, inexistentes: [...sectoresInexistentes] });
    setError('');
  }

  function handlePdoFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSuccess('');
    setResumen(null);
    setError('');
    setFileName(file.name);
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const texto = excelATexto(reader.result);
        // Fecha detectada del contenido o del nombre del archivo.
        const detectada = fechaDesdeTexto(texto) || fechaDesdeNombre(file.name);
        let fechaUsar = fecha; // por defecto, la fecha manualmente seleccionada
        if (detectada && detectada !== fecha) {
          // El Excel dice una fecha distinta a la elegida por el supervisor.
          // Pregunta cuál usar en vez de sobrescribir silenciosamente.
          const usarDetectada = window.confirm(
            `El Excel indica que corresponde al ${detectada}, pero tú seleccionaste ${fecha}.\n\n` +
              `¿Guardar el PDO en la fecha ${detectada} (la del Excel)?\n\n` +
              `Aceptar = usar ${detectada}\nCancelar = mantener ${fecha}`
          );
          if (usarDetectada) {
            fechaUsar = detectada;
            setFecha(detectada);
          }
        }
        procesarTextoPdo(texto, fechaUsar);
      } catch {
        setError('No se pudo leer el archivo. Sube el PDO en formato Excel (.xlsx o .xls).');
      } finally {
        setReading(false);
      }
    };
    reader.onerror = () => {
      setError('No se pudo leer el archivo.');
      setReading(false);
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmarYDistribuir() {
    if (pending.length === 0) {
      setError('Sube el PDO (Excel) e interprétalo antes de confirmar.');
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

  async function borrarPDO() {
    const pendientesCount = existing.filter((r) => r.estado === 'Pendiente').length;
    const realizadosCount = existing.length - pendientesCount;
    if (pendientesCount === 0) {
      setError(
        realizadosCount > 0
          ? `No hay sobrevuelos pendientes que borrar. Los ${realizadosCount} vuelos ya realizados quedan en el historial.`
          : 'No hay PDO cargado para esta fecha.'
      );
      return;
    }
    const msg =
      realizadosCount > 0
        ? `Vas a borrar ${pendientesCount} sobrevuelos pendientes de ${fecha}. Los ${realizadosCount} ya realizados se mantendrán en el historial. ¿Continuar?`
        : `Vas a borrar los ${pendientesCount} sobrevuelos del PDO de ${fecha}. Esta acción no se puede deshacer. ¿Continuar?`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    setError('');
    const { error } = await supabase
      .from('pdo_dia')
      .delete()
      .eq('fecha', fecha)
      .eq('estado', 'Pendiente');
    setDeleting(false);
    if (error) {
      setError('Error al borrar el PDO: ' + error.message);
      return;
    }
    setPending([]);
    setResumen(null);
    setFileName('');
    setSuccess(`PDO eliminado: ${pendientesCount} sobrevuelos borrados de ${fecha}.`);
  }

  return (
    <div className="screen">
      <ScreenHeader onBack={() => navigate('/supervisor')} title="Cargar PDO del día" subtitle="Plan de Despliegue Operativo" variant="dark" />

      <div className="content">
        <div style={{ fontSize: 13, color: 'var(--texto-secundario)', lineHeight: 1.5 }}>
          Sube el PDO del día (el archivo Excel): la app detecta a cada operador de dron por su nombre, deduce su turno
          por la hora de los sobrevuelos y le asigna sus vuelos. Quien no aparezca queda con día libre.
        </div>

        <div>
          <label className="field-label">Fecha operativa del PDO</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setFecha(addDaysISO(fecha, -1))}
              style={{ width: 44, height: 44, flex: 'none', borderRadius: 10, border: '1px solid var(--fondo-app)', background: '#fff', color: 'var(--texto-titulo)', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Día anterior"
            >
              ‹
            </button>
            <div style={{ flex: 1, textAlign: 'center', background: '#fff', border: '1px solid var(--fondo-app)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-titulo)' }}>
                {formatFechaCorta(parseISODate(fecha))}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--texto-tenue)', fontWeight: 600, marginTop: 1 }}>{fecha}</div>
            </div>
            <button
              type="button"
              onClick={() => setFecha(addDaysISO(fecha, 1))}
              style={{ width: 44, height: 44, flex: 'none', borderRadius: 10, border: '1px solid var(--fondo-app)', background: '#fff', color: 'var(--texto-titulo)', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Día siguiente"
            >
              ›
            </button>
          </div>
          <input
            type="date"
            className="field-input"
            value={fecha}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
            style={{ marginTop: 6, fontSize: 12 }}
          />
        </div>

        {existing.length > 0 && !success && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 20, flex: 'none', lineHeight: 1 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400E' }}>Ya hay PDO cargado para {fecha}</div>
              <div style={{ fontSize: 11.5, color: '#78350F', marginTop: 3, lineHeight: 1.45 }}>
                {existing.length} sobrevuelos existentes. Si subes otro Excel se <strong>duplicarán</strong>. Si vas a reemplazar el PDO, bórralo primero con el botón de abajo.
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 15 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 3 }}>Subir PDO del día</div>
          <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', marginBottom: 12, lineHeight: 1.45 }}>
            Sube el archivo Excel del PDO. La app lo lee, busca a cada <strong>Operador Drone</strong> por su nombre y le asigna sus sobrevuelos automáticamente.
          </div>

          <label
            className="card"
            style={{ border: '2px dashed var(--texto-placeholder)', background: reading ? '#FFF3EA' : '#F7F9FC', padding: '22px 16px', textAlign: 'center', cursor: reading ? 'default' : 'pointer', display: 'block', margin: 0 }}
          >
            <div style={{ fontSize: 30, marginBottom: 6 }}>📊</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--texto-titulo)' }}>
              {reading ? 'Leyendo el archivo…' : fileName || 'Toca para subir el PDO (Excel)'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', marginTop: 4 }}>Formatos .xlsx o .xls</div>
            {/* accept solo con extensiones: en Xiaomi/MIUI y algunos Android,
                los MIME types (incluido application/octet-stream) disparan el
                picker de galeria/camara. Con solo extensiones, Chrome Android
                abre el explorador de archivos y el .xlsx llega seleccionable. */}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handlePdoFile}
              disabled={reading}
              style={{ display: 'none' }}
            />
          </label>

          {resumen && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--fondo-app)', paddingTop: 11 }}>
              <div style={{ fontSize: 11.5, color: 'var(--texto-secundario)', marginBottom: 8 }}>
                Fecha del PDO: <strong style={{ color: 'var(--texto-titulo)' }}>{resumen.fecha}</strong> · se asignará a esta fecha (ajústala arriba si no corresponde).
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--texto-titulo)', marginBottom: 7 }}>Operadores detectados</div>
              {resumen.detalle.map((d) => (
                <div key={d.halcon_n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--texto-titulo)', padding: '3px 0' }}>
                  <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 7, background: 'var(--azul)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{d.halcon_n}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>Halcón {d.halcon_n} · {d.nombre}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto-secundario)', flex: 'none' }}>Turno {d.turno} · {d.count} vuelos</span>
                </div>
              ))}
              {resumen.inexistentes.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--ambar-texto)', marginTop: 6 }}>
                  Sectores omitidos (no existen entre los 69 tramos): {resumen.inexistentes.join(', ')}.
                </div>
              )}
              {resumen.noReconocidos.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--texto-tenue)', marginTop: 6 }}>
                  No se reconoció al operador en {resumen.noReconocidos.length} bloque(s). Revisa que el nombre del funcionario esté en el texto pegado.
                </div>
              )}
            </div>
          )}
        </div>

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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
          <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', fontWeight: 700, letterSpacing: 0.5 }}>
            DISTRIBUCIÓN ACTUAL PARA {fecha}
          </div>
          {existing.length > 0 && (
            <button
              onClick={borrarPDO}
              disabled={deleting}
              style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 8, cursor: deleting ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }}
            >
              {deleting ? 'Borrando…' : '🗑 Borrar PDO'}
            </button>
          )}
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
