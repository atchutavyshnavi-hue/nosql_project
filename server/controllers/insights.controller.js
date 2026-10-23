const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const graph = require('../services/graph.service');
const analytics = require('../services/analytics.service');
const { redisClient } = require('../config/redis');
const neo = require('../config/neo4j');
const monet = require('../config/monetdb');

const unavailable = (res, engine) =>
  res.status(200).json({ success: true, message: `${engine} is not connected`, data: { available: false } });

// ---------- Neo4j (graph) ----------

// GET /api/graph/recommendations  (customer)
exports.recommendations = catchAsync(async (req, res) => {
  if (!neo.isReady()) return unavailable(res, 'Neo4j');
  const data = await graph.recommendForUser(req.user._id, Number(req.query.limit) || 6);
  res.status(200).json({ success: true, message: 'Success', data: { available: true, ...data } });
});

// GET /api/graph/restaurants/:id/similar
exports.similar = catchAsync(async (req, res) => {
  if (!neo.isReady()) return unavailable(res, 'Neo4j');
  const items = await graph.similarRestaurants(req.params.id, 4);
  res.status(200).json({ success: true, message: 'Success', data: { available: true, items } });
});

// GET /api/graph/dishes/:id/also-ordered
exports.alsoOrdered = catchAsync(async (req, res) => {
  if (!neo.isReady()) return unavailable(res, 'Neo4j');
  const items = await graph.alsoOrdered(req.params.id, 4);
  res.status(200).json({ success: true, message: 'Success', data: { available: true, items } });
});

// ---------- MonetDB (analytics) ----------

const clampDays = (d) => [7, 30, 90].includes(Number(d)) ? Number(d) : 30;

// GET /api/analytics/restaurant/:id?days=30   (owner of that restaurant, or admin)
exports.restaurantAnalytics = catchAsync(async (req, res, next) => {
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) return next(new AppError('Restaurant not found', 404));
  if (req.user.role !== 'admin' && String(restaurant.owner) !== String(req.user._id)) {
    return next(new AppError('You do not own this restaurant', 403));
  }
  if (!monet.isReady()) return unavailable(res, 'MonetDB');
  const data = await analytics.overview({ restaurantId: String(restaurant._id), days: clampDays(req.query.days) });
  res.status(200).json({ success: true, message: 'Success', data: { available: true, ...data } });
});

// GET /api/analytics/platform?days=30   (admin)
exports.platformAnalytics = catchAsync(async (req, res) => {
  if (!monet.isReady()) return unavailable(res, 'MonetDB');
  const data = await analytics.overview({ days: clampDays(req.query.days) });
  // Attach restaurant names to the leaderboard (names live in MongoDB).
  const ids = (data.leaderboard || []).map((r) => r.id).filter((id) => mongoose.isValidObjectId(id));
  const docs = await Restaurant.find({ _id: { $in: ids } }).select('name').lean();
  const names = Object.fromEntries(docs.map((d) => [String(d._id), d.name]));
  data.leaderboard = (data.leaderboard || []).map((r) => ({ ...r, name: names[r.id] || r.id }));
  res.status(200).json({ success: true, message: 'Success', data: { available: true, ...data } });
});

// ---------- System status / sync (admin) ----------

// GET /api/analytics/system
exports.systemStatus = catchAsync(async (req, res) => {
  const status = {
    mongodb: { connected: mongoose.connection.readyState === 1 },
    redis: { connected: false },
    neo4j: { connected: neo.isReady() },
    monetdb: { connected: monet.isReady() },
  };
  try { status.redis.connected = (await redisClient.ping()) === 'PONG'; } catch { /* leave false */ }
  if (status.neo4j.connected) status.neo4j.stats = await graph.stats().catch(() => null);
  if (status.monetdb.connected) status.monetdb.stats = await analytics.counts().catch(() => null);
  res.status(200).json({ success: true, message: 'Success', data: status });
});

// POST /api/analytics/backfill  — copy all existing MongoDB orders into Neo4j + MonetDB
exports.backfill = catchAsync(async (req, res) => {
  const result = {};
  if (monet.isReady()) result.monetdb = await analytics.backfill();
  if (neo.isReady()) result.neo4j = await graph.backfill();
  res.status(200).json({ success: true, message: 'Backfill complete', data: result });
});
