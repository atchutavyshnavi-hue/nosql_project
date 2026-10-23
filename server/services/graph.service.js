const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const { runCypher, isReady, num } = require('../config/neo4j');

// Graph model
//   (Customer)-[:PLACED]->(Order)-[:FROM]->(Restaurant)
//   (Order)-[:CONTAINS {qty}]->(Dish)<-[:SERVES]-(Restaurant)

async function recordOrder(order) {
  if (!isReady()) return;
  const restaurantDoc = order.restaurant && order.restaurant._id ? order.restaurant : null;
  await runCypher(
    `MERGE (c:Customer {id: $cid})
     MERGE (r:Restaurant {id: $rid})
       ON CREATE SET r.name = $rname
     MERGE (o:Order {id: $oid})
       SET o.status = $status, o.total = $total, o.createdAt = $createdAt
     MERGE (c)-[:PLACED]->(o)
     MERGE (o)-[:FROM]->(r)
     WITH o, r
     UNWIND $items AS it
       MERGE (d:Dish {id: it.id})
         SET d.name = it.name
       MERGE (o)-[x:CONTAINS]->(d)
         SET x.qty = it.qty
       MERGE (r)-[:SERVES]->(d)`,
    {
      cid: String(order.customer),
      rid: String(restaurantDoc ? restaurantDoc._id : order.restaurant),
      rname: restaurantDoc ? restaurantDoc.name : '',
      oid: String(order._id),
      status: order.status,
      total: order.pricing?.total || 0,
      createdAt: new Date(order.createdAt).toISOString(),
      items: (order.items || []).map((i) => ({ id: String(i.menuItem), name: i.name, qty: i.quantity })),
    },
  );
}

// Keep dish/restaurant order of a Cypher result when loading Mongo docs.
async function loadRestaurants(rows) {
  const ids = rows.map((r) => r.id);
  const docs = await Restaurant.find({ _id: { $in: ids } }).lean();
  const byId = Object.fromEntries(docs.map((d) => [String(d._id), d]));
  return rows.filter((r) => byId[r.id]).map((r) => ({ restaurant: byId[r.id], ...r.meta }));
}

// Collaborative filtering: restaurants ordered from by customers who share
// dishes with you, that you haven't tried yet. Falls back to "popular among
// customers" for brand-new users with no order history.
async function recommendForUser(userId, limit = 6) {
  const personal = await runCypher(
    `MATCH (me:Customer {id: $uid})-[:PLACED]->(:Order)-[:CONTAINS]->(d:Dish)<-[:CONTAINS]-(po:Order)<-[:PLACED]-(peer:Customer)
     WHERE peer <> me AND po.status <> 'cancelled'
     MATCH (peer)-[:PLACED]->(o2:Order)-[:FROM]->(r:Restaurant)
     WHERE o2.status <> 'cancelled' AND NOT (me)-[:PLACED]->(:Order)-[:FROM]->(r)
     RETURN r.id AS id, count(DISTINCT peer) AS peers, count(DISTINCT o2) AS orders
     ORDER BY peers DESC, orders DESC LIMIT toInteger($limit)`,
    { uid: String(userId), limit },
  );
  let rows = personal.map((rec) => ({
    id: rec.get('id'),
    meta: { reason: 'peers', peers: num(rec.get('peers')), orders: num(rec.get('orders')) },
  }));
  let source = 'personalized';

  if (rows.length === 0) {
    const popular = await runCypher(
      `MATCH (c:Customer)-[:PLACED]->(o:Order)-[:FROM]->(r:Restaurant)
       WHERE o.status <> 'cancelled'
       RETURN r.id AS id, count(DISTINCT o) AS orders, count(DISTINCT c) AS peers
       ORDER BY orders DESC LIMIT toInteger($limit)`,
      { limit },
    );
    rows = popular.map((rec) => ({
      id: rec.get('id'),
      meta: { reason: 'popular', peers: num(rec.get('peers')), orders: num(rec.get('orders')) },
    }));
    source = 'popular';
  }
  return { source, items: await loadRestaurants(rows) };
}

// "Customers who ordered this dish also ordered…"
async function alsoOrdered(dishId, limit = 4) {
  const records = await runCypher(
    `MATCH (d:Dish {id: $id})<-[:CONTAINS]-(o:Order)-[:CONTAINS]->(other:Dish)
     WHERE other <> d AND o.status <> 'cancelled'
     RETURN other.id AS id, other.name AS name, count(DISTINCT o) AS times
     ORDER BY times DESC LIMIT toInteger($limit)`,
    { id: String(dishId), limit },
  );
  const rows = records.map((r) => ({ id: r.get('id'), name: r.get('name'), times: num(r.get('times')) }));
  const docs = await MenuItem.find({ _id: { $in: rows.map((r) => r.id) } }).select('price isVeg isAvailable restaurant').lean();
  const byId = Object.fromEntries(docs.map((d) => [String(d._id), d]));
  return rows.filter((r) => byId[r.id]).map((r) => ({ ...r, ...byId[r.id], _id: r.id }));
}

// Restaurants that share customers with this one.
async function similarRestaurants(restaurantId, limit = 4) {
  const records = await runCypher(
    `MATCH (r:Restaurant {id: $id})<-[:FROM]-(:Order)<-[:PLACED]-(c:Customer)-[:PLACED]->(o:Order)-[:FROM]->(r2:Restaurant)
     WHERE r2 <> r AND o.status <> 'cancelled'
     RETURN r2.id AS id, count(DISTINCT c) AS shared
     ORDER BY shared DESC LIMIT toInteger($limit)`,
    { id: String(restaurantId), limit },
  );
  const rows = records.map((rec) => ({ id: rec.get('id'), meta: { shared: num(rec.get('shared')) } }));
  return loadRestaurants(rows);
}

async function stats() {
  const records = await runCypher(
    `MATCH (n) WITH labels(n)[0] AS label, count(n) AS c RETURN label, c ORDER BY label`,
  );
  const rels = await runCypher('MATCH ()-[r]->() RETURN count(r) AS c');
  return {
    nodes: Object.fromEntries(records.map((r) => [r.get('label'), num(r.get('c'))])),
    relationships: rels.length ? num(rels[0].get('c')) : 0,
  };
}

// Loads every existing MongoDB order into the graph (safe to re-run: MERGE).
async function backfill() {
  if (!isReady()) throw new Error('Neo4j not connected');
  let count = 0;
  const cursor = Order.find().populate('restaurant', 'name').cursor();
  for await (const order of cursor) {
    await recordOrder(order);
    count += 1;
  }
  return count;
}

module.exports = { recordOrder, recommendForUser, alsoOrdered, similarRestaurants, stats, backfill };
