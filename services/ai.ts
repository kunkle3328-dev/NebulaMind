import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Notebook, Source } from "../types";
import { RAG_SYSTEM_INSTRUCTION } from "../constants";
import { base64ToUint8Array, createWavUrl } from "./audioUtils";

// Initialize the client
// NOTE: In a real production app, API calls should be proxied through a backend to hide the key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_TEXT = 'gemini-2.5-flash'; // Fast, good for RAG & Ingestion
const MODEL_REASONING = 'gemini-2.5-flash'; // General purpose
const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';
const MODEL_TTS = 'gemini-2.5-flash-preview-tts';

// Helper to combine sources into context
const formatContext = (sources: Source[]): string => {
  return sources.map(s => `SOURCE: ${s.title}\nCONTENT:\n${s.content}\n---`).join('\n');
};

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// ---------------------------------------------------------
// SOURCE INGESTION
// ---------------------------------------------------------

export const processFileWithGemini = async (file: File, mimeType: string): Promise<string> => {
    const base64Data = await fileToBase64(file);
    
    let prompt = "Extract all text from this document. Preserve formatting where possible.";
    if (mimeType.startsWith('audio/')) {
        prompt = "Transcribe this audio file verbatim. Identify speakers if possible.";
    } else if (mimeType.startsWith('image/')) {
        prompt = "Extract all visible text from this image. Describe any charts or diagrams in detail.";
    }

    const response = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: prompt }
            ]
        }
    });

    return response.text || "No text extracted.";
};

export const fetchWebsiteContent = async (url: string): Promise<string> => {
    // Use a CORS proxy to fetch the HTML content
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Failed to fetch website");
        const html = await response.text();
        
        // Parse HTML and extract text
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Remove scripts, styles, and other non-text elements
        const scripts = doc.querySelectorAll('script, style, noscript, iframe, svg');
        scripts.forEach(s => s.remove());
        
        // Get text content and clean it up
        const text = doc.body.innerText;
        return text.replace(/\s+/g, ' ').trim().substring(0, 50000); // Limit to ~50k chars
    } catch (error) {
        console.error("Website fetch error:", error);
        throw new Error("Could not fetch website content. It might be blocked or require a login.");
    }
};

// ---------------------------------------------------------
// RAG & GENERATION
// ---------------------------------------------------------

export const generateAnswer = async (
  query: string,
  sources: Source[],
  onStream: (text: string) => void
) => {
  if (sources.length === 0) {
    onStream("Please add sources to your notebook first.");
    return;
  }

  const context = formatContext(sources);
  const prompt = `
  CONTEXT FROM SOURCES:
  ${context}

  USER QUESTION: ${query}
  
  Answer the user question using ONLY the context above and using Google Search.
  `;

  try {
    const response = await ai.models.generateContentStream({
      model: MODEL_TEXT,
      contents: prompt,
      config: {
        systemInstruction: RAG_SYSTEM_INSTRUCTION,
      }
    });

    for await (const chunk of response) {
      if (chunk.text) {
        onStream(chunk.text);
      }
    }
  } catch (error) {
    console.error("Gemini Error:", error);
    onStream("Error generating response. Please check your API key or connection.");
  }
};

export const generateArtifact = async (
  type: 'flashcards' | 'quiz' | 'infographic' | 'slideDeck',
  sources: Source[]
) => {
  const context = formatContext(sources);
  let prompt = "";
  let schema: any = {};

  switch (type) {
    case 'flashcards':
      prompt = "Generate 5-10 flashcards (term and definition) based on the context.";
      schema = {
        type: Type.OBJECT,
        properties: {
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                definition: { type: Type.STRING },
              },
              required: ['term', 'definition']
            }
          }
        }
      };
      break;
    case 'quiz':
      prompt = "Generate a quiz with 3 multiple choice questions based on the context.";
      schema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswerIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ['question', 'options', 'correctAnswerIndex']
            }
          }
        }
      };
      break;
     case 'infographic':
        prompt = "Create a structured outline for an infographic based on the key statistics and points in the text.";
        schema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                sections: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            heading: {type: Type.STRING},
                            points: {type: Type.ARRAY, items: {type: Type.STRING}},
                            iconSuggestion: {type: Type.STRING}
                        }
                    }
                }
            }
        };
        break;
      case 'slideDeck':
        prompt = "Create a slide deck outline. Include title, bullets, and speaker notes for each slide.";
        schema = {
            type: Type.OBJECT,
            properties: {
                deckTitle: { type: Type.STRING },
                slides: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            slideTitle: {type: Type.STRING},
                            bulletPoints: {type: Type.ARRAY, items: {type: Type.STRING}},
                            speakerNotes: {type: Type.STRING}
                        }
                    }
                }
            }
        };
        break;
  }

  const response = await ai.models.generateContent({
    model: MODEL_REASONING,
    contents: `${prompt}\n\nCONTEXT:\n${context}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    }
  });

  return response.text ? JSON.parse(response.text) : null;
};

// Generates the textual script AND audio for the Audio Overview
export const generateAudioOverview = async (sources: Source[], length: 'Short' | 'Medium' | 'Long' = 'Medium') => {
    const context = formatContext(sources);
    
    let durationInstruction = "roughly 2 minutes long spoken";
    if (length === 'Short') durationInstruction = "about 5-8 minutes long, very concise";
    if (length === 'Long') durationInstruction = "about 10-17 minutes long, going into deep detail";

    // 1. Generate the script text first
    const scriptPrompt = `
    Create a professional podcast script between two hosts (Joe and Jane) discussing the following material. 
    Make it engaging, conversational, and ${durationInstruction}.
    Joe is the main host (Male, deep voice), Jane is the co-host (Female, clear voice).
    
    IMPORTANT FORMATTING:
    Output the script as a dialogue where Joe and Jane take turns. 
    Use a simple format like:
    Joe: [text]
    Jane: [text]
    
    MATERIAL:
    ${context}
    `;
    
    const scriptResponse = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: scriptPrompt
    });
    
    const scriptText = scriptResponse.text;
    if (!scriptText) throw new Error("Failed to generate script");

    // 2. Synthesize Audio using Multi-speaker TTS
    // We send the generated script back to the TTS model
    const ttsResponse = await ai.models.generateContent({
      model: MODEL_TTS,
      contents: [{ parts: [{ text: scriptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                    {
                        speaker: 'Joe',
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Chiron' } // Deep male voice
                        }
                    },
                    {
                        speaker: 'Jane',
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Kore' } // Clear female voice
                        }
                    }
              ]
            }
        }
      }
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
        throw new Error("Failed to generate audio bytes");
    }

    // Convert raw PCM to a playable WAV Blob URL
    const pcmBytes = base64ToUint8Array(base64Audio);
    const audioUrl = createWavUrl(pcmBytes, 24000);

    return {
        script: scriptText,
        audioUrl: audioUrl
    };
};

export const getLiveClient = () => {
    return ai.live;
};

export const LIVE_MODEL_NAME = MODEL_LIVE;