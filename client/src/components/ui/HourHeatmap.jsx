// 24-cell strip showing how busy each hour of the day is (darker = more orders).
export default function HourHeatmap({ data, label }) {
  const max = Math.max(1, ...data.map((d) => d.orders));
  const fmt = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
  return (
    <div className="heatmap" role="img" aria-label={label}>
      {data.map((d) => (
        <div key={d.hour} className="heat-cell" title={`${fmt(d.hour)} — ${d.orders}`}
          style={{ background: d.orders ? `rgba(255, 90, 31, ${0.15 + 0.85 * (d.orders / max)})` : '#f3f4f6' }}>
          <small>{d.hour % 3 === 0 ? fmt(d.hour) : ''}</small>
        </div>
      ))}
    </div>
  );
}
