import React, { useRef, useEffect, useState } from 'react';
import { StoryTurn, GameContext } from '../types';
import { TypewriterText } from './TypewriterText';
import { getTranslation } from '../utils/translations';

interface GameInterfaceProps {
  currentTurn: StoryTurn | null;
  currentImage: string | null;
  currentAudio: string | null;
  gameContext: GameContext;
  onChoice: (choiceText: string) => void;
  onSave: () => void;
  onDownloadBook: () => void;
  onDownloadVideo: () => void;
  isProcessing: boolean;
  historyLog: { narrative: string; image?: string | null }[];
}

// --- Audio Utilities ---
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext
): Promise<AudioBuffer> {
  const sampleRate = 24000;
  const numChannels = 1;
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Ambient BGM Generator ---
class AmbientDrone {
  ctx: AudioContext;
  masterGain: GainNode;
  oscs: OscillatorNode[] = [];
  isPlaying: boolean = false;
  
  constructor() {
     const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
     this.ctx = new AudioContextClass();
     this.masterGain = this.ctx.createGain();
     this.masterGain.gain.value = 0; // Start silent
     this.masterGain.connect(this.ctx.destination);
  }

  start() {
    if (this.isPlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    this.stopNodes();
    
    // Create a mysterious minor chord pad (A2, C3, E3, G3)
    const freqs = [110.00, 130.81, 164.81, 196.00]; 
    const now = this.ctx.currentTime;

    freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f;
        
        // Detune slightly for organic warmth
        osc.detune.value = Math.random() * 10 - 5;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.05; // Low volume individual osc
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        this.oscs.push(osc);
        
        // Simple LFO to modulate amplitude for movement
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.1 + Math.random() * 0.2; // Slow pulse
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.02; 
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start(now);
        this.oscs.push(lfo);
    });

    // Fade in
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(0.15, now + 3);
    this.isPlaying = true;
  }

  stop() {
    if (!this.isPlaying) return;
    const now = this.ctx.currentTime;
    // Fade out
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + 2);
    
    setTimeout(() => this.stopNodes(), 2000);
    this.isPlaying = false;
  }

  private stopNodes() {
    this.oscs.forEach(o => {
        try { o.stop(); o.disconnect(); } catch(e){}
    });
    this.oscs = [];
  }
}

export const GameInterface: React.FC<GameInterfaceProps> = ({
  currentTurn,
  currentImage,
  currentAudio,
  gameContext,
  onChoice,
  onSave,
  onDownloadBook,
  onDownloadVideo,
  isProcessing,
  historyLog,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Audio State
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [bgmEnabled, setBgmEnabled] = useState(true); // Default BGM ON
  const [customInput, setCustomInput] = useState('');
  
  const [showSaveNotif, setShowSaveNotif] = useState(false);
  
  // Refs for Audio
  const voiceContextRef = useRef<AudioContext | null>(null);
  const voiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmRef = useRef<AmbientDrone | null>(null);

  const t = getTranslation(gameContext.language);

  // Initialize BGM Ref
  useEffect(() => {
    bgmRef.current = new AmbientDrone();
    // Auto-start BGM if enabled
    if (bgmEnabled) {
        bgmRef.current.start();
    }
    return () => {
      bgmRef.current?.stop();
    };
  }, []);

  // Handle BGM Toggle
  useEffect(() => {
    if (bgmEnabled) {
      bgmRef.current?.start();
    } else {
      bgmRef.current?.stop();
    }
  }, [bgmEnabled]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [historyLog, currentTurn, isProcessing]);

  // Handle Save Notification
  const handleSaveClick = () => {
    onSave();
    setShowSaveNotif(true);
    setTimeout(() => setShowSaveNotif(false), 2000);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim() && !isProcessing) {
        onChoice(customInput.trim());
        setCustomInput('');
    }
  };

  // Handle Voice Playback
  useEffect(() => {
    // If no audio (or cleared), stop playing
    if (!currentAudio) {
      if (voiceSourceRef.current) {
        try { voiceSourceRef.current.stop(); } catch(e) {}
        voiceSourceRef.current = null;
      }
      setIsPlayingVoice(false);
      return;
    }

    if (!voiceEnabled) return;

    const playAudio = async () => {
      try {
        if (!voiceContextRef.current) {
          voiceContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        if (voiceContextRef.current.state === 'suspended') {
          await voiceContextRef.current.resume();
        }
        // Stop any previous voice immediately
        if (voiceSourceRef.current) {
          try { voiceSourceRef.current.stop(); } catch(e) {}
          voiceSourceRef.current.disconnect();
        }

        const bytes = decodeBase64(currentAudio);
        const buffer = await decodeAudioData(bytes, voiceContextRef.current);

        const source = voiceContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(voiceContextRef.current.destination);
        source.onended = () => setIsPlayingVoice(false);
        
        voiceSourceRef.current = source;
        source.start();
        setIsPlayingVoice(true);
      } catch (e) {
        console.error("Audio playback failed", e);
        setIsPlayingVoice(false);
      }
    };

    playAudio();

    return () => {
      if (voiceSourceRef.current) {
        try { voiceSourceRef.current.stop(); } catch(e) {}
      }
    };
  }, [currentAudio, voiceEnabled]);

  const toggleVoice = () => {
    if (isPlayingVoice && voiceSourceRef.current) {
        voiceSourceRef.current.stop();
        setIsPlayingVoice(false);
        setVoiceEnabled(false);
    } else {
        setVoiceEnabled(!voiceEnabled);
    }
  };

  if (!currentTurn) return null;

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden max-w-5xl mx-auto shadow-2xl border-x border-gray-800">
      
      {/* Header Stats & Controls */}
      <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 bg-gray-800 border-b border-gray-700 z-10 shrink-0 gap-2">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-xl shadow-inner shrink-0">
                {gameContext.characterName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
                <h2 className="font-bold text-lg leading-none">{gameContext.characterName}</h2>
                <span className="text-xs text-purple-400 uppercase tracking-wider">{gameContext.theme}</span>
            </div>
        </div>

        <div className="flex items-center gap-2">
            {/* BGM Toggle */}
            <button 
                onClick={() => setBgmEnabled(!bgmEnabled)}
                className={`flex items-center gap-1.5 p-2 px-3 rounded-full border transition-colors ${
                    bgmEnabled ? 'bg-indigo-900/50 border-indigo-500 text-indigo-200' : 'bg-gray-800 border-gray-600 text-gray-500'
                }`}
                title="Toggle Music"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                <span className="hidden sm:inline text-xs">{bgmEnabled ? t.bgmOn : t.bgmOff}</span>
            </button>

            {/* Voice Toggle */}
            <button 
                onClick={toggleVoice}
                className={`flex items-center gap-1.5 p-2 px-3 rounded-full border transition-colors ${
                    voiceEnabled ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'bg-gray-800 border-gray-600 text-gray-500'
                }`}
                title="Toggle Voice"
            >
                {voiceEnabled ? (
                    <>
                    <svg className={`w-4 h-4 ${isPlayingVoice ? 'animate-pulse' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" /></svg>
                    <span className="hidden sm:inline text-xs">{t.voiceOn}</span>
                    </>
                ) : (
                    <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    <span className="hidden sm:inline text-xs">{t.mute}</span>
                    </>
                )}
            </button>

            {/* Save Button */}
            <button 
                onClick={handleSaveClick}
                className="p-2 rounded-full border border-gray-600 hover:border-green-500 hover:text-green-400 bg-gray-800 transition-colors relative"
                title={t.save}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                {showSaveNotif && (
                   <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs bg-green-600 text-white px-2 py-1 rounded w-max">{t.saved}</span>
                )}
            </button>
            
            {/* Storybook Button */}
            <button 
                onClick={onDownloadBook}
                className="p-2 rounded-full border border-gray-600 hover:border-blue-500 hover:text-blue-400 bg-gray-800 transition-colors"
                title={t.download}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </button>

             {/* Video Button */}
             <button 
                onClick={onDownloadVideo}
                className="p-2 rounded-full border border-gray-600 hover:border-red-500 hover:text-red-400 bg-gray-800 transition-colors"
                title={t.downloadVideo}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            </button>

            {/* HP */}
            <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-700 ml-2">
                <span className="text-red-500 font-bold">♥</span>
                <span className={`font-mono font-bold ${gameContext.hp < 30 ? 'text-red-400' : 'text-green-400'}`}>
                    {gameContext.hp}%
                </span>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        {/* Past History */}
        {historyLog.map((log, index) => (
            <div key={index} className="opacity-60 text-sm border-l-2 border-gray-700 pl-4 py-1">
                {log.narrative}
            </div>
        ))}

        {/* Current Turn Visualization */}
        <div className="space-y-4 fade-in pb-24">
            {currentImage ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-gray-700 group">
                    <img 
                        src={currentImage} 
                        alt="Scene" 
                        className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110 ease-linear"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-80"></div>
                </div>
            ) : isProcessing ? (
                <div className="w-full aspect-video rounded-xl bg-gray-800 animate-pulse flex items-center justify-center border border-gray-700">
                     <span className="text-gray-500 font-serif italic">{t.painting}</span>
                </div>
            ) : null}

            {/* Current Narrative */}
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm relative min-h-[150px]">
                {/* 
                   Keying the Typewriter with the narrative string ensures it fully resets 
                   if the text content changes, though useEffect handles it too.
                   Speed decreased to 50ms (from ~20ms) to allow audio to catch up 
                   and stay relatively in sync with the reading speed.
                */}
                <TypewriterText 
                    key={currentTurn.narrative.substring(0, 10)} 
                    text={currentTurn.narrative} 
                    speed={50} 
                />
                
                {currentAudio && isPlayingVoice && (
                    <div className="absolute top-2 right-2 flex gap-0.5">
                        <div className="w-1 h-3 bg-purple-500 animate-[bounce_1s_infinite]"></div>
                        <div className="w-1 h-3 bg-purple-500 animate-[bounce_1.2s_infinite]"></div>
                        <div className="w-1 h-3 bg-purple-500 animate-[bounce_0.8s_infinite]"></div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Controls Area (Sticky Bottom) */}
      <div className="bg-gray-900/95 border-t border-gray-800 p-4 shrink-0 backdrop-blur pb-8">
        {isProcessing ? (
             <div className="flex flex-col items-center justify-center gap-3 py-4">
                <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-0"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-200"></div>
                </div>
                <span className="text-sm text-purple-400 animate-pulse">{t.consulting}</span>
             </div>
        ) : (
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Generated Choices */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {currentTurn.choices.map((choice) => (
                        <button
                            key={choice.id}
                            onClick={() => onChoice(choice.text)}
                            className="text-left px-4 py-3 bg-gray-800 hover:bg-purple-900/40 border border-gray-700 hover:border-purple-500 rounded-lg transition-all active:scale-95 group shadow-lg flex flex-col h-full"
                        >
                            <span className="block text-[10px] text-gray-500 group-hover:text-purple-300 mb-1 uppercase tracking-wider">{t.option}</span>
                            <span className="font-bold text-gray-200 group-hover:text-white text-sm leading-tight">{choice.text}</span>
                        </button>
                    ))}
                </div>

                {/* Custom Input */}
                <form onSubmit={handleCustomSubmit} className="flex gap-2 pt-2 border-t border-gray-800">
                    <input 
                        type="text" 
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder={t.customAction}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition-colors text-sm"
                    />
                    <button 
                        type="submit"
                        disabled={!customInput.trim()}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-all text-sm uppercase tracking-wide"
                    >
                        {t.act}
                    </button>
                </form>
            </div>
        )}
      </div>
    </div>
  );
};