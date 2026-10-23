const neo4j = require('neo4j-driver');

// Neo4j (graph database) powers SmartServe's relationship-based features:
// "recommended for you", "customers also ordered", "similar restaurants".
// MongoDB stays the source of truth; Neo4j holds a copy of the order
// relationships (Customer)-[:PLACED]->(Order)-[:CONTAINS]->(Dish) etc.
//
// It is OPTIONAL: if NEO4J_URI isn't set or the server is unreachable the
// rest of the app keeps working and graph endpoints report "unavailable".

let driver = null;
let ready = false;

async function connectNeo4j() {
  if (!process.env.NEO4J_URI) {
    console.log('[Neo4j] NEO4J_URI not set — graph features disabled');
    return false;
  }
  try {
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || ''),
    );
    await driver.verifyConnectivity();
    ready = true;
    // Uniqueness constraints (also create indexes). IF NOT EXISTS needs Neo4j 4.4+.
    const labels = ['Customer', 'Restaurant', 'Dish', 'Order'];
    for (const label of labels) {
      await runCypher(`CREATE CONSTRAINT ${label.toLowerCase()}_id IF NOT EXISTS FOR (n:${label}) REQUIRE n.id IS UNIQUE`);
    }
    console.log('[Neo4j] Connected');
    return true;
  } catch (err) {
    console.warn(`[Neo4j] Not available (${err.message}) — graph features disabled`);
    ready = false;
    return false;
  }
}

const isReady = () => ready;

async function runCypher(query, params = {}) {
  if (!driver) throw new Error('Neo4j not connected');
  const session = driver.session();
  try {
    const result = await session.run(query, params);
    return result.records;
  } finally {
    await session.close();
  }
}

// Neo4j integers come back as objects; convert to plain JS numbers.
const num = (v) => (neo4j.isInt(v) ? v.toNumber() : v);

module.exports = { connectNeo4j, runCypher, isReady, num };
