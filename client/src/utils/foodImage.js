// Real food photos, shipped with the app in client/public/food/<category>/<n>.jpg
// (from the Foodish image collection, https://github.com/surhud004/Foodish, MIT).
// We map a dish / restaurant to a photo category by keyword, then pick a
// stable photo number from the name so a dish always shows the same picture.
// Photos are local files, so they load offline and never hit another website.

const BASE = '/food';
const PHOTOS_PER_CATEGORY = 8; // files 1.jpg .. 8.jpg in every category folder

const RULES = [
  [/biryani|pulao|biriyani/i, 'biryani'],
  [/pizza|garlic bread|focaccia/i, 'pizza'],
  [/burger|sandwich|fries|hot ?dog|wrap/i, 'burger'],
  [/dosa|uttapam|uttappam/i, 'dosa'],
  [/idli|idly|vada|sambar/i, 'idly'],
  [/pasta|alfredo|spaghetti|macaroni|lasagna|noodle/i, 'pasta'],
  [/samosa|momo|spring roll|pakora|kachori|puff/i, 'samosa'],
  [/butter chicken|paneer|masala|curry|tandoori|tikka|kebab|chole|bhature|dal|egg|fish|grill|home food/i, 'butter-chicken'],
  [/rice|manchurian|fried|sushi|salad|wok|hakka|chinese/i, 'rice'],
  [/gulab|jamun|brownie|cake|ice ?cream|sundae|cheesecake|sweet|dessert|coffee|lassi|shake|caf/i, 'dessert'],
];

const CUISINE_FALLBACK = {
  pizza: 'pizza', burgers: 'burger', burger: 'burger', indian: 'biryani',
  chinese: 'rice', desserts: 'dessert', dessert: 'dessert', italian: 'pasta',
  'south indian': 'dosa',
};

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function foodCategory(...texts) {
  const text = texts.filter(Boolean).join(' ');
  for (const [re, cat] of RULES) if (re.test(text)) return cat;
  for (const t of texts) {
    const hit = CUISINE_FALLBACK[String(t || '').toLowerCase()];
    if (hit) return hit;
  }
  return 'biryani';
}

// Photo for a dish (menu item).
export function dishPhoto(item) {
  if (item?.image) return { src: item.image, category: foodCategory(item?.name) };
  const category = foodCategory(item?.name, item?.category);
  const n = (hash(item?.name || 'dish') % PHOTOS_PER_CATEGORY) + 1;
  return { src: `${BASE}/${category}/${n}.jpg`, category };
}

// Photo for a restaurant card.
export function restaurantPhoto(r) {
  const category = foodCategory(r?.name, ...(r?.cuisines || []));
  if (r?.coverImage) return { src: r.coverImage, category };
  const n = (hash(r?.name || 'restaurant') % PHOTOS_PER_CATEGORY) + 1;
  return { src: `${BASE}/${category}/${n}.jpg`, category };
}

export const DEFAULT_PHOTO = `${BASE}/biryani/1.jpg`;
