const express = require('express');
const ctrl = require('../controllers/insights.controller');
const { protect, restrictTo } = require('../middleware/auth');

// Mounted at /api/graph  (Neo4j)  and  /api/analytics  (MonetDB)
const graphRouter = express.Router();
graphRouter.use(protect);
graphRouter.get('/recommendations', restrictTo('customer'), ctrl.recommendations);
graphRouter.get('/restaurants/:id/similar', ctrl.similar);
graphRouter.get('/dishes/:id/also-ordered', ctrl.alsoOrdered);

const analyticsRouter = express.Router();
analyticsRouter.use(protect);
analyticsRouter.get('/restaurant/:id', restrictTo('restaurant_owner', 'admin'), ctrl.restaurantAnalytics);
analyticsRouter.get('/platform', restrictTo('admin'), ctrl.platformAnalytics);
analyticsRouter.get('/system', restrictTo('admin'), ctrl.systemStatus);
analyticsRouter.post('/backfill', restrictTo('admin'), ctrl.backfill);

module.exports = { graphRouter, analyticsRouter };
