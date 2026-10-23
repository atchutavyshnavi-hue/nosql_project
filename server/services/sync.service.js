const analytics = require('./analytics.service');
const graph = require('./graph.service');
const { isReady: monetReady } = require('../config/monetdb');
const { isReady: neoReady } = require('../config/neo4j');

// Mirrors an order from MongoDB (source of truth) into MonetDB (analytics)
// and Neo4j (relationship graph). Fire-and-forget: a failure here is logged
// but never affects the customer's request.
async function syncOrder(orderId) {
  if (!monetReady() && !neoReady()) return;
  const Order = require('../models/Order'); // lazy: Order's hooks call this module
  const order = await Order.findById(orderId).populate('restaurant', 'name');
  if (!order) return;
  const jobs = [];
  if (monetReady()) jobs.push(analytics.recordOrder(order).catch((e) => console.warn('[MonetDB sync]', e.message)));
  if (neoReady()) jobs.push(graph.recordOrder(order).catch((e) => console.warn('[Neo4j sync]', e.message)));
  await Promise.all(jobs);
}

module.exports = { syncOrder };
