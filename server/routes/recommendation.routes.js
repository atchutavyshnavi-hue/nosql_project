const express = require('express');
const ctrl = require('../controllers/recommendation.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/trending', ctrl.trending); // public — no personalization needed
router.get('/top-dishes', ctrl.topDishes); // public — platform-wide most-ordered dishes
router.get('/', protect, ctrl.recommended);

module.exports = router;
