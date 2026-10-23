import { useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import VegDot from './ui/VegDot';

// Expandable "customers also ordered" chips under a menu item — Neo4j.
export default function AlsoOrdered({ dishId, onAdd }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      try {
        const { data } = await api.get(`/graph/dishes/${dishId}/also-ordered`);
        setItems(data.data.available ? data.data.items : []);
      } catch { setItems([]); }
    }
  }

  return (
    <div className="also-ordered">
      <button type="button" className="btn-link also-toggle" onClick={toggle}>
        👥 {t('also.toggle')} {open ? '▴' : '▾'}
      </button>
      {open && (
        items === null ? <small className="muted">{t('common.loading')}</small>
        : items.length === 0 ? <small className="muted">{t('also.none')}</small>
        : (
          <div className="chip-row">
            {items.map((i) => (
              <button type="button" key={i._id} className="chip small" onClick={() => onAdd && onAdd(i)} disabled={!i.isAvailable}>
                <VegDot veg={i.isVeg} /> {i.name} · ₹{i.price} <small>(+)</small>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
