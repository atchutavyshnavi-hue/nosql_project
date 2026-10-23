// Connection pill for a database: ● connected / ○ offline.
export default function ServiceBadge({ name, role, connected, detail }) {
  return (
    <div className={`service-card ${connected ? 'on' : 'off'}`}>
      <div className="service-top">
        <b>{name}</b>
        <span className="service-dot">{connected ? '● Connected' : '○ Offline'}</span>
      </div>
      <p className="muted small">{role}</p>
      {detail && <small>{detail}</small>}
    </div>
  );
}
