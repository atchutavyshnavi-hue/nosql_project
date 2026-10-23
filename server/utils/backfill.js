// Usage: npm run sync   — copies every existing MongoDB order into Neo4j and MonetDB.
require('dotenv').config();
const mongoose = require('mongoose');
const { connectNeo4j } = require('../config/neo4j');
const { connectMonetDB } = require('../config/monetdb');
const analytics = require('../services/analytics.service');
const graph = require('../services/graph.service');
const { isReady: neoReady } = require('../config/neo4j');
const { isReady: monetReady } = require('../config/monetdb');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await connectNeo4j();
  await connectMonetDB();
  if (monetReady()) {
    await analytics.init();
    console.log(`MonetDB: ${await analytics.backfill()} orders synced`);
  }
  if (neoReady()) console.log(`Neo4j: ${await graph.backfill()} orders synced`);
  if (!neoReady() && !monetReady()) console.log('Neither Neo4j nor MonetDB is configured/reachable — nothing to do.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
