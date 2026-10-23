// Horizontal bar list: [{ label, value, sub }] — good for top dishes, zones, leaderboards.
export default function BarList({ items, format = (v) => v }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="bar-list">
      {items.map((i) => (
        <li key={i.label}>
          <div className="bar-label"><span>{i.label}</span><b>{format(i.value)}</b></div>
          <div className="bar-track"><span style={{ width: `${(i.value / max) * 100}%` }} /></div>
          {i.sub && <small className="muted">{i.sub}</small>}
        </li>
      ))}
    </ul>
  );
}
