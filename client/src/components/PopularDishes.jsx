import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import FoodImage from './FoodImage';
import VegDot from './ui/VegDot';
import { dishPhoto } from '../utils/foodImage';

// Looping strip of the most frequently ordered DISHES (platform-wide).
// The list is rendered twice and the track slides left by exactly 50%,
// so the animation restarts seamlessly. Pauses on hover / touch.
export default function PopularDishes() {
  const { t, tn } = useLanguage();
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get('/recommendations/top-dishes', { params: { limit: 12 } })
      .then(({ data }) => setItems(data.data.items))
      .catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) return null;

  const loop = [...items, ...items];
  const seconds = Math.max(24, items.length * 4);

  return (
    <section className="popular-dishes">
      <div className="popular-head">
        <h2>{t('pop.title')}</h2>
        <p className="muted small">{t('pop.subtitle')}</p>
      </div>
      <div className="marquee" style={{ '--marquee-time': `${seconds}s` }}>
        <div className="marquee-track">
          {loop.map((d, i) => (
            <Link
              key={`${d._id}-${i}`}
              to={`/restaurant/${d.restaurant._id}`}
              className="dish-tile"
              aria-hidden={i >= items.length ? 'true' : undefined}
              tabIndex={i >= items.length ? -1 : 0}
            >
              <FoodImage photo={dishPhoto(d)} className="dish-tile-img" eager />
              <div className="dish-tile-body">
                <b><VegDot veg={d.isVeg} /> {d.name}</b>
                <small className="muted">{tn(d.restaurant.name)}</small>
                <div className="dish-tile-foot">
                  <span>₹{d.price}</span>
                  {d.timesOrdered > 0 && <span className="trending-pill">{t('pop.ordered', { n: d.timesOrdered })}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
