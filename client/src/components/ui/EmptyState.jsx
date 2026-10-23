export default function EmptyState({ icon = '📭', title, children }) {
  return (
    <div className="empty-panel">
      <span className="empty-icon">{icon}</span>
      {title && <b>{title}</b>}
      {children && <p className="muted small">{children}</p>}
    </div>
  );
}
