const recommendationService = require('../services/recommendation.service');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// GET /api/recommendations/trending?zone=north&limit=5
exports.trending = catchAsync(async (req, res, next) => {
  const { zone, limit = 5 } = req.query;
  if (!zone) return next(new AppError('zone query parameter is required', 400));
  const trending = await recommendationService.getTrending(zone, Number(limit));
  res.status(200).json({ success: true, message: 'Success', data: { trending } });
});

// GET /api/recommendations  (auth required — uses the logged-in user's zone & preferences)
exports.recommended = catchAsync(async (req, res, next) => {
  const zone = req.query.zone || req.user.addresses?.find((a) => a.isDefault)?.zone || req.user.addresses?.[0]?.zone;
  if (!zone) return next(new AppError('No zone available — pass ?zone= or add a default address', 400));
  const recommended = await recommendationService.getRecommended(
    zone, req.user.cuisinePreferences || [], Number(req.query.limit) || 5,
  );
  res.status(200).json({ success: true, message: 'Success', data: { recommended } });
});

// GET /api/recommendations/top-dishes?limit=12
// Most frequently ordered DISHES across the platform (not restaurants).
// Pure MongoDB — works even when Neo4j/MonetDB are off. If fewer than
// `limit` dishes have ever been ordered (fresh database), it is padded
// with dishes flagged isPopular so the strip is never empty.
exports.topDishes = catchAsync(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 30);

  const rows = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.menuItem', qty: { $sum: '$items.quantity' }, orders: { $sum: 1 } } },
    { $sort: { qty: -1, orders: -1 } },
    { $limit: limit * 2 },
  ]);

  const qtyById = new Map(rows.map((r) => [String(r._id), r]));
  const found = await MenuItem.find({ _id: { $in: rows.map((r) => r._id) }, isAvailable: true })
    .populate('restaurant', 'name zone isOpen');

  let dishes = found
    .filter((d) => d.restaurant)
    .map((d) => ({ dish: d, qty: qtyById.get(String(d._id)).qty, orders: qtyById.get(String(d._id)).orders }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);

  if (dishes.length < limit) {
    const have = dishes.map((x) => x.dish._id);
    const filler = await MenuItem.find({ _id: { $nin: have }, isAvailable: true, isPopular: true })
      .populate('restaurant', 'name zone isOpen').limit(limit - dishes.length);
    dishes = dishes.concat(filler.filter((d) => d.restaurant).map((d) => ({ dish: d, qty: 0, orders: 0 })));
  }

  const items = dishes.map(({ dish, qty, orders }) => ({
    _id: dish._id,
    name: dish.name,
    price: dish.price,
    isVeg: dish.isVeg,
    image: dish.image,
    category: dish.category,
    restaurant: { _id: dish.restaurant._id, name: dish.restaurant.name },
    timesOrdered: qty,
    orders,
  }));
  res.status(200).json({ success: true, message: 'Success', data: { items } });
});
