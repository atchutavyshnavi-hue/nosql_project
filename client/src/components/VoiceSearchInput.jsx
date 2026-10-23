import { useLanguage } from '../context/LanguageContext';
import { toSearchTerm } from '../i18n/voice';
import VoiceButton from './VoiceButton';

// Text input with a built-in microphone. onVoice(finalText) fires when the
// user finishes speaking (text already mapped to searchable English terms).
export default function VoiceSearchInput({ value, onChange, onVoice, placeholder, ...rest }) {
  const { lang } = useLanguage();
  return (
    <div className="voice-input">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} {...rest} />
      <VoiceButton
        onInterim={(text) => onChange(text)}
        onFinal={(text) => {
          const term = toSearchTerm(text, lang);
          onChange(term);
          onVoice && onVoice(term);
        }}
      />
    </div>
  );
}
