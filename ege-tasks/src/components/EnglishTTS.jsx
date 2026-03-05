import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Divider, Input, Radio, Select, Slider, Space, Switch, Tag, Typography, message } from 'antd';

const { TextArea } = Input;
const { Text, Title } = Typography;

const DEFAULT_LANG = 'en-US';
const DEFAULT_PIPER_VOICE = 'en_US-lessac-medium';
const DEFAULT_KOKORO_VOICE = 'bf_emma';

const KOKORO_VOICES = [
  { value: 'bf_emma',     label: 'bf_emma — брит. женский' },
  { value: 'bf_alice',    label: 'bf_alice — брит. женский' },
  { value: 'bf_isabella', label: 'bf_isabella — брит. женский' },
  { value: 'bf_lily',     label: 'bf_lily — брит. женский' },
  { value: 'bm_george',   label: 'bm_george — брит. мужской' },
  { value: 'bm_daniel',   label: 'bm_daniel — брит. мужской' },
  { value: 'bm_lewis',    label: 'bm_lewis — брит. мужской' },
  { value: 'bm_fable',    label: 'bm_fable — брит. мужской' },
  { value: 'af_heart',    label: 'af_heart — амер. женский' },
  { value: 'af_sarah',    label: 'af_sarah — амер. женский' },
  { value: 'af_nova',     label: 'af_nova — амер. женский' },
  { value: 'af_bella',    label: 'af_bella — амер. женский' },
  { value: 'af_jessica',  label: 'af_jessica — амер. женский' },
  { value: 'af_river',    label: 'af_river — амер. женский' },
  { value: 'am_michael',  label: 'am_michael — амер. мужской' },
  { value: 'am_adam',     label: 'am_adam — амер. мужской' },
  { value: 'am_echo',     label: 'am_echo — амер. мужской' },
  { value: 'am_eric',     label: 'am_eric — амер. мужской' },
  { value: 'am_liam',     label: 'am_liam — амер. мужской' },
  { value: 'am_onyx',     label: 'am_onyx — амер. мужской' },
];

const COQUI_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
];

const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Convert any audio blob to mono WAV base64 using AudioContext
const blobToWavBase64 = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  // Downmix to mono
  let samples = audioBuffer.getChannelData(0);
  if (audioBuffer.numberOfChannels > 1) {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    samples = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) samples[i] = (ch0[i] + ch1[i]) / 2;
  }

  const sampleRate = audioBuffer.sampleRate;
  const numSamples = samples.length;
  const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(wavBuffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, 1, true);   // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, Math.round(s * 32767), true);
    off += 2;
  }

  const uint8 = new Uint8Array(wavBuffer);
  let bin = '';
  const chunk = 8192;
  for (let i = 0; i < uint8.length; i += chunk) {
    bin += String.fromCharCode(...uint8.subarray(i, Math.min(i + chunk, uint8.length)));
  }
  return btoa(bin);
};

function EnglishTTS() {
  const [supported, setSupported] = useState(true);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [onlyEnglish, setOnlyEnglish] = useState(true);
  const [text, setText] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [engine, setEngine] = useState('browser');

  // Piper
  const [piperVoice, setPiperVoice] = useState(DEFAULT_PIPER_VOICE);
  const [isPiperLoading, setIsPiperLoading] = useState(false);
  const [piperStatus, setPiperStatus] = useState('idle');
  const [piperRate, setPiperRate] = useState(1);

  // Kokoro
  const [kokoroVoice, setKokoroVoice] = useState(DEFAULT_KOKORO_VOICE);
  const [isKokoroLoading, setIsKokoroLoading] = useState(false);
  const [kokoroStatus, setKokoroStatus] = useState('idle');
  const [kokoroSpeed, setKokoroSpeed] = useState(1);
  const [kokoroVoice2, setKokoroVoice2] = useState('bm_george');
  const [kokoroMix, setKokoroMix] = useState(0);
  const [kokoroMixEnabled, setKokoroMixEnabled] = useState(false);

  // Coqui
  const [coquiLang, setCoquiLang] = useState('en');
  const [coquiMode, setCoquiMode] = useState('builtin'); // 'builtin' | 'cloned'
  // built-in speakers
  const [coquiSpeakers, setCoquiSpeakers] = useState([]);
  const [coquiSpeaker, setCoquiSpeaker] = useState('');
  // cloned voices
  const [coquiVoiceName, setCoquiVoiceName] = useState('');
  const [coquiVoices, setCoquiVoices] = useState([]);
  const [isCoquiLoading, setIsCoquiLoading] = useState(false);
  const [coquiStatus, setCoquiStatus] = useState('idle');
  const [coquiRate, setCoquiRate] = useState(1);

  // Recording (for Coqui voice cloning)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingName, setRecordingName] = useState('');
  const [pendingRecording, setPendingRecording] = useState(null); // { blob, url }
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const [audioUrl, setAudioUrl] = useState('');
  const audioRef = useRef(null);

  const piperApiUrl  = import.meta.env.VITE_TTS_API_URL        || 'http://127.0.0.1:5050';
  const kokoroApiUrl = import.meta.env.VITE_KOKORO_TTS_API_URL || 'http://127.0.0.1:5052';
  const coquiApiUrl  = import.meta.env.VITE_COQUI_TTS_API_URL  || 'http://127.0.0.1:5051';

  // Browser TTS voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSupported(false);
      return;
    }
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  // Shared audio element for Piper, Kokoro, Coqui
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onPlay  = () => { if (engine === 'piper') setPiperStatus('playing');  else if (engine === 'kokoro') setKokoroStatus('playing');  else if (engine === 'coqui') setCoquiStatus('playing'); };
    const onPause = () => { if (engine === 'piper') setPiperStatus('paused');   else if (engine === 'kokoro') setKokoroStatus('paused');   else if (engine === 'coqui') setCoquiStatus('paused'); };
    const onEnded = () => { if (engine === 'piper') setPiperStatus('idle');     else if (engine === 'kokoro') setKokoroStatus('idle');     else if (engine === 'coqui') setCoquiStatus('idle'); };
    const onError = () => { if (engine === 'piper') setPiperStatus('error');    else if (engine === 'kokoro') setKokoroStatus('error');    else if (engine === 'coqui') setCoquiStatus('error'); };

    audio.addEventListener('play',  onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('play',  onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [engine]);

  // Revoke old audioUrl on change
  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  // Revoke pendingRecording URL on change
  useEffect(() => {
    const url = pendingRecording?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [pendingRecording]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Load Coqui voices and speakers when switching to that engine
  useEffect(() => {
    if (engine !== 'coqui') return;
    fetch(`${coquiApiUrl}/voices`)
      .then(r => r.ok ? r.json() : { voices: [] })
      .then(d => setCoquiVoices(d.voices || []))
      .catch(() => setCoquiVoices([]));
    fetch(`${coquiApiUrl}/speakers`)
      .then(r => r.ok ? r.json() : { speakers: [] })
      .then(d => {
        const spk = d.speakers || [];
        setCoquiSpeakers(spk);
        if (spk.length > 0 && !coquiSpeaker) setCoquiSpeaker(spk[0]);
      })
      .catch(() => setCoquiSpeakers([]));
  }, [engine, coquiApiUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop everything when switching engines
  useEffect(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (engine === 'browser') {
      setPiperStatus('idle');
      setKokoroStatus('idle');
      setCoquiStatus('idle');
    } else {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      if (engine !== 'piper')   setPiperStatus('idle');
      if (engine !== 'kokoro')  setKokoroStatus('idle');
      if (engine !== 'coqui')   setCoquiStatus('idle');
    }
  }, [engine]);

  const filteredVoices = useMemo(() => {
    if (!onlyEnglish) return voices;
    return voices.filter((v) => String(v.lang || '').toLowerCase().startsWith('en'));
  }, [voices, onlyEnglish]);

  useEffect(() => {
    if (!selectedVoiceURI) return;
    if (!filteredVoices.some((v) => v.voiceURI === selectedVoiceURI)) setSelectedVoiceURI('');
  }, [filteredVoices, selectedVoiceURI]);

  // ── Browser TTS ───────────────────────────────────────────────────────────────
  const handleBrowserSpeak = () => {
    if (!supported) return;
    const trimmed = text.trim();
    if (!trimmed) { message.warning('Введите текст для озвучивания.'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    const sel = voices.find((v) => v.voiceURI === selectedVoiceURI);
    utterance.voice = sel || null;
    utterance.lang = sel?.lang || DEFAULT_LANG;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    utterance.onstart = () => { setIsSpeaking(true);  setIsPaused(false); };
    utterance.onend   = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); message.error('Не удалось озвучить текст.'); };
    window.speechSynthesis.speak(utterance);
  };
  const handleBrowserPause  = () => { window.speechSynthesis.pause();  setIsPaused(true); };
  const handleBrowserResume = () => { window.speechSynthesis.resume(); setIsPaused(false); };
  const handleBrowserStop   = () => { window.speechSynthesis.cancel(); setIsSpeaking(false); setIsPaused(false); };

  // ── Shared audio helpers ──────────────────────────────────────────────────────
  const playAudioBlob = async (blob, playbackRate) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.playbackRate = playbackRate;
      await audioRef.current.play();
    }
  };

  // ── Piper ─────────────────────────────────────────────────────────────────────
  const handlePiperSpeak = async () => {
    const trimmed = text.trim();
    if (!trimmed) { message.warning('Введите текст для озвучивания.'); return; }
    setIsPiperLoading(true);
    setPiperStatus('loading');
    try {
      const res = await fetch(`${piperApiUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, voice: piperVoice }),
      });
      if (!res.ok) {
        let msg = 'Не удалось получить аудио с Piper.';
        try { const p = await res.json(); if (p?.error) msg = p.error; } catch (_) {}
        throw new Error(msg);
      }
      await playAudioBlob(await res.blob(), piperRate);
    } catch (err) {
      message.error(err?.message || 'Ошибка при обращении к Piper.');
      setPiperStatus('error');
    } finally {
      setIsPiperLoading(false);
    }
  };
  const handlePiperRateChange = (v) => { setPiperRate(v); if (audioRef.current) audioRef.current.playbackRate = v; };
  const handlePiperPause  = () => audioRef.current?.pause();
  const handlePiperResume = () => audioRef.current?.play();
  const handlePiperStop   = () => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; setPiperStatus('idle'); };

  // ── Kokoro ────────────────────────────────────────────────────────────────────
  const handleKokoroSpeak = async () => {
    const trimmed = text.trim();
    if (!trimmed) { message.warning('Введите текст для озвучивания.'); return; }
    setIsKokoroLoading(true);
    setKokoroStatus('loading');
    try {
      const res = await fetch(`${kokoroApiUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          voice: kokoroVoice,
          speed: kokoroSpeed,
          ...(kokoroMixEnabled && kokoroMix > 0 ? { voice2: kokoroVoice2, mix: kokoroMix } : {}),
        }),
      });
      if (!res.ok) {
        let msg = 'Не удалось получить аудио с Kokoro.';
        try { const p = await res.json(); if (p?.error) msg = p.error; } catch (_) {}
        throw new Error(msg);
      }
      await playAudioBlob(await res.blob(), 1);
    } catch (err) {
      message.error(err?.message || 'Ошибка при обращении к Kokoro.');
      setKokoroStatus('error');
    } finally {
      setIsKokoroLoading(false);
    }
  };
  const handleKokoroPause  = () => audioRef.current?.pause();
  const handleKokoroResume = () => audioRef.current?.play();
  const handleKokoroStop   = () => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; setKokoroStatus('idle'); };

  // ── Coqui ─────────────────────────────────────────────────────────────────────
  const handleCoquiSpeak = async () => {
    const trimmed = text.trim();
    if (!trimmed) { message.warning('Введите текст для озвучивания.'); return; }
    if (coquiMode === 'builtin' && !coquiSpeaker) { message.warning('Выберите голос из списка.'); return; }
    if (coquiMode === 'cloned'  && !coquiVoiceName) { message.warning('Выберите голос — кликните по имени голоса ниже.'); return; }
    setIsCoquiLoading(true);
    setCoquiStatus('loading');
    try {
      const body = { text: trimmed, language: coquiLang };
      if (coquiMode === 'builtin') body.speaker = coquiSpeaker;
      else body.voice_name = coquiVoiceName;
      const res = await fetch(`${coquiApiUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = 'Ошибка Coqui TTS.';
        try { const p = await res.json(); if (p?.error) msg = p.error; } catch (_) {}
        throw new Error(msg);
      }
      await playAudioBlob(await res.blob(), coquiRate);
    } catch (err) {
      message.error(err?.message || 'Ошибка при обращении к Coqui.');
      setCoquiStatus('error');
    } finally {
      setIsCoquiLoading(false);
    }
  };
  const handleCoquiRateChange = (v) => { setCoquiRate(v); if (audioRef.current) audioRef.current.playbackRate = v; };
  const handleCoquiPause  = () => audioRef.current?.pause();
  const handleCoquiResume = () => audioRef.current?.play();
  const handleCoquiStop   = () => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; setCoquiStatus('idle'); };

  // ── Coqui voice management ────────────────────────────────────────────────────
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setPendingRecording({ blob, url });
        clearInterval(recordingTimerRef.current);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (e) {
      message.error('Нет доступа к микрофону: ' + (e.message || String(e)));
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (pendingRecording?.url) URL.revokeObjectURL(pendingRecording.url);
    const url = URL.createObjectURL(file);
    setPendingRecording({ blob: file, url });
    setRecordingName(file.name.replace(/\.[^.]+$/, ''));
    e.target.value = '';
  };

  const handleSaveVoice = async () => {
    if (!recordingName.trim() || !pendingRecording) return;
    setIsSavingVoice(true);
    try {
      const audio_b64 = await blobToWavBase64(pendingRecording.blob);
      const res = await fetch(`${coquiApiUrl}/voices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: recordingName.trim(), audio_b64 }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Ошибка сохранения');
      const data = await res.json();
      setCoquiVoices(data.voices || []);
      setCoquiVoiceName(data.name || recordingName.trim());
      setPendingRecording(null);
      setRecordingName('');
      message.success('Голос сохранён!');
    } catch (e) {
      message.error('Ошибка: ' + (e.message || String(e)));
    } finally {
      setIsSavingVoice(false);
    }
  };

  const handleDeleteVoice = async (name) => {
    try {
      const res = await fetch(`${coquiApiUrl}/voices/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setCoquiVoices(data.voices || []);
        if (coquiVoiceName === name) setCoquiVoiceName('');
      }
    } catch (e) {
      message.error('Не удалось удалить голос.');
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!audioUrl) return;
    const voiceLabel = engine === 'piper' ? piperVoice
      : engine === 'kokoro' ? kokoroVoice
      : coquiMode === 'builtin' ? (coquiSpeaker || 'coqui')
      : (coquiVoiceName || 'coqui');
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts_${voiceLabel}_${Date.now()}.wav`;
    a.click();
  };

  // ── Status / routing ──────────────────────────────────────────────────────────
  const localStatus = engine === 'piper' ? piperStatus : engine === 'kokoro' ? kokoroStatus : coquiStatus;
  const statusText = engine === 'browser'
    ? (isPaused ? 'Пауза' : isSpeaking ? 'Воспроизводится' : 'Ожидание')
    : (localStatus === 'playing' ? 'Воспроизводится' : localStatus === 'paused' ? 'Пауза' : localStatus === 'loading' ? 'Генерация' : localStatus === 'error' ? 'Ошибка' : 'Ожидание');

  const voiceOptions = useMemo(() => {
    const items = filteredVoices.map((v) => ({
      value: v.voiceURI,
      label: `${v.name} (${v.lang || 'und'})${v.localService ? '' : ' · network'}`,
    }));
    return [{ value: '', label: 'По умолчанию (системный)' }, ...items];
  }, [filteredVoices]);

  const onSpeak  = engine === 'browser' ? handleBrowserSpeak  : engine === 'piper' ? handlePiperSpeak  : engine === 'kokoro' ? handleKokoroSpeak : handleCoquiSpeak;
  const onPause  = engine === 'browser' ? handleBrowserPause  : engine === 'piper' ? handlePiperPause  : engine === 'kokoro' ? handleKokoroPause : handleCoquiPause;
  const onResume = engine === 'browser' ? handleBrowserResume : engine === 'piper' ? handlePiperResume : engine === 'kokoro' ? handleKokoroResume : handleCoquiResume;
  const onStop   = engine === 'browser' ? handleBrowserStop   : engine === 'piper' ? handlePiperStop   : engine === 'kokoro' ? handleKokoroStop : handleCoquiStop;

  const isLoading     = (engine === 'piper' && isPiperLoading) || (engine === 'kokoro' && isKokoroLoading) || (engine === 'coqui' && isCoquiLoading);
  const pauseDisabled = engine === 'browser' ? (!supported || !isSpeaking || isPaused) : localStatus !== 'playing';
  const resumeDisabled= engine === 'browser' ? (!supported || !isPaused)               : localStatus !== 'paused';
  const stopDisabled  = engine === 'browser' ? (!supported || (!isSpeaking && !isPaused)) : localStatus === 'idle';
  const isActive      = engine === 'browser' ? (isSpeaking || isPaused) : localStatus !== 'idle';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Title level={4} style={{ marginBottom: 8 }}>Аудирование</Title>
              <Text type="secondary">
                Выберите движок: Браузерный TTS, Piper, Kokoro или Coqui XTTS v2 (с клонированием голоса, EN/RU и другие языки).
              </Text>
            </div>

            <Radio.Group value={engine} onChange={(e) => setEngine(e.target.value)}>
              <Radio.Button value="browser">Браузерный TTS</Radio.Button>
              <Radio.Button value="piper">Piper</Radio.Button>
              <Radio.Button value="kokoro">Kokoro</Radio.Button>
              <Radio.Button value="coqui">Coqui (клонирование)</Radio.Button>
            </Radio.Group>

            {engine === 'browser' && !supported && (
              <Alert type="warning" showIcon message="Ваш браузер не поддерживает Web Speech API."
                description="Попробуйте открыть раздел в Chrome, Edge или Safari." />
            )}
            {engine === 'piper' && (
              <Alert type="info" showIcon message="Локальный Piper"
                description={<span>Сервер: <Text code>{piperApiUrl}</Text></span>} />
            )}
            {engine === 'kokoro' && (
              <Alert type="info" showIcon message="Локальный Kokoro TTS"
                description={<span>Сервер: <Text code>{kokoroApiUrl}</Text> — запустите <Text code>./tts-server/start-kokoro.sh</Text></span>} />
            )}
            {engine === 'coqui' && (
              <Alert type="info" showIcon message="Локальный Coqui XTTS v2 — клонирование голоса"
                description={<span>Сервер: <Text code>{coquiApiUrl}</Text> — запустите <Text code>./tts-server/start-coqui.sh</Text>. Первый запуск скачивает модель ~2 ГБ.</span>} />
            )}

            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Вставьте текст для озвучивания"
              rows={8}
            />

            <Space wrap>
              <Button type="primary" onClick={onSpeak}
                disabled={engine === 'browser' ? !supported : false} loading={isLoading}>
                Озвучить
              </Button>
              <Button onClick={onPause}   disabled={pauseDisabled}>Пауза</Button>
              <Button onClick={onResume}  disabled={resumeDisabled}>Продолжить</Button>
              <Button danger onClick={onStop} disabled={stopDisabled}>Стоп</Button>
              {engine !== 'browser' && (
                <Button onClick={handleDownload} disabled={!audioUrl}>Скачать WAV</Button>
              )}
              <Text type={isActive ? 'success' : 'secondary'}>Статус: {statusText}</Text>
            </Space>

            {/* ── Browser settings ── */}
            {engine === 'browser' && (
              <>
                <Divider />
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text strong>Голос</Text>
                  <Space align="center" wrap>
                    <Switch checked={onlyEnglish} onChange={setOnlyEnglish} />
                    <Text>Показывать только английские голоса</Text>
                  </Space>
                  <Select value={selectedVoiceURI} onChange={setSelectedVoiceURI}
                    options={voiceOptions} showSearch optionFilterProp="label"
                    style={{ width: '100%' }} placeholder="Выберите голос" disabled={!supported} />
                </Space>
                <Divider />
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text strong>Параметры речи</Text>
                  <Text>Скорость: {rate.toFixed(1)}</Text>
                  <Slider min={0.5} max={2} step={0.1} value={rate} onChange={setRate} disabled={!supported} />
                  <Text>Высота голоса: {pitch.toFixed(1)}</Text>
                  <Slider min={0} max={2} step={0.1} value={pitch} onChange={setPitch} disabled={!supported} />
                  <Text>Громкость: {Math.round(volume * 100)}%</Text>
                  <Slider min={0} max={1} step={0.05} value={volume} onChange={setVolume} disabled={!supported} />
                </Space>
              </>
            )}

            {/* ── Piper settings ── */}
            {engine === 'piper' && (
              <>
                <Divider />
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text strong>Голос Piper</Text>
                  <Select value={piperVoice} onChange={setPiperVoice} style={{ width: '100%' }}
                    options={[
                      { value: 'en_US-lessac-medium', label: 'en_US-lessac-medium — женский, американский' },
                      { value: 'en_US-ryan-medium',   label: 'en_US-ryan-medium — мужской, американский' },
                      { value: 'en_GB-alan-medium',   label: 'en_GB-alan-medium — мужской, британский' },
                    ]}
                  />
                  <Text>Скорость воспроизведения: {piperRate.toFixed(1)}×</Text>
                  <Slider min={0.5} max={2} step={0.1} value={piperRate} onChange={handlePiperRateChange}
                    marks={{ 0.5: '0.5×', 1: '1×', 1.5: '1.5×', 2: '2×' }} />
                </Space>
              </>
            )}

            {/* ── Kokoro settings ── */}
            {engine === 'kokoro' && (
              <>
                <Divider />
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text strong>Голос Kokoro</Text>
                  <Select value={kokoroVoice} onChange={setKokoroVoice} style={{ width: '100%' }}
                    options={KOKORO_VOICES} />

                  <Space align="center" style={{ marginTop: 4 }}>
                    <Switch checked={kokoroMixEnabled} onChange={setKokoroMixEnabled} size="small" />
                    <Text>Смешать с другим голосом</Text>
                  </Space>

                  {kokoroMixEnabled && (
                    <Space direction="vertical" size="small" style={{ width: '100%', paddingLeft: 8, borderLeft: '2px solid #f0f0f0' }}>
                      <Text type="secondary">Второй голос</Text>
                      <Select value={kokoroVoice2} onChange={setKokoroVoice2} style={{ width: '100%' }}
                        options={KOKORO_VOICES.filter(v => v.value !== kokoroVoice)} />
                      <Text>
                        Смесь: <Text strong>{Math.round((1 - kokoroMix) * 100)}%</Text> {kokoroVoice} + <Text strong>{Math.round(kokoroMix * 100)}%</Text> {kokoroVoice2}
                      </Text>
                      <Slider min={0} max={1} step={0.05} value={kokoroMix} onChange={setKokoroMix}
                        marks={{ 0: kokoroVoice.split('_')[1], 0.5: '50/50', 1: kokoroVoice2.split('_')[1] }} />
                    </Space>
                  )}

                  <Text style={{ marginTop: 4 }}>Скорость синтеза: {kokoroSpeed.toFixed(1)}×</Text>
                  <Slider min={0.5} max={2} step={0.1} value={kokoroSpeed} onChange={setKokoroSpeed}
                    marks={{ 0.5: '0.5×', 1: '1×', 1.5: '1.5×', 2: '2×' }} />
                </Space>
              </>
            )}

            {/* ── Coqui settings ── */}
            {engine === 'coqui' && (
              <>
                <Divider />
                <Space direction="vertical" size="small" style={{ width: '100%' }}>

                  <Text strong>Язык синтеза</Text>
                  <Select value={coquiLang} onChange={setCoquiLang} style={{ width: 200 }}
                    options={COQUI_LANGUAGES} />

                  <Divider style={{ margin: '8px 0' }} />

                  <Text strong>Режим голоса</Text>
                  <Radio.Group value={coquiMode} onChange={e => setCoquiMode(e.target.value)} optionType="button" buttonStyle="solid">
                    <Radio.Button value="builtin">Готовые голоса</Radio.Button>
                    <Radio.Button value="cloned">Мой голос (клонирование)</Radio.Button>
                  </Radio.Group>

                  {/* Built-in speakers */}
                  {coquiMode === 'builtin' && (
                    <>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Встроенные голоса XTTS v2. Список загружается после запуска сервера.
                      </Text>
                      {coquiSpeakers.length === 0 ? (
                        <Text type="secondary" style={{ fontStyle: 'italic' }}>
                          Голоса не загружены — сервер не запущен или ещё грузит модель.
                        </Text>
                      ) : (
                        <Select
                          value={coquiSpeaker}
                          onChange={setCoquiSpeaker}
                          style={{ width: '100%' }}
                          showSearch
                          placeholder="Выберите голос"
                          options={coquiSpeakers.map(s => ({ value: s, label: s }))}
                        />
                      )}
                    </>
                  )}

                  {/* Cloned voices */}
                  {coquiMode === 'cloned' && (
                    <>
                  <Text strong>Голоса (образцы для клонирования)</Text>
                  {coquiVoices.length === 0 ? (
                    <Text type="secondary" style={{ fontStyle: 'italic' }}>
                      Нет сохранённых голосов. Запишите или загрузите образец (5–15 секунд речи).
                    </Text>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {coquiVoices.map(v => (
                        <Tag
                          key={v}
                          closable
                          color={coquiVoiceName === v ? 'blue' : 'default'}
                          onClose={(e) => { e.preventDefault(); handleDeleteVoice(v); }}
                          onClick={() => setCoquiVoiceName(v)}
                          style={{ cursor: 'pointer', fontSize: 13, padding: '2px 8px' }}
                        >
                          {v}
                        </Tag>
                      ))}
                    </div>
                  )}
                  {coquiVoiceName && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Выбран: <Text code>{coquiVoiceName}</Text>
                    </Text>
                  )}

                  <Divider style={{ margin: '8px 0' }} />

                  <Text strong>Запись / загрузка образца голоса</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Запишите 5–15 секунд чёткой речи или загрузите WAV/MP3 файл.
                  </Text>

                  {!pendingRecording && (
                    <Space wrap>
                      {!isRecording ? (
                        <Button onClick={handleStartRecording} type="default">
                          🎙 Начать запись
                        </Button>
                      ) : (
                        <Button onClick={handleStopRecording} danger>
                          ⏹ Остановить ({formatTime(recordingTime)})
                        </Button>
                      )}
                      <Button onClick={() => fileInputRef.current?.click()} disabled={isRecording}>
                        Загрузить аудио
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                      />
                    </Space>
                  )}

                  {pendingRecording && (
                    <Space direction="vertical" size="small" style={{ width: '100%', padding: '10px 12px', background: '#f9f9f9', borderRadius: 6, border: '1px solid #e8e8e8' }}>
                      <Text type="secondary">Прослушайте запись и введите имя голоса:</Text>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio src={pendingRecording.url} controls style={{ width: '100%', height: 36 }} />
                      <Space wrap>
                        <Input
                          placeholder="Имя голоса (например: teacher, male_voice)"
                          value={recordingName}
                          onChange={e => setRecordingName(e.target.value)}
                          style={{ width: 260 }}
                          onPressEnter={handleSaveVoice}
                        />
                        <Button
                          type="primary"
                          onClick={handleSaveVoice}
                          disabled={!recordingName.trim()}
                          loading={isSavingVoice}
                        >
                          Сохранить голос
                        </Button>
                        <Button onClick={() => setPendingRecording(null)}>Отмена</Button>
                      </Space>
                    </Space>
                  )}
                    </>
                  )}

                  <Divider style={{ margin: '8px 0' }} />

                  <Text strong>Скорость воспроизведения: {coquiRate.toFixed(1)}×</Text>
                  <Slider min={0.5} max={2} step={0.1} value={coquiRate} onChange={handleCoquiRateChange}
                    marks={{ 0.5: '0.5×', 1: '1×', 1.5: '1.5×', 2: '2×' }} />
                </Space>
              </>
            )}

            <Alert type="info" showIcon message="Совет для аудирования"
              description="Для диктантов используйте скорость 0.8–0.9 и нейтральный голос." />
          </Space>
        </Card>
      </Space>
    </div>
  );
}

export default EnglishTTS;
