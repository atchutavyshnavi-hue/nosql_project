import { useEffect, useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import RestaurantCard from './RestaurantCard';
import SectionHeader from './ui/SectionHeader';

// "Recommended for you" — powered by Neo4j collaborative filtering.
export default function RecommendationRow() {
  const { t } = useLanguage();
  const [state, setState] = useState(null);

  useEffect(() => {
    api.get('/graph/recommendations').then(({ data }) => setState(data.data)).catch(() => setState({ available: false }));
  }, []);

  if (!state || !state.available || !state.items?.length) return null;
  const personal = state.source === 'personalized';

  return (
    <section>
      <SectionHeader
        title={`✨ ${personal ? t('rec.title') : t('rec.popularTitle')}`}
        subtitle={personal ? t('rec.subtitle') : t('rec.popularSubtitle')}
        badge="Neo4j"
      />
      <div className="restaurant-grid">
        {state.items.map(({ restaurant, peers, orders, reason }) => (
          <div key={restaurant._id} style={{ position: 'relative' }}>
            <RestaurantCard restaurant={restaurant} />
            <span className="trending-badge">
              {reason === 'peers' ? t('rec.peers', { n: peers }) : t('home.recent', { n: orders })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
