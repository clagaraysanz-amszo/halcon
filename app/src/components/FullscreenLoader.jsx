export default function FullscreenLoader({ label = 'Cargando…' }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--texto-secundario)',
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {label}
    </div>
  );
}
