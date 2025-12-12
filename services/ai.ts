
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

// Helper to clean JSON string
const cleanJsonString = (str: string) => {
    let cleaned = str.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
    }
    return cleaned;
};

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
    // List of CORS proxies to attempt
    const proxies = [
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];

    for (const proxyUrl of proxies) {
        try {
            const response = await fetch(proxyUrl);
            if (response.ok) {
                const html = await response.text();
                return parseHtmlContent(html);
            }
        } catch (e) {
            console.warn(`Proxy failed: ${proxyUrl}`, e);
        }
    }

    // Fallback if all proxies fail - do not throw, but return a placeholder
    // This prevents the entire "Scout" process from crashing on a single locked site.
    return `[System: Content inaccessible due to site security settings (CORS/Anti-Bot). The AI is aware of this source at ${url} but cannot read its full text directly.]`;
};

export const runNebulaScout = async (topic: string, onProgress: (msg: string) => void): Promise<Source[]> => {
    try {
        onProgress("Initializing Scout Agent...");
        
        // 1. Identify targets using Google Search Tool
        onProgress(`Scouting sector: "${topic}"...`);
        
        // Use an explicit and demanding prompt to get multiple results
        const searchPrompt = `
            Perform a comprehensive search about: "${topic}".
            
            GOAL: Find exactly 5 distinct, high-quality sources that cover different aspects of this topic.
            
            REQUIREMENT: You MUST utilize the Google Search tool multiple times or broadly enough to return at least 5 unique URLs.
            
            OUTPUT FORMAT:
            Provide a PURE JSON array of objects. Do not add markdown backticks.
            [
              {"title": "Title 1", "url": "https://url1.com"},
              {"title": "Title 2", "url": "https://url2.com"},
              ...
            ]
        `;

        const scoutResponse = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: searchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const targets: {url: string, title: string}[] = [];
        const uniqueUrls = new Set<string>();

        // Strategy A: Grounding Metadata (Preferred)
        const chunks = scoutResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        for (const chunk of chunks) {
            if (chunk.web?.uri && !uniqueUrls.has(chunk.web.uri)) {
                uniqueUrls.add(chunk.web.uri);
                targets.push({
                    url: chunk.web.uri,
                    title: chunk.web.title || "Scouted Source"
                });
            }
        }

        // Strategy B: Text Parsing (Fallback if metadata is empty)
        if (targets.length === 0 && scoutResponse.text) {
            try {
                const jsonStr = cleanJsonString(scoutResponse.text);
                // Try to find JSON block if mixed text
                const jsonMatch = jsonStr.match(/\[.*\]/s);
                if (jsonMatch) {
                    const json = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(json)) {
                        json.forEach((item: any) => {
                            if (item.url && !uniqueUrls.has(item.url)) {
                                uniqueUrls.add(item.url);
                                targets.push({ url: item.url, title: item.title || "Web Source" });
                            }
                        });
                    }
                } 
            } catch (e) {
                console.warn("Failed to parse text fallback for sources", e);
            }
        }
        
        // Force limit to 5
        const finalTargets = targets.slice(0, 5);

        if (finalTargets.length < 2) {
             // If we STILL have 0 or 1, user experience is poor. But we proceed with what we have.
             if (finalTargets.length === 0) {
                 throw new Error("Scout failed to identify valid targets (No search results returned).");
             }
        }

        // 2. Ingest Content
        const newSources: Source[] = [];
        
        for (const target of finalTargets) {
            onProgress(`Acquiring target: ${target.title}...`);
            let content = "";
            let isScraped = false;

            // Attempt to Scrape using the robust fetchWebsiteContent
            try {
                content = await fetchWebsiteContent(target.url);
                if (content.length > 200 && !content.includes("[System: Content inaccessible")) { 
                    isScraped = true;
                }
            } catch (e) {
                console.warn(`Failed to ingest ${target.url}, using fallback.`, e);
            }

            // Fallback Logic: If scraping failed or returned the placeholder
            if (!isScraped) {
                content = content || `[Nebula Scout: Auto-Generated Summary]\n\nSource Title: ${target.title}\nSource URL: ${target.url}\n\nNote: The full content of this website could not be automatically scraped.`;
            }

            // Add source (Scraped or Fallback)
            newSources.push({
                id: crypto.randomUUID(),
                type: 'website',
                title: target.title,
                content: content,
                createdAt: Date.now(),
                metadata: { originalUrl: target.url, scouted: true, fullTextAvailable: isScraped }
            });
        }

        if (newSources.length === 0) {
            throw new Error("Scout mission failed: No sources could be added.");
        }

        return newSources;

    } catch (error: any) {
        console.error("Nebula Scout Error:", error);
        throw new Error(error.message || "Scout mission aborted.");
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
  type: 'flashcards' | 'quiz' | 'infographic' | 'slideDeck' | 'executiveBrief',
  sources: Source[]
) => {
  const context = formatContext(sources);
  
  try {
      // INFOGRAPHIC: Image Generation
      if (type === 'infographic') {
          // 1. Generate a specialized "Design Brief" prompt based on sources
          const designBriefResponse = await ai.models.generateContent({
              model: MODEL_TEXT,
              contents: `You are a world-class Data Visualization Director working for a top-tier design agency (like Canva or Pentagram).
              
              GOAL: Create a highly specific image generation prompt for a VERTICAL (9:16 aspect ratio) professional infographic about the provided context.

              DESIGN STYLE:
              - Dense Information Layout: "Educational Poster" style.
              - Modern, clean, flat vector art with slight isometric elements.
              - High contrast typography. Readable headings.
              - Color Palette: Professional tech blues/purples OR vibrant gradients (dependent on topic).
              - Composition: Vertical layout optimized for mobile scrolling. Top header, followed by multiple distinct sections containing key stats and icons.

              CONTENT EXTRACTION:
              Analyze the context and extract:
              1. Main Title (Catchy, short).
              2. A short introductory paragraph summarizing the core concept (2 sentences).
              3. 6 distinct Key Statistics, Facts, or Steps (numbered).
              4. A "Did You Know?" footer section.

              OUTPUT PROMPT STRUCTURE:
              "A professional vertical infographic (9:16 aspect ratio) educational poster about [TOPIC].
              Style: High-quality vector illustration, flat design, Behance/Dribbble quality, clean white space, text-rich.
              Layout:
              - Header: Bold text '[TITLE]' at the top with a relevant icon.
              - Section 1: Intro summary block.
              - Section 2: Grid of 6 distinct icons labeled with key stats: [FACT 1], [FACT 2], [FACT 3], [FACT 4], [FACT 5], [FACT 6].
              - Section 3: Central visual metaphor [METAPHOR] with connecting lines to text labels.
              - Footer: 'Did You Know?' fact box.
              Render: 8k resolution, sharp lines, highly detailed, legible text, infographic style."

              CONTEXT:
              ${context.substring(0, 15000)}
              
              Output ONLY the final prompt string.`
          });
          
          const imagePrompt = designBriefResponse.text || "A professional vertical infographic, 9:16 aspect ratio, clean vector art, high quality flat design, business statistics, readable text, 8k resolution.";

          // 2. Generate the Image using the extracted brief
          // Note: using 2.5-flash-image which listens to aspect ratio instructions in text fairly well for vertical layouts
          const imageResponse = await ai.models.generateContent({
              model: MODEL_IMAGE,
              contents: { parts: [{ text: imagePrompt }] },
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
            case 'executiveBrief':
              prompt = `Synthesize the provided context into a high-level Strategic Executive Briefing.
              
              Task:
              1. Create a structured summary designed for a busy executive or decision-maker.
              2. Extract the core insights, not just facts.
              3. Identify actionable takeaways and future implications.
              
              Output must be valid JSON matching the schema.`;
              schema = {
                  type: Type.OBJECT,
                  properties: {
                      briefTitle: { type: Type.STRING, description: "A professional title for the brief" },
                      executiveSummary: { type: Type.STRING, description: "A powerful 2-3 sentence summary of the entire context." },
                      keyFindings: { 
                          type: Type.ARRAY, 
                          items: { 
                              type: Type.OBJECT,
                              properties: {
                                  heading: { type: Type.STRING },
                                  point: { type: Type.STRING }
                              }
                          },
                          description: "3-5 critical findings/facts extracted from sources."
                      },
                      strategicImplications: { type: Type.STRING, description: "What does this mean for the future? Risks? Opportunities?" },
                      actionableItems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 recommended next steps or things to watch." }
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

      const rawText = response.text || "{}";
      const cleanText = cleanJsonString(rawText);
      const content = JSON.parse(cleanText);
      
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
    onProgress?: (status: string) => void,
    learningIntent?: string // Optional intent for Study Guide
) => {
    const context = formatContext(sources);
    
    // Updated duration instructions for longer content
    let durationInstruction = "roughly 8-10 minutes spoken conversation, detailed and thorough";
    if (length === 'Short') durationInstruction = "about 3-5 minutes long, concise but covering key points";
    if (length === 'Long') durationInstruction = "about 12-15 minutes long, very deep dive, extensive discussion";

    // --- STYLE DEFINITIONS ---
    let personaInstruction = "";
    let structuralInstruction = ""; // For Study Guide Layering
    
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
        // ENHANCED STUDY GUIDE LOGIC
        const intent = learningIntent || 'Understand Basics';
        
        // Define nuances based on Learning Intent
        let intentNuance = "";
        if (intent === 'Exam Prep') {
            intentNuance = "Focus on definitions, key dates, distinct classifications, and potential test questions. BE RIGOROUS. Use 'Quiz Mode' where Joe asks a question, pauses briefly, and Jane answers it.";
        } else if (intent === 'Apply') {
            intentNuance = "Focus on practical application. How does this work in the real world? Use concrete scenarios and case studies.";
        } else if (intent === 'Teach') {
            intentNuance = "Focus on the Feynman Technique. Explain complex jargon using simple, unexpected analogies (e.g., explaining CPU like a kitchen chef).";
        } else {
            intentNuance = "Focus on building a strong mental model. Connect big ideas before diving into details. Create a 'Map' for the listener.";
        }

        personaInstruction = `
        STYLE: "Guided Lesson" (Private Tutor Session).
        
        HOSTS:
        - JOE (Host A): THE INSTRUCTOR. Structured, clear, patient. Drives the lesson plan.
        - JANE (Host B): THE STUDENT PROXY. Curious, intelligent but "new" to the topic. Asks the "dumb" questions the listener might have. Challenges assumptions. Says "Wait, explain that again" when things get complex.
        
        LEARNING INTENT: ${intent}
        INTENT NUANCE: ${intentNuance}
        
        PEDAGOGY RULES:
        1. NO SUMMARY. TEACHING ONLY. Do not just list facts. Explain them.
        2. Use Source-Aware Teaching: Explicitly mention if sources agree, disagree, or complement each other.
        3. Use Socratic Method: Jane should interrupt to clarify. Joe should verify Jane's understanding.
        `;

        structuralInstruction = `
        REQUIRED 4-LAYER TEACHING FRAMEWORK:
        
        Layer 1: The Mental Map (Intro)
        - Start with the "Big Picture". What is this topic and why does it matter?
        - Outline the 3-5 core pillars you will cover.
        
        Layer 2: Concept Breakdown (The Meat)
        - Go through each pillar one by one.
        - Joe defines it. Jane asks for an example. Joe gives a concrete analogy.
        - If Intent is 'Exam Prep': Joe must ask a "Test Yourself" question.
        - If Intent is 'Teach': Joe must use a simplified analogy.
        
        Layer 3: Source Grounding (Evidence)
        - Explicitly cite the sources. "Source A mentions..." "The data in the PDF shows..."
        
        Layer 4: Knowledge Lock-In (Conclusion)
        - Recap the key principles (not just a list).
        - Give 1 "If you remember nothing else..." insight.
        `;
    }

    try {
        // 1. Generate the script text first
        if (onProgress) onProgress(`Synthesizing ${style} Script...`);

        const systemInstruction = `You are the primary reasoning model (Gemini Pro 3) for a two-host AI podcast studio.

Core responsibilities:
1. Understand the user’s source material.
2. Plan a structured, listener-friendly episode based on the selected STYLE.
3. Return a polished script ready for TTS.

${personaInstruction}

${structuralInstruction || `
Structure:
1. **The Intro**: Set the stage immediately. Welcome the listener to the ${style} podcast. Explicitly say "Welcome back to..." or "Hello everyone...". Introduce the topic clearly.
2. **The Meat**: Analyze/Discuss/Debate the source material.
3. **The Outro**: A solid conclusion or sign-off.`}

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
        if (onProgress) onProgress("Designing Cover Art...");

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
             
             if(onProgress) onProgress("Recording Audio Voices...");

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
            
            if(onProgress) onProgress("Processing Audio Stream...");
            const pcmBytes = base64ToUint8Array(base64Audio);
            return createWavUrl(pcmBytes, 24000);
        };

        const [coverUrl, audioUrl] = await Promise.all([
            generateCoverArtPromise(),
            generateAudioPromise()
        ]);

        if (onProgress) onProgress("Finalizing Production...");

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

export const getDebateSystemInstruction = (
    context: string, 
    role: 'Moderator' | 'Pro' | 'Con', 
    userStance: string
) => {
    return `
    You are engaging in a dynamic Audio Debate Arena.
    
    YOUR ROLE: You represent the Nebula Mind AI Podcast Team (Hosts Joe and Jane).
    - Joe: Analytical, skeptical, structured.
    - Jane: Creative, big-picture, enthusiastic.
    
    THE SCENARIO: The user has entered the Debate Arena as a THIRD HOST / GUEST.
    User's Role: ${role}
    User's Stance: ${userStance}
    
    CONTEXT MATERIAL:
    ${context}
    
    INSTRUCTIONS:
    1. Acknowledge the user's role immediately. "Welcome to the arena! I see you're taking the [Stance] side."
    2. If the user is the Moderator, defer to them but provide spicy commentary.
    3. If the user is Pro/Con, challenge their points respectfully but firmly.
    4. Speak naturally. Do not output "Joe:" or "Jane:" text prefixes in this live audio mode, just embody the spirit of the debate team.
    5. Keep it high energy, intellectual, and "fiery" but safe.
    `;
};
