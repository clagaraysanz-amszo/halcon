// Captura de ubicación GPS al confirmar un vuelo (README §7 / requerimiento del cliente).
//
// "Silenciosa": ocurre automáticamente al confirmar, sin pantallas extra en la app.
// El navegador mostrará su propio diálogo de permiso la primera vez (inevitable y
// esperado). Nunca rechaza la promesa: si el usuario niega el permiso, el dispositivo
// no tiene GPS, o expira el tiempo, resuelve a `null` y el vuelo se guarda igual.
// La ubicación es un dato extra para el supervisor, no un requisito para registrar.
export function capturarUbicacion({ timeout = 8000 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        done({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        }),
      () => done(null), // permiso denegado / no disponible / timeout del navegador
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );

    // Respaldo defensivo por si el callback nativo nunca vuelve.
    setTimeout(() => done(null), timeout + 500);
  });
}

/**
 * URL a Google Maps para un punto. Devuelve `null` si no hay coordenadas,
 * para que el llamador pueda decidir si muestra el enlace o no.
 */
export function googleMapsUrl(lat, lng) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
