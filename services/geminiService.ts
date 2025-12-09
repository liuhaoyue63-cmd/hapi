import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SongData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const songSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A creative title for the generated song" },
    artist: { type: Type.STRING, description: "An imaginary artist name fitting the mood" },
    description: { type: Type.STRING, description: "A poetic description of the soundscape" },
    tempo: { type: Type.NUMBER, description: "BPM, between 60 and 140" },
    key: { type: Type.STRING, description: "Musical key (e.g., C, F#, Am)" },
    scale: { 
      type: Type.STRING, 
      enum: ['major', 'minor', 'diminished', 'pentatonic'],
      description: "Musical scale" 
    },
    visualParams: {
      type: Type.OBJECT,
      properties: {
        chaos: { type: Type.NUMBER, description: "0.0 to 1.0, how chaotic the particles move" },
        speed: { type: Type.NUMBER, description: "0.1 to 2.0, movement speed" },
        size: { type: Type.NUMBER, description: "0.1 to 2.0, particle size multiplier" },
        colorPalette: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Array of 3 hex color codes matching the mood and user preference"
        },
        shape: {
          type: Type.STRING,
          enum: ['sphere', 'cat', 'flower', 'fish', 'star'],
          description: "The 3D shape the particles should form."
        }
      },
      required: ["chaos", "speed", "size", "colorPalette", "shape"]
    }
  },
  required: ["title", "artist", "description", "tempo", "key", "scale", "visualParams"]
};

export const generateSongFromMood = async (mood: string, color: string): Promise<SongData> => {
  const prompt = `
    The user is feeling "${mood}" and their favorite color is "${color}".
    Generate a fictional song concept and visualizer configuration.
    
    Audio Requirements:
    - The style should be melodious, ambient, and use PIANO as a primary influence.
    - Focus on harmony and emotion.
    
    Visual Requirements:
    - Colors should blend the user's favorite color with emotional tones.
    - Chaos should be lower for calm moods, higher for angry/intense moods.
    
    CRITICAL SHAPE RULES:
    1. If the mood implies SADNESS, LONELINESS, or MELANCHOLY -> Set shape to 'cat'.
    2. If the mood implies ANGER, RAGE, or INTENSITY -> Set shape to 'flower'.
    3. If the mood implies ANXIETY, NERVOUSNESS, or WORRY -> Set shape to 'fish'.
    4. If the mood implies HAPPINESS, JOY, or EXCITEMENT -> Set shape to 'star'.
    5. Otherwise -> Set shape to 'sphere'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: songSchema,
        systemInstruction: "You are an expert audio-visual artist. Follow the shape mapping rules strictly."
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SongData;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback data
    return {
      title: "Connection Lost",
      artist: "System",
      description: "Could not generate song data. Please check API Key.",
      tempo: 60,
      key: "C",
      scale: "major",
      visualParams: {
        chaos: 0.1,
        speed: 0.5,
        size: 1,
        colorPalette: ["#ffffff", "#888888", "#000000"],
        shape: 'sphere'
      }
    };
  }
};