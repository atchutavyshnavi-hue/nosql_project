import { useEffect, useState } from 'react';
import api from '../services/api';
import RestaurantCard from '../components/RestaurantCard';
import Skeleton from '../components/Skeleton';
import { Link, useNavigate } from 'react-router-dom';
import VoiceSearchInput from '../components/VoiceSearchInput';
import RecommendationRow from '../components/RecommendationRow';
import PopularDishes from '../components/PopularDishes';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Home() {
  const { t, tn } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const goSearch = (q) => navigate(`/restaurants?q=${encodeURIComponent(q)}`);
  const [featured, setFeatured] = useState(null);
  const [trending, setTrending] = useState(null);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/restaurants/featured').then(({ data }) => setFeatured(data.data.restaurants));
    api.get('/meta/categories').then(({ data }) => setCategories(data.data.categories));
    // Trending needs a zone — default to 'central' until we have real
    // geolocation/address selection wired up.
    api.get('/recommendations/trending', { params: { zone: 'central' } })
      .then(({ data }) => setTrending(data.data.trending));
  }, []);

  return (
    <div className="home-page">
      <section className="hero">
        <h1>{t('home.hero')}</h1>
        <form className="search-bar" onSubmit={(e) => {
          e.preventDefault();
          goSearch(query);
        }}>
          <VoiceSearchInput
            placeholder={t('home.searchPh')}
            value={query}
            onChange={setQuery}
            onVoice={goSearch}
          />
          <button type="submit" className="btn-primary">{t('home.search')}</button>
        </form>
      </section>

      <PopularDishes />

      {categories.length > 0 && (
        <section>
          <h2>{t('home.categories')}</h2>
          <div className="category-row">
            {categories.map((c) => (
              <Link key={c._id} to={`/restaurants?cuisine=${encodeURIComponent(c.name)}`} className="category-chip">
                {tn(c.name)}
              </Link>
            ))}
          </div>
        </section>
      )}

      {user?.role === 'customer' && <RecommendationRow />}

      {trending && trending.length > 0 && (
        <section>
          <h2>{t('home.trending')}</h2>
          <div className="restaurant-grid">
            {trending.map(({ restaurant, orderCount }) => (
              <div key={restaurant._id} style={{ position: 'relative' }}>
                <RestaurantCard restaurant={restaurant} />
                <span className="trending-badge">{t('home.recent', { n: orderCount })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>{t('home.featured')}</h2>
        {featured === null ? <Skeleton /> : featured.length === 0 ? (
          <p className="muted">{t('home.noFeatured')}</p>
        ) : (
          <div className="restaurant-grid">
            {featured.map((r) => <RestaurantCard key={r._id} restaurant={r} />)}
          </div>
        )}
      </section>
    </div>
  );
}
