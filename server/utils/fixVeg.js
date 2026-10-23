require('dotenv').config();
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');

// One-off, non-destructive: corrects the veg / non-veg flag on EXISTING menu
// items from the dish name (the old seed marked every popular dish non-veg).
//   node utils/fixVeg.js        (or: npm run fix:veg)
const NON_VEG = /chicken|fish|egg|mutton|prawn|beef|pork|keema|sushi/i;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const items = await MenuItem.find({}, 'name isVeg');
  let changed = 0;
  for (const it of items) {
    const veg = !NON_VEG.test(it.name);
    if (it.isVeg !== veg) { it.isVeg = veg; await it.save(); changed += 1; }
  }
  console.log(`Checked ${items.length} menu items, corrected ${changed}.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
