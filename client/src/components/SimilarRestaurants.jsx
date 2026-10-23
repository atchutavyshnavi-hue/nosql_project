import { useEffect, useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import RestaurantCard from './RestaurantCard';
import SectionHeader from './ui/SectionHeader';

// "Customers of this restaurant also order from…" — Neo4j graph traversal.
export default function SimilarRestaurants({ restaurantId }) {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems([]);
    api.get(`/graph/restaurants/${restaurantId}/similar`)
      .then(({ data }) => setItems(data.data.items || []))
      .catch(() => {});
  }, [restaurantId]);

  if (items.length === 0) return null;
  return (
    <section className="similar-section">
      <SectionHeader title={`🍴 ${t('similar.title')}`} subtitle={t('similar.subtitle')} badge="Neo4j" />
      <div className="restaurant-grid">
        {items.map(({ restaurant, shared }) => (
          <div key={restaurant._id} style={{ position: 'relative' }}>
            <RestaurantCard restaurant={restaurant} />
            <span className="trending-badge">{t('similar.shared', { n: shared })}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
