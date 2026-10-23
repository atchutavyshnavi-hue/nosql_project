import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from './Toast';
import { SPEECH_LOCALES } from '../i18n/voice';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export const voiceSupported = Boolean(SpeechRecognition);

// 🎤 button using the browser's Web Speech API (Chrome / Edge / Safari).
// Listens in the app's current language; onInterim streams partial text,
// onFinal receives the finished phrase.
export default function VoiceButton({ onInterim, onFinal }) {
  const { t, lang } = useLanguage();
  const showToast = useToast();
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const recRef = useRef(null);
  const gotResult = useRef(false);

  useEffect(() => () => recRef.current?.abort(), []);

  if (!SpeechRecognition) return null; // browser can't do it — hide rather than show a dead button

  function start() {
    const rec = new SpeechRecognition();
    rec.lang = SPEECH_LOCALES[lang] || 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    gotResult.current = false;
    setHeard('');

    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) text += e.results[i][0].transcript;
      setHeard(text);
      const last = e.results[e.results.length - 1];
      if (last.isFinal) {
        gotResult.current = true;
        onFinal && onFinal(text.trim());
      } else {
        onInterim && onInterim(text);
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') showToast(t('voice.denied'), 'error');
      else if (e.error === 'no-speech') showToast(t('voice.noSpeech'), 'info');
      else if (e.error !== 'aborted') showToast(t('voice.error'), 'error');
    };
    rec.onend = () => {
      setListening(false);
      if (!gotResult.current) setHeard('');
    };

    recRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
  }

  function toggle() {
    if (listening) recRef.current?.stop();
    else start();
  }

  return (
    <span className="voice-wrap">
      <button
        type="button"
        className={`voice-btn ${listening ? 'listening' : ''}`}
        onClick={toggle}
        title={listening ? t('voice.stop') : t('voice.start')}
        aria-label={listening ? t('voice.stop') : t('voice.start')}
        aria-pressed={listening}
      >
        {listening ? '⏹' : '🎤'}
      </button>
      {listening && (
        <span className="voice-hint" role="status">
          {heard ? t('voice.heard', { text: heard }) : t('voice.listening')}
        </span>
      )}
    </span>
  );
}
