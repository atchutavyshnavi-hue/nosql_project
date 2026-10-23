import { NAMES } from './names';

// Speech-recognition locale for each app language.
export const SPEECH_LOCALES = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN' };

// Restaurant/category data is stored in English, so when someone speaks
// Hindi/Telugu/Tamil/Kannada we map any known native-script names
// (e.g. "బర్గర్ బార్న్") back to their English form before searching.
export function toSearchTerm(text, lang) {
  let out = (text || '').trim().replace(/[.。!?]+$/, '');
  const dict = NAMES[lang];
  if (!dict) return out;
  // Longest names first so "Burger Barn" wins over "Burger".
  Object.entries(dict)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([english, native]) => {
      if (out.includes(native)) out = out.replace(native, english);
    });
  return out;
}
