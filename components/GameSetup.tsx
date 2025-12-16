import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { TRANSLATIONS, getTranslation } from '../utils/translations';

interface GameSetupProps {
  onStart: (name: string, theme: string, language: Language) => void;
  onLoad: () => void;
  isGenerating: boolean;
}

const SUPPORTED_LANGUAGES: Language[] = ['en', 'zh', 'ja'];

const DEFAULT_THEMES_KEYS = [
  "Cyberpunk Detective",
  "High Fantasy Quest",
  "Cosmic Horror",
  "Post-Apocalyptic Survival",
  "Victorian Mystery",
  "Wacky Cartoon Physics",
  "Space Opera",
  "Western Frontier",
  "Ninja Assassin",
  "Zombie Outbreak",
  "Pirate Adventure",
  "Steampunk Revolution",
  "Fairy Tale Twist",
  "Noir Thriller",
  "Superhero Origin",
  "Time Travel Paradox",
  "Vampire Romance",
  "Ancient Egypt",
  "Viking Saga",
  "Jurassic Survival",
  "Deep Sea Exploration",
  "Haunted Mansion",
  "Alien Invasion",
  "School of Magic",
  "Spy Espionage",
  "Gladiator Arena",
  "Jungle Expedition",
  "Robot Uprising",
  "Medieval Politics",
  "Dream World"
] as const;

export const GameSetup: React.FC<GameSetupProps> = ({ onStart, onLoad, isGenerating }) => {
  const [name, setName] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [selectedThemeKey, setSelectedThemeKey] = useState<string>(DEFAULT_THEMES_KEYS[0]);
  const [language, setLanguage] = useState<Language>('zh'); // Default to Chinese as per prompt implication
  const [hasSave, setHasSave] = useState(false);

  const t = getTranslation(language);

  useEffect(() => {
    const saved = localStorage.getItem('dreamquest_save');
    if (saved) {
      setHasSave(true);
    }
  }, []);

  const handleStart = () => {
    // Get the translated string for the selected theme key, or use custom theme
    const themeToUse = customTheme.trim() ? customTheme : t.themes[selectedThemeKey as keyof typeof t.themes];
    if (name.trim()) {
      onStart(name, themeToUse, language);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-b from-gray-900 to-slate-900">
      
      {/* Language Selector */}
      <div className="absolute top-4 right-4 flex gap-2">
        {SUPPORTED_LANGUAGES.map((lang) => (
            <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${
                    language === lang 
                    ? 'bg-purple-600 text-white shadow-lg' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
            >
                {TRANSLATIONS[lang].langName}
            </button>
        ))}
      </div>

      <div className="w-full max-w-md p-8 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl space-y-8 fade-in flex flex-col max-h-[90vh]">
        <div className="text-center shrink-0">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
            {t.title}
          </h1>
          <p className="text-slate-400">{t.subtitle}</p>
        </div>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          <div className="shrink-0">
            <label className="block text-sm font-bold text-slate-300 mb-1">{t.charName}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.enterName}
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-sm font-bold text-slate-300 mb-2">{t.selectTheme}</label>
            {/* Scrollable Container for Themes */}
            <div className="grid grid-cols-2 gap-2 mb-3 overflow-y-auto pr-2 custom-scrollbar min-h-0">
              {DEFAULT_THEMES_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => { setSelectedThemeKey(key); setCustomTheme(''); }}
                  className={`text-xs p-3 rounded-md transition-all text-center flex items-center justify-center ${
                    selectedThemeKey === key && !customTheme 
                      ? 'bg-purple-600 text-white shadow-lg scale-105' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.themes[key]}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customTheme}
              onChange={(e) => setCustomTheme(e.target.value)}
              placeholder={t.customTheme}
              className="w-full px-4 py-2 bg-slate-900/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm text-white shrink-0"
            />
          </div>
        </div>

        <div className="space-y-3 shrink-0">
          <button
            onClick={handleStart}
            disabled={!name.trim() || isGenerating}
            className={`w-full py-4 rounded-xl font-bold text-lg tracking-wider transition-all transform ${
              !name.trim() || isGenerating
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-105 hover:shadow-purple-500/50 shadow-lg'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t.creating}
              </span>
            ) : (
              t.begin
            )}
          </button>

          {hasSave && !isGenerating && (
            <button
              onClick={onLoad}
              className="w-full py-3 rounded-xl font-bold text-slate-300 border border-slate-600 hover:bg-slate-800 transition-all"
            >
              {t.resume}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};