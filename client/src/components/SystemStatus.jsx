import { useEffect, useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from './Toast';
import ServiceBadge from './ui/ServiceBadge';
import SectionHeader from './ui/SectionHeader';

// Admin: shows all four data stores and lets you copy existing orders into Neo4j / MonetDB.
export default function SystemStatus() {
  const { t } = useLanguage();
  const showToast = useToast();
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = () => api.get('/analytics/system').then(({ data }) => setStatus(data.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function backfill() {
    setSyncing(true);
    try {
      const { data } = await api.post('/analytics/backfill');
      const r = data.data;
      showToast(t('sys.synced', { m: r.monetdb ?? 0, n: r.neo4j ?? 0 }), 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Sync failed', 'error');
    } finally { setSyncing(false); }
  }

  if (!status) return <p>{t('common.loading')}</p>;
  const nodes = status.neo4j.stats?.nodes;

  return (
    <div>
      <SectionHeader
        title={t('sys.title')}
        subtitle={t('sys.subtitle')}
        action={(status.neo4j.connected || status.monetdb.connected) && (
          <button className="btn-primary-sm" onClick={backfill} disabled={syncing}>
            {syncing ? t('sys.syncing') : `🔄 ${t('sys.sync')}`}
          </button>
        )}
      />
      <div className="service-grid">
        <ServiceBadge name="MongoDB" role={t('sys.mongo')} connected={status.mongodb.connected} />
        <ServiceBadge name="Redis" role={t('sys.redis')} connected={status.redis.connected} />
        <ServiceBadge name="Neo4j" role={t('sys.neo4j')} connected={status.neo4j.connected}
          detail={nodes ? Object.entries(nodes).map(([k, v]) => `${v} ${k}`).join(' · ') : undefined} />
        <ServiceBadge name="MonetDB" role={t('sys.monetdb')} connected={status.monetdb.connected}
          detail={status.monetdb.stats ? `${status.monetdb.stats.orderFacts} orders · ${status.monetdb.stats.itemFacts} order lines` : undefined} />
      </div>
    </div>
  );
}
