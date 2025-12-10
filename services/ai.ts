
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
const MODEL_IMAGE = 'gemini-2.5-flash-image';

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

// Helper to generate a standalone HTML presentation from deck data
const generateSlideDeckHtml = (deck: any): string => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${deck.deckTitle}</title>
    <style>
        :root { --primary: #38bdf8; --bg: #0f172a; --text: #f8fafc; }
        body { margin: 0; font-family: 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); overflow: hidden; }
        .slide-container { position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
        .slide { position: absolute; opacity: 0; transition: all 0.5s ease-in-out; transform: translateY(20px); width: 80%; max-width: 1000px; text-align: center; }
        .slide.active { opacity: 1; transform: translateY(0); z-index: 10; }
        h1 { font-size: 3.5rem; color: var(--primary); margin-bottom: 0.5em; text-shadow: 0 0 20px rgba(56, 189, 248, 0.3); }
        ul { text-align: left; display: inline-block; font-size: 1.8rem; line-height: 1.6; list-style-type: none; padding: 0; }
        li { margin-bottom: 15px; padding-left: 30px; position: relative; }
        li::before { content: "•"; color: var(--primary); position: absolute; left: 0; font-size: 2rem; line-height: 1.8rem; }
        .controls { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; gap: 20px; z-index: 20; }
        button { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 12px 24px; border-radius: 30px; cursor: pointer; transition: all 0.2s; backdrop-filter: blur(10px); }
        button:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .progress { position: fixed; top: 0; left: 0; height: 4px; background: var(--primary); transition: width 0.3s; }
        .notes { position: fixed; bottom: 30px; right: 30px; font-size: 0.9rem; color: #94a3b8; max-width: 300px; text-align: right; font-style: italic; }
    </style>
</head>
<body>
    <div class="progress" id="progressBar"></div>
    <div class="slide-container" id="container"></div>
    <div class="controls">
        <button onclick="prev()">Previous</button>
        <button onclick="next()">Next</button>
    </div>
    <div class="notes" id="notes"></div>

    <script>
        const deck = ${JSON.stringify(deck)};
        let current = 0;
        const container = document.getElementById('container');
        const notes = document.getElementById('notes');
        const progressBar = document.getElementById('progressBar');

        function render() {
            container.innerHTML = '';
            deck.slides.forEach((slide, index) => {
                const div = document.createElement('div');
                div.className = \`slide \${index === current ? 'active' : ''}\`;
                div.innerHTML = \`<h1>\${slide.slideTitle}</h1><ul>\${slide.bulletPoints.map(p => \`<li>\${p}</li>\`).join('')}</ul>\`;
                container.appendChild(div);
            });
            notes.innerText = deck.slides[current].speakerNotes;
            progressBar.style.width = \`\${((current + 1) / deck.slides.length) * 100}%\`;
        }
        
        function next() { if(current < deck.slides.length - 1) { current++; render(); } }
        function prev() { if(current > 0) { current--; render(); } }
        
        document.addEventListener('keydown', (e) => {
            if(e.key === 'ArrowRight' || e.key === ' ') next();
            if(e.key === 'ArrowLeft') prev();
        });

        render();
    </script>
</body>
</html>`;
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
  onUpdate: (text: string, grounding?: any) => void
) => {
  if (sources.length === 0) {
    onUpdate("Please add sources to your notebook first.", undefined);
    return;
  }

  const context = formatContext(sources);
  const prompt = `
  CONTEXT FROM SOURCES:
  ${context}

  USER QUESTION: ${query}
  
  Instructions:
  1. Answer the user question comprehensively.
  2. Use the "CONTEXT FROM SOURCES" as your primary foundation.
  3. If the sources do not contain the specific answer, or if the user asks for up-to-date/external information, USE THE Google Search tool to find the answer.
  4. Synthesize information from the sources and Google Search results.
  5. If utilizing Google Search, ensure the information is relevant to the user's topic.
  `;

  try {
    const response = await ai.models.generateContentStream({
      model: MODEL_TEXT,
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful research assistant. You ground your answers in provided sources, but you are also allowed to use Google Search to answer broad questions or find missing information.",
        tools: [{ googleSearch: {} }]
      }
    });

    for await (const chunk of response) {
      const text = chunk.text || '';
      const grounding = chunk.candidates?.[0]?.groundingMetadata;
      
      if (text || grounding) {
        onUpdate(text, grounding);
      }
    }
  } catch (error) {
    console.error("Gemini Error:", error);
    onUpdate("Error generating response. Please check your API key or connection.", undefined);
  }
};

export const speakText = async (text: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: MODEL_TTS,
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Aoede' } // Premium human-like female voice
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate speech");

  const pcmBytes = base64ToUint8Array(base64Audio);
  return createWavUrl(pcmBytes, 24000);
};

export const generateArtifact = async (
  type: 'flashcards' | 'quiz' | 'infographic' | 'slideDeck',
  sources: Source[]
) => {
  const context = formatContext(sources);
  
  // INFOGRAPHIC: Image Generation
  if (type === 'infographic') {
      // 1. Generate a specialized prompt for the image model based on sources
      const promptGenResponse = await ai.models.generateContent({
          model: MODEL_TEXT,
          contents: `You are an award-winning information designer. 
          Based on the following context, write a highly detailed image generation prompt to create a professional, data-rich infographic.
          
          The infographic description should specify:
          - A high-tech, dark mode "Cyberpunk/Futuristic" aesthetic with neon accents.
          - Clear sections, charts, statistical highlights, and iconography.
          - High resolution, vector art style, clean typography, 8k render.
          - Avoid generic stock art; focus on "data visualization" and "schematic layouts".
          
          CONTEXT:
          ${context.substring(0, 15000)}
          
          Output ONLY the prompt string.`
      });
      
      const imagePrompt = promptGenResponse.text || "A professional infographic summarizing research data, dark mode, neon style.";

      // 2. Generate the Image
      const imageResponse = await ai.models.generateContent({
          model: MODEL_IMAGE,
          contents: { parts: [{ text: imagePrompt }] },
          config: {
              // Nano Banana models don't use responseMimeType
          }
      });

      let base64Image = null;
      if (imageResponse.candidates?.[0]?.content?.parts) {
          for (const part of imageResponse.candidates[0].content.parts) {
              if (part.inlineData) {
                  base64Image = part.inlineData.data;
                  break;
              }
          }
      }

      if (!base64Image) throw new Error("Failed to generate infographic image");

      return {
          imageUrl: `data:image/png;base64,${base64Image}`,
          prompt: imagePrompt
      };
  }

  // OTHER TYPES: Text/JSON Generation
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
      case 'slideDeck':
        prompt = "Create a comprehensive slide deck outline (6-10 slides). Include a catchy title, clear bullet points, and speaker notes for each slide. The content should be educational and professional.";
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

  const content = response.text ? JSON.parse(response.text) : null;
  
  // If it's a slide deck, enrich it with the HTML version
  if (type === 'slideDeck' && content) {
      content.html = generateSlideDeckHtml(content);
  }

  return content;
};

// Generates the textual script AND audio for the Audio Overview
export const generateAudioOverview = async (
    sources: Source[], 
    length: 'Short' | 'Medium' | 'Long' = 'Medium',
    onProgress?: (status: string) => void
) => {
    const context = formatContext(sources);
    
    let durationInstruction = "roughly 2 minutes long spoken";
    if (length === 'Short') durationInstruction = "about 5-8 minutes long, very concise";
    if (length === 'Long') durationInstruction = "about 10-17 minutes long, going into deep detail";

    // 1. Generate the script text first
    if (onProgress) onProgress("Drafting conversation script from sources...");

    const scriptPrompt = `
    Create a highly engaging, human-like podcast script between two hosts (Joe and Jane) discussing the provided material.
    
    HOST PERSONALITIES:
    - Joe (Male): The skeptic, witty, slightly cynical but curious. Loves to ask "But why?" and make small jokes. Uses analogies.
    - Jane (Female): The expert, insightful, empathetic, enthusiastic. She patiently explains complex ideas and connects the dots.
    
    INSTRUCTIONS:
    - Make it sound REAL. Use natural speech patterns, interjections, and banter.
    - Include disfluencies like "um", "like", "you know" sparingly to sound authentic.
    - Have them interrupt each other occasionally or finish each other's sentences.
    - Use emotional cues like [laughs], [sighs], [excitedly].
    - Length: ${durationInstruction}.
    
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
    if (onProgress) onProgress("Synthesizing AI host voices (Joe & Jane)...");

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
                          prebuiltVoiceConfig: { voiceName: 'Orus' } // New male voice
                        }
                    },
                    {
                        speaker: 'Jane',
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Zephyr' } // New female voice
                        }
                    }
              ]
            }
        }
      }
    });

    if (onProgress) onProgress("Finalizing audio stream...");

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
