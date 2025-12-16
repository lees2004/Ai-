import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { StoryTurn, HistoryItem, Language } from "../types";

// Initialize the client
// The API key must be provided via process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const STORY_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "The main story text for this turn. Be descriptive but concise (max 100 words).",
    },
    visualDescription: {
      type: Type.STRING,
      description: "A highly detailed, visual prompt to generate an image for this scene. Focus on lighting, style, and subject.",
    },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
        },
        required: ["id", "text"],
      },
      description: "2 to 4 distinct actions the player can take.",
    },
    hpChange: {
      type: Type.INTEGER,
      description: "Impact on player health. Negative for damage, positive for healing, 0 for neutral.",
    },
  },
  required: ["narrative", "visualDescription", "choices"],
};

const getLanguageInstruction = (lang: Language) => {
  switch (lang) {
    case 'zh': return "IMPORTANT: Write the NARRATIVE and CHOICES strictly in Chinese (Simplified).";
    case 'ja': return "IMPORTANT: Write the NARRATIVE and CHOICES strictly in Japanese.";
    default: return "IMPORTANT: Write the NARRATIVE and CHOICES strictly in English.";
  }
};

export const generateStoryStart = async (
  theme: string,
  name: string,
  language: Language
): Promise<StoryTurn> => {
  const langInstruction = getLanguageInstruction(language);
  const prompt = `Start a text adventure game. 
  Theme: ${theme}. 
  Protagonist: ${name}. 
  
  Set the scene, introduce a conflict, and offer choices.
  Ensure the tone fits the theme.
  
  ${langInstruction}`;

  return await _generateStoryContent(prompt);
};

export const generateStoryTurn = async (
  history: HistoryItem[],
  action: string,
  language: Language
): Promise<StoryTurn> => {
  // Construct a concise context from history (last 3 turns to save tokens/keep context focused)
  const recentHistory = history.slice(-6).map(h => `${h.role}: ${h.text}`).join('\n');
  const langInstruction = getLanguageInstruction(language);
  
  const prompt = `
  Context:
  ${recentHistory}
  
  Player Action: ${action}
  
  Continue the story based on the action. 
  If the action is risky, determine the outcome.
  Provide new choices.

  ${langInstruction}
  `;

  return await _generateStoryContent(prompt);
};

const _generateStoryContent = async (prompt: string): Promise<StoryTurn> => {
  try {
    const response = await ai.models.generateContent({
      model: STORY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "You are a master RPG dungeon master. Create immersive, fun, and slightly unpredictable narratives. Always return valid JSON.",
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    if (!response.text) {
      throw new Error("No text returned from Gemini");
    }

    return JSON.parse(response.text) as StoryTurn;
  } catch (error) {
    console.error("Story Generation Error:", error);
    // Fallback in case of severe error
    return {
      narrative: "The mists of chaos swirl around you, obscuring reality (API Error). Try again?",
      visualDescription: "Abstract chaotic fog, dark fantasy style",
      choices: [{ id: "retry", text: "Try to focus (Retry)" }],
      hpChange: 0
    };
  }
};

export const generateSceneImage = async (visualDescription: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: `High quality digital art, cinematic lighting, detailed, ${visualDescription}`,
      // No responseMimeType for image generation models in this context usually, 
      // but we need to parse the parts for inlineData
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null; 
  }
};

export const generateNarrativeAudio = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // Kore is generally a good balanced voice, it handles many languages decently for a model of this type.
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      return part.inlineData.data;
    }
    return null;
  } catch (error) {
    console.error("Audio Generation Error:", error);
    return null;
  }
};
