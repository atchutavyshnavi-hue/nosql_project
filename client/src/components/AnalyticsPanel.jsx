import { useEffect, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import StatCard from './ui/StatCard';
import SectionHeader from './ui/SectionHeader';
import EmptyState from './ui/EmptyState';
import BarList from './ui/BarList';
import HourHeatmap from './ui/HourHeatmap';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Analytics powered by MonetDB. scope = restaurant (owner) or platform (admin).
export default function AnalyticsPanel({ restaurantId }) {
  const { t, tn } = useLanguage();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null); setError('');
    const url = restaurantId ? `/analytics/restaurant/${restaurantId}` : '/analytics/platform';
    api.get(url, { params: { days } })
      .then(({ data: res }) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load analytics'));
  }, [restaurantId, days]);

  if (error) return <EmptyState icon="⚠️" title={error} />;
  if (!data) return <p>{t('common.loading')}</p>;
  if (!data.available) {
    return (
      <EmptyState icon="🗄️" title={t('an.offlineTitle')}>
        {t('an.offlineBody')}
      </EmptyState>
    );
  }

  const s = data.summary;
  const cancelRate = s.orders ? Math.round((s.cancelled / s.orders) * 100) : 0;
  const peak = [...data.hourly].sort((a, b) => b.orders - a.orders)[0];
  const fmtHour = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

  return (
    <div className="analytics-panel">
      <SectionHeader
        title={t('an.title')}
        subtitle={t('an.subtitle')}
        badge="MonetDB"
        action={(
          <div className="chip-row">
            {[7, 30, 90].map((d) => (
              <button key={d} className={`chip small ${days === d ? 'selected' : ''}`} onClick={() => setDays(d)}>
                {t('an.lastDays', { n: d })}
              </button>
            ))}
          </div>
        )}
      />

      {s.orders === 0 ? (
        <EmptyState icon="📊" title={t('an.noData')}>{t('an.noDataHint')}</EmptyState>
      ) : (
        <>
          <div className="kpi-grid">
            <StatCard icon="🧾" value={s.orders} label={t('an.orders')} />
            <StatCard icon="💰" value={`₹${s.revenue}`} label={t('an.revenue')} tone="green" />
            <StatCard icon="📈" value={`₹${s.avgOrder}`} label={t('an.avgOrder')} />
            <StatCard icon="❌" value={`${cancelRate}%`} label={t('an.cancelRate')} tone={cancelRate > 15 ? 'red' : 'default'} hint={`${s.cancelled} ${t('status.cancelled').toLowerCase()}`} />
            <StatCard icon="⏰" value={peak?.orders ? fmtHour(peak.hour) : '—'} label={t('an.peakHour')} />
            <StatCard icon="⚡" value={s.surgeOrders} label={t('an.surgeOrders')} />
          </div>

          <div className="od-card">
            <h4>{t('an.dailyTitle')}</h4>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis yAxisId="l" allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" />
                <Tooltip />
                <Bar yAxisId="l" dataKey="orders" fill="#ff5a1f" name={t('an.orders')} radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" dataKey="revenue" stroke="#4338ca" strokeWidth={2} dot={false} name={`${t('an.revenue')} (₹)`} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="od-card">
            <h4>{t('an.hourTitle')}</h4>
            <HourHeatmap data={data.hourly} label={t('an.hourTitle')} />
          </div>

          <div className="od-grid">
            <div className="od-card">
              <h4>🍽️ {t('an.topDishes')}</h4>
              {data.topDishes.length === 0 ? <p className="muted small">—</p>
                : <BarList items={data.topDishes.map((d) => ({ label: d.name, value: d.qty, sub: `₹${d.revenue}` }))} />}
            </div>
            <div className="od-card">
              <h4>📍 {t('an.zones')}</h4>
              <BarList items={data.zones.map((z) => ({ label: t(`zone.${z.zone}`), value: z.orders, sub: `₹${z.revenue}` }))} />
              <h4 style={{ marginTop: 18 }}>📅 {t('an.weekday')}</h4>
              <BarList items={data.weekday.map((w) => ({ label: DAYS[w.day], value: w.orders }))} />
            </div>
          </div>

          {data.leaderboard && (
            <div className="od-card">
              <h4>🏆 {t('an.leaderboard')}</h4>
              <BarList items={data.leaderboard.map((r) => ({ label: tn(r.name), value: r.revenue, sub: `${r.orders} ${t('an.orders').toLowerCase()}` }))} format={(v) => `₹${v}`} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
