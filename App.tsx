import React, { useState } from 'react';
import { GameState, GameContext, StoryTurn, HistoryItem, Language } from './types';
import { GameSetup } from './components/GameSetup';
import { GameInterface } from './components/GameInterface';
import { generateStoryStart, generateStoryTurn, generateSceneImage, generateNarrativeAudio } from './services/geminiService';
import { getTranslation } from './utils/translations';

// --- Wav Helper for Storybook ---
function pcmToWav(pcmBase64: string, sampleRate: number = 24000): string {
  const binaryString = atob(pcmBase64);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + len, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(view, 36, 'data');
  view.setUint32(40, len, true);

  const bytes = new Uint8Array(buffer, 44);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Convert buffer to binary string for btoa
  let binary = '';
  const bytesAll = new Uint8Array(buffer);
  const lenAll = bytesAll.byteLength;
  const chunk = 8192;
  for (let i = 0; i < lenAll; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytesAll.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

// BGM Script for Downloaded HTML
const AMBIENT_DRONE_SCRIPT = `
class AmbientDrone {
  constructor() {
     const AudioContextClass = window.AudioContext || window.webkitAudioContext;
     this.ctx = new AudioContextClass();
     this.masterGain = this.ctx.createGain();
     this.masterGain.gain.value = 0;
     this.masterGain.connect(this.ctx.destination);
     this.oscs = [];
     this.isPlaying = false;
  }
  start() {
    if (this.isPlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stopNodes();
    const freqs = [110.00, 130.81, 164.81, 196.00]; 
    const now = this.ctx.currentTime;
    freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f;
        osc.detune.value = Math.random() * 10 - 5;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.05;
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        this.oscs.push(osc);
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.1 + Math.random() * 0.2;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.02; 
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start(now);
        this.oscs.push(lfo);
    });
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(0.15, now + 3);
    this.isPlaying = true;
  }
  stop() {
    if (!this.isPlaying) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + 2);
    setTimeout(() => this.stopNodes(), 2000);
    this.isPlaying = false;
  }
  stopNodes() {
    this.oscs.forEach(o => { try { o.stop(); o.disconnect(); } catch(e){} });
    this.oscs = [];
  }
}
let drone = new AmbientDrone();
function toggleBgm() {
    if(drone.isPlaying) { drone.stop(); document.getElementById('bgmBtn').innerText = '🎵 Play Ambient Music'; }
    else { drone.start(); document.getElementById('bgmBtn').innerText = '🎵 Stop Music'; }
}
`;

// Helper to load image
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Helper to decode PCM base64 to AudioBuffer
const decodeAudioForVideo = async (base64: string, ctx: AudioContext): Promise<AudioBuffer> => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000); // 24kHz Gemini specific
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
};

// Helper to wrap text on canvas
const drawTextOverlay = (ctx: CanvasRenderingContext2D, text: string) => {
    const width = 1280;
    const height = 720;
    
    // Semi-transparent bg
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, height - 200, width, 200);
    
    ctx.font = '30px Georgia';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    // Wrap text
    const words = text.split('');
    let line = '';
    const lines = [];
    const maxWidth = width - 100;
    
    for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n];
        } else {
            line = testLine;
        }
    }
    lines.push(line);
    
    // Draw lines
    const startY = height - 160 + (4 - Math.min(4, lines.length)) * 20;
    for(let i=0; i<Math.min(4, lines.length); i++) {
        ctx.fillText(lines[i], width/2, startY + (i*40));
    }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.SETUP);
  const [gameContext, setGameContext] = useState<GameContext>({
    theme: '',
    characterName: '',
    hp: 100,
    language: 'zh',
  });
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [storyLog, setStoryLog] = useState<{narrative: string; image?: string | null; audio?: string | null}[]>([]); 
  const [currentTurn, setCurrentTurn] = useState<StoryTurn | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);

  const generateMedia = async (turn: StoryTurn) => {
    const promises: Promise<void>[] = [];
    if (turn.visualDescription) {
      promises.push(
        generateSceneImage(turn.visualDescription).then(img => {
          if (img) setCurrentImage(img);
        })
      );
    }
    if (turn.narrative) {
      setCurrentAudio(null);
      promises.push(
        generateNarrativeAudio(turn.narrative).then(audio => {
           if (audio) setCurrentAudio(audio);
        })
      );
    }
    await Promise.all(promises);
  };

  const startGame = async (name: string, theme: string, language: Language) => {
    setIsProcessing(true);
    setGameContext({ theme, characterName: name, hp: 100, language });
    try {
      const turn = await generateStoryStart(theme, name, language);
      setCurrentTurn(turn);
      await generateMedia(turn);
      setGameState(GameState.PLAYING);
      setHistory([{ role: 'model', text: JSON.stringify(turn) }]);
      setStoryLog([]);
    } catch (error) {
      alert("Failed to start adventure. Please check your API Key.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChoice = async (choiceText: string) => {
    if (!currentTurn) return;

    setStoryLog(prev => [...prev, { 
        narrative: currentTurn.narrative, 
        image: currentImage,
        audio: currentAudio
    }]);
    
    setCurrentAudio(null);
    setIsProcessing(true);

    try {
      const updatedHistory: HistoryItem[] = [
        ...history,
        { role: 'user', text: choiceText }
      ];

      const newTurn = await generateStoryTurn(updatedHistory, choiceText, gameContext.language);
      
      if (newTurn.hpChange) {
        setGameContext(prev => ({
          ...prev,
          hp: Math.min(100, Math.max(0, prev.hp + newTurn.hpChange!))
        }));
      }

      setCurrentTurn(newTurn);
      setHistory([...updatedHistory, { role: 'model', text: JSON.stringify(newTurn) }]);
      await generateMedia(newTurn);

    } catch (error) {
      console.error("Turn generation failed", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveGame = () => {
    if (!currentTurn) return;
    const saveState = {
      gameContext,
      history,
      storyLog: storyLog.map(s => ({ narrative: s.narrative })), 
      currentTurn,
    };
    try {
      localStorage.setItem('dreamquest_save', JSON.stringify(saveState));
    } catch (e) {
      alert("Failed to save game (storage full?)");
    }
  };

  const loadGame = () => {
    try {
      const saved = localStorage.getItem('dreamquest_save');
      if (saved) {
        const state = JSON.parse(saved);
        setGameContext(state.gameContext);
        setHistory(state.history);
        setStoryLog(state.storyLog);
        setCurrentTurn(state.currentTurn);
        setCurrentImage(null); 
        setCurrentAudio(null);
        setGameState(GameState.PLAYING);
      }
    } catch (e) {
      alert("Failed to load save file.");
    }
  };

  const generateStorybook = () => {
    const t = getTranslation(gameContext.language);
    
    const fullStory = [
      ...storyLog,
      { narrative: currentTurn?.narrative || '', image: currentImage, audio: currentAudio }
    ].filter(s => s.narrative);

    const contentHtml = fullStory.map(entry => {
        let audioTag = '';
        if (entry.audio) {
            try {
                const wavBase64 = pcmToWav(entry.audio);
                audioTag = `
                  <div class="audio-control">
                    <audio controls src="data:audio/wav;base64,${wavBase64}"></audio>
                  </div>
                `;
            } catch(e) {
                console.error("Audio conversion failed", e);
            }
        }

        return `
            <div class="chapter-container">
               ${entry.image ? `<img src="${entry.image}" class="scene-image" alt="Scene" />` : ''}
               <p class="chapter-text">${entry.narrative}</p>
               ${audioTag}
            </div>
        `;
    }).join('');

    const langTag = gameContext.language === 'zh' ? 'zh-CN' : (gameContext.language === 'ja' ? 'ja-JP' : 'en-US');

    const bookContent = `
      <!DOCTYPE html>
      <html lang="${langTag}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${gameContext.characterName}'s Adventure</title>
        <style>
          body { font-family: 'Georgia', serif; line-height: 1.8; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px; background: #fdfbf7; }
          h1 { text-align: center; color: #4a4a4a; margin-bottom: 10px; }
          .subtitle { text-align: center; color: #888; margin-bottom: 40px; font-style: italic; }
          .chapter-container { margin-bottom: 40px; page-break-inside: avoid; border-bottom: 1px solid #eee; padding-bottom: 40px; }
          .scene-image { width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; display: block; }
          .chapter-text { text-indent: 2em; margin-top: 0; font-size: 1.1em; }
          .audio-control { margin-top: 10px; display: flex; justify-content: center; }
          audio { width: 100%; max-width: 400px; }
          .controls { position: fixed; bottom: 20px; right: 20px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border: 1px solid #ddd; z-index: 100; display: flex; flex-direction: column; gap: 10px; }
          button { background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; }
          button:hover { background: #4338ca; }
          button.bgm { background: #0891b2; }
          button.bgm:hover { background: #0e7490; }
          @media print {
            .controls { display: none; }
            .audio-control { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${gameContext.theme}</h1>
        <div class="subtitle">${t.subtitle} - ${gameContext.characterName}</div>
        
        <div id="content">
          ${contentHtml}
        </div>

        <div class="controls">
          <button class="bgm" id="bgmBtn" onclick="toggleBgm()">🎵 Play Ambient Music</button>
        </div>

        <script>
          ${AMBIENT_DRONE_SCRIPT}
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([bookContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DreamQuest-${gameContext.characterName}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadVideo = async () => {
    if (isRenderingVideo) return;
    setIsRenderingVideo(true);
    const t = getTranslation(gameContext.language);
    
    try {
        const fullStory = [
          ...storyLog,
          { narrative: currentTurn?.narrative || '', image: currentImage, audio: currentAudio }
        ].filter(s => s.narrative);

        // Setup Canvas & Audio
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas init failed");

        const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = actx.createMediaStreamDestination();
        
        // Setup Recorder
        const stream = canvas.captureStream(30);
        if (dest.stream.getAudioTracks().length > 0) {
            stream.addTrack(dest.stream.getAudioTracks()[0]);
        }
        
        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
             mimeType = 'video/webm; codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
             mimeType = 'video/mp4'; // Safari
        }
        
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        
        recorder.start();

        // --- Render Loop ---
        for (const entry of fullStory) {
            // Draw background
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0,0,1280,720);
            
            if (entry.image) {
                try {
                    const img = await loadImage(entry.image);
                    // Draw image centered and contained/covered? Covered is better for background
                    // Simple cover algo
                    const scale = Math.max(1280 / img.width, 720 / img.height);
                    const x = (1280 - img.width * scale) / 2;
                    const y = (720 - img.height * scale) / 2;
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                } catch(e) {
                    console.error("Failed to load image for video", e);
                }
            }
            
            // Draw text
            drawTextOverlay(ctx, entry.narrative);
            
            // Play Audio
            let duration = 3000;
            if (entry.audio) {
                try {
                    const buffer = await decodeAudioForVideo(entry.audio, actx);
                    const source = actx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(dest);
                    source.start();
                    duration = buffer.duration * 1000 + 500; // Buffer + 500ms padding
                } catch (e) {
                    console.error("Audio decode fail", e);
                }
            } else {
                // Estimate duration if no audio
                duration = Math.max(3000, entry.narrative.length * 100);
            }
            
            // Wait for duration (rendering in real-time)
            await new Promise(r => setTimeout(r, duration));
        }

        recorder.stop();
        
        // Wait for stop event
        await new Promise<void>(resolve => {
            recorder.onstop = () => resolve();
        });

        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DreamQuest-${gameContext.characterName}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (e) {
        console.error("Video export failed", e);
        alert("Failed to export video. " + e);
    } finally {
        setIsRenderingVideo(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 font-sans">
      {/* Video Rendering Overlay */}
      {isRenderingVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center text-white">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-bold animate-pulse">{getTranslation(gameContext.language).generatingVideo}</h2>
            <p className="text-sm text-gray-400 mt-2">Do not close this tab.</p>
        </div>
      )}

      {gameState === GameState.SETUP && (
        <GameSetup 
          onStart={startGame} 
          onLoad={loadGame}
          isGenerating={isProcessing} 
        />
      )}
      
      {gameState === GameState.PLAYING && (
        <GameInterface 
          currentTurn={currentTurn}
          currentImage={currentImage}
          currentAudio={currentAudio}
          gameContext={gameContext}
          onChoice={handleChoice}
          onSave={saveGame}
          onDownloadBook={generateStorybook}
          onDownloadVideo={handleDownloadVideo}
          isProcessing={isProcessing}
          historyLog={storyLog}
        />
      )}
    </div>
  );
};

export default App;