// Section title with optional subtitle, badge (e.g. which database powers it) and right-side action.
export default function SectionHeader({ title, subtitle, badge, action }) {
  return (
    <div className="section-header">
      <div>
        <h3>{title}{badge && <span className="engine-badge">{badge}</span>}</h3>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
