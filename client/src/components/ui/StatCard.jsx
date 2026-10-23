// Small KPI tile: icon + big number + label (+ optional hint).
export default function StatCard({ icon, value, label, hint, tone = 'default' }) {
  return (
    <div className={`kpi-card tone-${tone}`}>
      {icon && <span className="kpi-icon">{icon}</span>}
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
    </div>
  );
}
