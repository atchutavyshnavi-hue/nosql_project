const Order = require('../models/Order');
const { query, isReady, str, numLit, ts } = require('../config/monetdb');

// Star-schema style fact tables kept in MonetDB (column store):
//   order_facts       one row per order
//   order_item_facts  one row per order line (for dish-level analytics)
// Every order saved in MongoDB is mirrored here by sync.service.js.

const OK = "order_status <> 'cancelled'";

async function init() {
  if (!isReady()) return;
  const exists = async (name) => (await query(`SELECT name FROM sys.tables WHERE name = ${str(name)}`)).length > 0;

  if (!(await exists('order_facts'))) {
    await query(`CREATE TABLE order_facts (
      order_id VARCHAR(32), restaurant_id VARCHAR(32), customer_id VARCHAR(32),
      delivery_zone VARCHAR(16), order_status VARCHAR(24), payment_method VARCHAR(8),
      subtotal DOUBLE, tax DOUBLE, delivery_fee DOUBLE, discount DOUBLE, grand_total DOUBLE,
      items_count INT, surge_applied BOOLEAN,
      created_at TIMESTAMP, order_date DATE, order_hour SMALLINT, order_dow SMALLINT
    )`);
  }
  if (!(await exists('order_item_facts'))) {
    await query(`CREATE TABLE order_item_facts (
      order_id VARCHAR(32), restaurant_id VARCHAR(32), dish_id VARCHAR(32), dish_name VARCHAR(160),
      qty INT, unit_price DOUBLE, line_total DOUBLE, order_status VARCHAR(24), created_at TIMESTAMP
    )`);
  }
  console.log('[MonetDB] Analytics tables ready');
}

// Idempotent: replaces any existing rows for this order. Writes are
// serialized so two quick updates to one order can't interleave their
// DELETE/INSERT pairs and leave duplicate rows.
let writeChain = Promise.resolve();
function recordOrder(order) {
  const job = writeChain.then(() => recordOrderNow(order));
  writeChain = job.catch(() => {});
  return job;
}

async function recordOrderNow(order) {
  if (!isReady()) return;
  const id = str(String(order._id));
  const rid = str(String(order.restaurant && order.restaurant._id ? order.restaurant._id : order.restaurant));
  const created = new Date(order.createdAt);
  const p = order.pricing || {};
  const date = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;

  await query(`DELETE FROM order_facts WHERE order_id = ${id}`);
  await query(`DELETE FROM order_item_facts WHERE order_id = ${id}`);
  await query(`INSERT INTO order_facts VALUES (
    ${id}, ${rid}, ${str(String(order.customer))}, ${str(order.deliveryAddress?.zone)}, ${str(order.status)}, ${str(order.paymentMethod)},
    ${numLit(p.subtotal)}, ${numLit(p.tax)}, ${numLit(p.deliveryFee)}, ${numLit(p.discount)}, ${numLit(p.total)},
    ${(order.items || []).reduce((n, i) => n + (i.quantity || 0), 0)}, ${p.surgeApplied ? 'true' : 'false'},
    ${ts(created)}, DATE '${date}', ${created.getHours()}, ${created.getDay()}
  )`);
  for (const it of order.items || []) {
    await query(`INSERT INTO order_item_facts VALUES (
      ${id}, ${rid}, ${str(String(it.menuItem))}, ${str(it.name)}, ${numLit(it.quantity)},
      ${numLit(it.price)}, ${numLit(it.price * it.quantity)}, ${str(order.status)}, ${ts(created)}
    )`);
  }
}

const n = (v) => Number(v) || 0;

// scope: { restaurantId?: string, days?: number }
async function overview({ restaurantId, days = 30 } = {}) {
  const since = new Date(Date.now() - days * 86400000);
  const where = [`created_at >= ${ts(since)}`];
  if (restaurantId) where.push(`restaurant_id = ${str(restaurantId)}`);
  const W = where.join(' AND ');
  const itemW = W; // same columns exist on both tables

  const [summary] = await query(`SELECT
      COUNT(*) AS n_orders,
      SUM(CASE WHEN ${OK} THEN grand_total ELSE 0 END) AS revenue,
      AVG(CASE WHEN ${OK} THEN grand_total END) AS avg_order,
      SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS n_cancelled,
      SUM(CASE WHEN ${OK} THEN items_count ELSE 0 END) AS n_items,
      SUM(CASE WHEN surge_applied THEN 1 ELSE 0 END) AS n_surge
    FROM order_facts WHERE ${W}`);

  const daily = await query(`SELECT order_date AS d, COUNT(*) AS n_orders,
      SUM(CASE WHEN ${OK} THEN grand_total ELSE 0 END) AS revenue
    FROM order_facts WHERE ${W} GROUP BY order_date ORDER BY order_date`);

  const hourly = await query(`SELECT order_hour AS h, COUNT(*) AS n_orders
    FROM order_facts WHERE ${W} AND ${OK} GROUP BY order_hour ORDER BY order_hour`);

  const weekday = await query(`SELECT order_dow AS d, COUNT(*) AS n_orders
    FROM order_facts WHERE ${W} AND ${OK} GROUP BY order_dow ORDER BY order_dow`);

  const zones = await query(`SELECT delivery_zone AS z, COUNT(*) AS n_orders,
      SUM(grand_total) AS revenue
    FROM order_facts WHERE ${W} AND ${OK} GROUP BY delivery_zone ORDER BY n_orders DESC`);

  const topDishes = await query(`SELECT dish_name AS name, SUM(qty) AS total_qty, SUM(line_total) AS revenue
    FROM order_item_facts WHERE ${itemW} AND ${OK} GROUP BY dish_name ORDER BY total_qty DESC LIMIT 8`);

  const payments = await query(`SELECT payment_method AS m, COUNT(*) AS n_orders
    FROM order_facts WHERE ${W} AND ${OK} GROUP BY payment_method`);

  const out = {
    days,
    summary: {
      orders: n(summary?.n_orders), revenue: Math.round(n(summary?.revenue)), avgOrder: Math.round(n(summary?.avg_order)),
      cancelled: n(summary?.n_cancelled), items: n(summary?.n_items), surgeOrders: n(summary?.n_surge),
    },
    daily: daily.map((r) => ({ date: String(r.d).slice(0, 10), orders: n(r.n_orders), revenue: Math.round(n(r.revenue)) })),
    hourly: Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: n(hourly.find((r) => n(r.h) === h)?.n_orders) })),
    weekday: Array.from({ length: 7 }, (_, d) => ({ day: d, orders: n(weekday.find((r) => n(r.d) === d)?.n_orders) })),
    zones: zones.map((r) => ({ zone: r.z, orders: n(r.n_orders), revenue: Math.round(n(r.revenue)) })),
    topDishes: topDishes.map((r) => ({ name: r.name, qty: n(r.total_qty), revenue: Math.round(n(r.revenue)) })),
    payments: payments.map((r) => ({ method: r.m, orders: n(r.n_orders) })),
  };

  if (!restaurantId) {
    const board = await query(`SELECT restaurant_id AS id, COUNT(*) AS n_orders, SUM(grand_total) AS revenue
      FROM order_facts WHERE ${W} AND ${OK} GROUP BY restaurant_id ORDER BY revenue DESC LIMIT 5`);
    out.leaderboard = board.map((r) => ({ id: r.id, orders: n(r.n_orders), revenue: Math.round(n(r.revenue)) }));
  }
  return out;
}

async function counts() {
  const [o] = await query('SELECT COUNT(*) AS c FROM order_facts');
  const [i] = await query('SELECT COUNT(*) AS c FROM order_item_facts');
  return { orderFacts: n(o?.c), itemFacts: n(i?.c) };
}

// Loads every existing MongoDB order into MonetDB (safe to re-run).
async function backfill() {
  if (!isReady()) throw new Error('MonetDB not connected');
  let count = 0;
  const cursor = Order.find().cursor();
  for await (const order of cursor) {
    await recordOrder(order);
    count += 1;
  }
  return count;
}

module.exports = { init, recordOrder, overview, counts, backfill };
