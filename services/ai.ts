
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Notebook, Source } from "../types";
import { RAG_SYSTEM_INSTRUCTION } from "../constants";
import { base64ToUint8Array, createWavUrl } from "./audioUtils";

// Initialize the client
// NOTE: In a real production app, API calls should be proxied through a backend to hide the key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_TEXT = 'gemini-2.5-flash'; // Fast, good for RAG & Ingestion
const MODEL_REASONING = 'gemini-2.5-flash'; // General purpose
const MODEL_SCRIPT = 'gemini-3-pro-preview'; // Powerful model for creative writing & teaching
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

        /* Mobile Optimization */
        @media (max-width: 768px) {
            .slide-container { align-items: flex-start; padding-top: 15vh; height: 100vh; overflow-y: auto; display: block; }
            .slide { width: 90%; margin: 0 auto; position: relative; opacity: 0; display: none; transform: none; text-align: left; }
            .slide.active { opacity: 1; display: block; }
            h1 { font-size: 2.2rem; line-height: 1.2; text-align: left; }
            ul { font-size: 1.2rem; width: 100%; display: block; padding-left: 10px; }
            li { margin-bottom: 20px; padding-left: 25px; }
            li::before { font-size: 1.2rem; top: 2px; }
            .controls { bottom: 20px; gap: 10px; width: 90%; justify-content: space-between; }
            button { flex: 1; padding: 12px 0; font-size: 1rem; background: rgba(0,0,0,0.5); }
            .notes { display: none; }
        }
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
            // Mobile-friendly rendering
            const isMobile = window.innerWidth < 768;
            container.innerHTML = '';
            
            deck.slides.forEach((slide, index) => {
                const div = document.createElement('div');
                div.className = \`slide \${index === current ? 'active' : ''}\`;
                div.innerHTML = \`<h1>\${slide.slideTitle}</h1><ul>\${slide.bulletPoints.map(p => \`<li>\${p}</li>\`).join('')}</ul>\`;
                container.appendChild(div);
            });
            
            if(notes) notes.innerText = deck.slides[current].speakerNotes;
            if(progressBar) progressBar.style.width = \`\${((current + 1) / deck.slides.length) * 100}%\`;
        }
        
        function next() { if(current < deck.slides.length - 1) { current++; render(); } }
        function prev() { if(current > 0) { current--; render(); } }
        
        document.addEventListener('keydown', (e) => {
            if(e.key === 'ArrowRight' || e.key === ' ') next();
            if(e.key === 'ArrowLeft') prev();
        });

        window.addEventListener('resize', render);
        render();
    </script>
</body>
</html>`;
};

// ---------------------------------------------------------
// SOURCE INGESTION
// ---------------------------------------------------------

export const processFileWithGemini = async (file: File, mimeType: string): Promise<string> => {
    try {
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
    } catch (error: any) {
        console.error("Gemini File Processing Error:", error);
        throw new Error(`Failed to process file: ${error.message || "Network error. Please check your connection."}`);
    }
};

const parseHtmlContent = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const scripts = doc.querySelectorAll('script, style, noscript, iframe, svg, nav, footer, header');
    scripts.forEach(s => s.remove());
    return doc.body.innerText.replace(/\s+/g, ' ').trim().substring(0, 50000);
};

export const fetchWebsiteContent = async (url: string): Promise<string> => {
    // Attempt 1: corsproxy.io
    try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
            const html = await response.text();
            return parseHtmlContent(html);
        }
    } catch (e) {
        console.warn("Primary CORS proxy failed, trying fallback...", e);
    }

    // Attempt 2: allorigins.win (Fallback)
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
            const html = await response.text();
            return parseHtmlContent(html);
        }
    } catch (e) {
        console.error("Fallback CORS proxy failed", e);
    }

    throw new Error("Could not fetch website content. The site may be blocking automated access or forcing CORS.");
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
        systemInstruction: `You are Nebula, a witty, highly intelligent, and conversational research assistant. 
        
        Personality:
        - You are NOT a robotic responder. You are a curious research partner.
        - Use phrases like "Here's what I found...", "Interestingly...", "It seems like...".
        - If the user asks something simple, give a direct, friendly answer.
        - If the user asks something complex, break it down step-by-step but keep the tone engaging.
        - Feel free to use light metaphors to explain difficult concepts.
        
        Rule: Ground your answers in provided sources, but you are also allowed to use Google Search to answer broad questions or find missing information.`,
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
  try {
      // Truncate text to avoid TTS limits for simple read-aloud
      const safeText = text.substring(0, 4000); 

      const response = await ai.models.generateContent({
        model: MODEL_TTS,
        contents: [{ parts: [{ text: safeText }] }],
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
      if (!base64Audio) throw new Error("Failed to generate speech data");

      const pcmBytes = base64ToUint8Array(base64Audio);
      return createWavUrl(pcmBytes, 24000);
  } catch (error: any) {
      console.error("TTS Error:", error);
      throw new Error("Speech generation failed.");
  }
};

export const generateArtifact = async (
  type: 'flashcards' | 'quiz' | 'infographic' | 'slideDeck' | 'knowledgeGraph',
  sources: Source[]
) => {
  const context = formatContext(sources);
  
  try {
      // INFOGRAPHIC: Image Generation
      if (type === 'infographic') {
          // 1. Generate a specialized "Design Brief" prompt based on sources
          const designBriefResponse = await ai.models.generateContent({
              model: MODEL_TEXT,
              contents: `You are a world-class Data Visualization Director. 
              Analyze the context and extract the MOST important statistics and a title to create a high-fidelity 3D infographic.

              GOAL: Create a prompt for an AI Image Generator (Imagen 3) that will result in a PHOTOREALISTIC, PROFESSIONAL INFOGRAPHIC with READABLE TEXT and INFORMATIVE CHARTS.

              CRITICAL RULES:
              - The image MUST look like a professional business/tech infographic layout.
              - It MUST include a specific TITLE and 3-4 KEY DATA POINTS with labels.
              - Style: "Futuristic Glass UI", "HUD Dashboard", "Financial Tech Interface", "Clean Data Visualization".
              - AVOID: "Messy text", "Cartoon vector art". Prefer "High-fidelity 3D renders of charts".

              TASK:
              Write a detailed PROMPT string for the image model. Use this structure:
              "A professional high-fidelity 3D infographic about [TOPIC].
              Layout: Central futuristic glass interface showing data visualization.
              Title: Large, clear 3D header text '[TITLE]' at top.
              Key Data: 
              1. A glowing holographic chart showing '[STAT 1]' with label '[LABEL 1]'.
              2. A sleek glass panel displaying '[STAT 2]' with label '[LABEL 2]'.
              3. A digital readout showing '[STAT 3]' with label '[LABEL 3]'.
              Style: Dark cinematic background, neon [COLOR] accents, volumetric lighting, 8k resolution, Unreal Engine 5 render, highly detailed, sharp text."

              CONTEXT:
              ${context.substring(0, 15000)}
              
              Output ONLY the prompt string.`
          });
          
          const imagePrompt = designBriefResponse.text || "A photorealistic 3D infographic visualization, futuristic technology, glowing hologram, glass texture, 8k resolution, cinematic lighting.";

          // 2. Generate the Image using the extracted brief
          const imageResponse = await ai.models.generateContent({
              model: MODEL_IMAGE,
              contents: { parts: [{ text: imagePrompt }] },
              config: {
                   // Using default aspect ratio (1:1) is often safest for quality
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
          prompt = `Generate 15-20 high-quality flashcards based on the provided context.
          
          Rules:
          1. 'term' should be a key concept, question, or term.
          2. 'definition' should be a clear, concise explanation (2-3 sentences max).
          3. Cover the most important parts of the material.
          4. Ensure definitions are comprehensive enough to study from directly.`;
          
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
            case 'knowledgeGraph':
              prompt = `Analyze the context and generate a Knowledge Graph structure.
              
              Task:
              1. Identify the top 15-20 most important entities (concepts, people, events, technologies).
              2. Create relationships between them.
              3. For each node, provide a short 1-sentence summary definition.
              
              Output must be valid JSON matching the schema.`;
              schema = {
                  type: Type.OBJECT,
                  properties: {
                      nodes: {
                          type: Type.ARRAY,
                          items: {
                              type: Type.OBJECT,
                              properties: {
                                  id: { type: Type.STRING, description: "Unique ID (e.g., 'artificial_intelligence')" },
                                  label: { type: Type.STRING, description: "Display name (e.g., 'Artificial Intelligence')" },
                                  category: { type: Type.STRING, description: "Category (e.g., 'Concept', 'Person', 'Tool')" },
                                  summary: { type: Type.STRING, description: "Short definition of the concept." }
                              },
                              required: ['id', 'label', 'category', 'summary']
                          }
                      },
                      edges: {
                          type: Type.ARRAY,
                          items: {
                              type: Type.OBJECT,
                              properties: {
                                  source: { type: Type.STRING, description: "ID of source node" },
                                  target: { type: Type.STRING, description: "ID of target node" },
                                  relation: { type: Type.STRING, description: "Label for the relationship (e.g. 'enables', 'includes')" }
                              },
                              required: ['source', 'target', 'relation']
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
  } catch (error: any) {
      console.error("Artifact Generation Error:", error);
      throw new Error(`Failed to generate ${type}: ${error.message || "Unknown error"}`);
  }
};

// Generates the textual script AND audio for the Audio Overview
export const generateAudioOverview = async (
    sources: Source[], 
    length: 'Short' | 'Medium' | 'Long' = 'Medium',
    style: 'Deep Dive' | 'Heated Debate' | 'Casual Chat' | 'News Brief' | 'Study Guide' = 'Deep Dive',
    voices: { joe: string; jane: string } = { joe: 'Puck', jane: 'Aoede' },
    onProgress?: (status: string) => void
) => {
    const context = formatContext(sources);
    
    // Updated duration instructions for longer content
    let durationInstruction = "roughly 8-10 minutes spoken conversation, detailed and thorough";
    if (length === 'Short') durationInstruction = "about 3-5 minutes long, concise but covering key points";
    if (length === 'Long') durationInstruction = "about 12-15 minutes long, very deep dive, extensive discussion";

    // --- STYLE DEFINITIONS ---
    let personaInstruction = "";
    
    if (style === 'Deep Dive') {
        personaInstruction = `
        STYLE: "Deep Dive" (Think "Radiolab" or "Hard Fork").
        HOSTS:
        - JOE (Host A): The Anchor. Structured, uses first-principles thinking. 
        - JANE (Host B): The Expert. Metaphorical, connects the dots, provides "aha!" moments.
        TONE: Intellectual, curious, polished, "studio quality". 
        DYNAMICS:
        - Use "wait, hold on" to clarify complex points.
        - Use "exactly!" or "precisely" to validate.
        - Focus on the *implications* of the data, not just the data itself.
        `;
    } else if (style === 'Heated Debate') {
        personaInstruction = `
        STYLE: "Heated Debate" (Think "Crossfire" or "The Argument").
        HOSTS:
        - JOE (Host A): The Skeptic. Doubts the material, questions the validity, plays devil's advocate.
        - JANE (Host B): The Optimist/Believer. Defends the source material passionately.
        TONE: Intense, fast-paced, high energy.
        DYNAMICS:
        - Interruptions are encouraged (e.g., "Let me stop you there", "I completely disagree").
        - Use rhetorical questions.
        - End with a "agree to disagree" or a tentative compromise.
        `;
    } else if (style === 'Casual Chat') {
        personaInstruction = `
        STYLE: "Casual Chat" (Think "Morning Zoo" or "Coffee Shop").
        HOSTS:
        - JOE (Host A): Laid back, maybe cracks a joke.
        - JANE (Host B): Enthusiastic, uses slang (tastefully).
        TONE: Relaxed, fun, unscripted vibe.
        DYNAMICS:
        - Use fillers like "you know?", "like", "totally" (sparingly but effectively).
        - Laugh at concepts that are weird.
        - Relate the topic to everyday life (pizza, traffic, movies).
        `;
    } else if (style === 'News Brief') {
        personaInstruction = `
        STYLE: "News Brief" (Think "NPR" or "BBC World Service").
        HOSTS:
        - JOE (Host A): Lead Anchor. Formal, serious, authoritative.
        - JANE (Host B): Field Reporter. Fast-paced, informational.
        TONE: Professional, objective, crisp.
        DYNAMICS:
        - Short sentences.
        - "Breaking news", "Just in", "According to the report".
        - No tangents. Just facts.
        `;
    } else if (style === 'Study Guide') {
        personaInstruction = `
        STYLE: "Study Guide" (Think "Khan Academy" meets Podcast).
        HOSTS:
        - JOE (Host A): The Student. Asks the questions the listener is thinking.
        - JANE (Host B): The Tutor. Explains clearly, uses analogies, repeats key definitions.
        TONE: Encouraging, educational, slow-paced.
        DYNAMICS:
        - "So, if I understand correctly...", "Let's recap".
        - Quiz the listener: "Pause and think about X".
        - Focus on memorization and understanding core concepts.
        `;
    }

    try {
        // 1. Generate the script text first
        if (onProgress) onProgress(`Writing ${style} script...`);

        const systemInstruction = `You are the primary reasoning model (Gemini Pro 3) for a two-host AI podcast studio.

Core responsibilities:
1. Understand the user’s source material.
2. Plan a structured, listener-friendly episode based on the selected STYLE.
3. Return a polished script ready for TTS.

${personaInstruction}

Structure:
1. **The Intro**: Set the stage immediately. Welcome the listener to the ${style} podcast. Explicitly say "Welcome back to..." or "Hello everyone...". Introduce the topic clearly.
2. **The Meat**: Analyze/Discuss/Debate the source content.
3. **The Outro**: A solid conclusion or sign-off.

Constraints:
- All dialogue must be easily TTS-friendly.
- Avoid heavy markup.
- Clear separation between speakers (Joe: and Jane:).
- NO parentheticals like (laughs) or (music fades) unless absolutely necessary for context, but keep it minimal as the TTS reads everything.

Default Output Format:
TITLE: [Episode Title]
TOPIC: [Topic Summary]
SCRIPT_START
Joe: [Line]
Jane: [Line]
...`;

        const userPrompt = `
        Create a ${style} podcast script about the provided source material.
        Length: ${durationInstruction}.
        
        IMPORTANT: Ensure Joe (Host A) starts by warmly welcoming the listener to the show.
        
        SOURCE MATERIAL:
        ${context}
        `;
        
        const scriptResponse = await ai.models.generateContent({
            model: MODEL_SCRIPT,
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 8192,
            }
        });
        
        const fullText = scriptResponse.text || "";
        
        // Parse the special fields
        let podcastTitle = `${style} Podcast`;
        let podcastTopic = "Research Overview";
        let scriptText = fullText;

        if (fullText.includes("SCRIPT_START")) {
            const parts = fullText.split("SCRIPT_START");
            const header = parts[0];
            scriptText = parts[1].trim();

            const titleMatch = header.match(/TITLE:\s*(.+)/i);
            if (titleMatch) podcastTitle = titleMatch[1].trim();

            const topicMatch = header.match(/TOPIC:\s*(.+)/i);
            if (topicMatch) podcastTopic = topicMatch[1].trim();
        } else {
             // Fallback if model ignored formatting
             scriptText = fullText;
        }

        if (!scriptText) throw new Error("Failed to generate script");

        // 2. Parallel Generation: Audio & Cover Art
        if (onProgress) onProgress("Synthesizing audio and designing cover art...");

        const generateCoverArtPromise = async () => {
             const imagePrompt = `
                Design a professional, cinematic podcast cover art.
                Title: "${podcastTitle}" (Text must be bold, legible, modern typography, central or top).
                Subtitle/Topic: "${podcastTopic}".
                Visual Style: High-end 3D abstract digital art, photorealistic texture, dramatic studio lighting, 8k resolution.
                Subject: Artistic representation of ${podcastTopic}.
                Vibe: ${style} atmosphere.
                Colors: Rich gradients, neon accents, dark sleek background.
             `;
             
             try {
                const imgResp = await ai.models.generateContent({
                    model: MODEL_IMAGE,
                    contents: { parts: [{ text: imagePrompt }] }
                });
                
                let base64 = null;
                if (imgResp.candidates?.[0]?.content?.parts) {
                    for (const part of imgResp.candidates[0].content.parts) {
                        if (part.inlineData) {
                            base64 = part.inlineData.data;
                            break;
                        }
                    }
                }
                return base64 ? `data:image/png;base64,${base64}` : null;
             } catch (e) {
                 console.warn("Cover art generation failed", e);
                 return null;
             }
        };

        const generateAudioPromise = async () => {
             // Clean script text to remove any markdown that might confuse TTS or excessive length
             const safeScript = scriptText.substring(0, 40000); 

             const ttsResponse = await ai.models.generateContent({
                model: MODEL_TTS,
                contents: [{ parts: [{ text: safeScript }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: [
                                {
                                    speaker: 'Joe',
                                    voiceConfig: {
                                    prebuiltVoiceConfig: { voiceName: voices.joe }
                                    }
                                },
                                {
                                    speaker: 'Jane',
                                    voiceConfig: {
                                    prebuiltVoiceConfig: { voiceName: voices.jane }
                                    }
                                }
                        ]
                        }
                    }
                }
            });
            const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("Failed to generate audio bytes");
            const pcmBytes = base64ToUint8Array(base64Audio);
            return createWavUrl(pcmBytes, 24000);
        };

        const [coverUrl, audioUrl] = await Promise.all([
            generateCoverArtPromise(),
            generateAudioPromise()
        ]);

        if (onProgress) onProgress("Finalizing...");

        return {
            title: podcastTitle,
            topic: podcastTopic,
            script: scriptText,
            audioUrl: audioUrl,
            coverUrl: coverUrl
        };
    } catch (error: any) {
        console.error("Audio Overview Error:", error);
        throw new Error(`Audio generation failed: ${error.message || "Network or API error"}`);
    }
};

export const getLiveClient = () => {
    return ai.live;
};

export const LIVE_MODEL_NAME = MODEL_LIVE;
