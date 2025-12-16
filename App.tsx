import React, { useState } from 'react';
import { GameState, GameContext, StoryTurn, HistoryItem, Language } from './types';
import { GameSetup } from './components/GameSetup';
import { GameInterface } from './components/GameInterface';
import { generateStoryStart, generateStoryTurn, generateSceneImage, generateNarrativeAudio } from './services/geminiService';
import { getTranslation } from './utils/translations';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.SETUP);
  const [gameContext, setGameContext] = useState<GameContext>({
    theme: '',
    characterName: '',
    hp: 100,
    language: 'zh', // Default
  });
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  // Updated state: stores narrative AND optional image for each past turn
  const [storyLog, setStoryLog] = useState<{narrative: string; image?: string | null}[]>([]); 
  const [currentTurn, setCurrentTurn] = useState<StoryTurn | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper to generate visuals and audio in parallel
  const generateMedia = async (turn: StoryTurn) => {
    const promises: Promise<void>[] = [];

    // Image
    if (turn.visualDescription) {
      promises.push(
        generateSceneImage(turn.visualDescription).then(img => {
          if (img) setCurrentImage(img);
        })
      );
    }

    // Audio
    if (turn.narrative) {
      // Clear previous audio immediately to stop playback of old turn
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
    setGameContext({ name, theme, characterName: name, hp: 100, language });
    
    try {
      // 1. Generate text
      const turn = await generateStoryStart(theme, name, language);
      setCurrentTurn(turn);
      
      // 2. Generate Media
      await generateMedia(turn);

      setGameState(GameState.PLAYING);
      setHistory([{ role: 'model', text: JSON.stringify(turn) }]);
      // Reset log on new game
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

    // Archive current turn narrative AND IMAGE for the storybook
    setStoryLog(prev => [...prev, { 
        narrative: currentTurn.narrative, 
        image: currentImage 
    }]);
    
    // Don't clear image immediately to prevent flickering, but we can clear audio
    setCurrentAudio(null);
    setIsProcessing(true);

    try {
      const updatedHistory: HistoryItem[] = [
        ...history,
        { role: 'user', text: choiceText }
      ];

      // 1. Generate Next Turn Text
      const newTurn = await generateStoryTurn(updatedHistory, choiceText, gameContext.language);
      
      // Update HP
      if (newTurn.hpChange) {
        setGameContext(prev => ({
          ...prev,
          hp: Math.min(100, Math.max(0, prev.hp + newTurn.hpChange!))
        }));
      }

      setCurrentTurn(newTurn);
      setHistory([...updatedHistory, { role: 'model', text: JSON.stringify(newTurn) }]);

      // 2. Generate Media
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
      // We must strip images from storyLog before saving to avoid localStorage quota limits
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
        setStoryLog(state.storyLog); // Restored logs will have undefined images, which is fine
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
    // Combine past log with current state
    const fullStory = [
      ...storyLog,
      { narrative: currentTurn?.narrative || '', image: currentImage }
    ].filter(s => s.narrative);

    // Map internal language code to BCP 47 language tag for TTS
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
          .chapter-container { margin-bottom: 40px; page-break-inside: avoid; }
          .scene-image { width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; display: block; }
          .chapter-text { text-indent: 2em; margin-top: 0; }
          .controls { position: fixed; bottom: 20px; right: 20px; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #eee; z-index: 100; }
          button { background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; }
          button:hover { background: #4338ca; }
          @media print {
            .controls { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${gameContext.theme}</h1>
        <div class="subtitle">${t.subtitle} - ${gameContext.characterName}</div>
        
        <div id="content">
          ${fullStory.map(entry => `
            <div class="chapter-container">
               ${entry.image ? `<img src="${entry.image}" class="scene-image" alt="Scene" />` : ''}
               <p class="chapter-text">${entry.narrative}</p>
            </div>
          `).join('')}
        </div>

        <div class="controls">
          <button onclick="readAloud()">${t.readAloud}</button>
        </div>

        <script>
          function readAloud() {
            window.speechSynthesis.cancel();
            const text = document.querySelectorAll('.chapter-text');
            let fullText = "";
            text.forEach(p => fullText += p.innerText + " ");
            
            const utterance = new SpeechSynthesisUtterance(fullText);
            utterance.lang = '${langTag}';
            utterance.rate = 1;
            utterance.pitch = 1;
            window.speechSynthesis.speak(utterance);
          }
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

  return (
    <div className="min-h-screen bg-gray-900 font-sans">
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
          isProcessing={isProcessing}
          historyLog={storyLog}
        />
      )}
    </div>
  );
};

export default App;
