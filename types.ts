

export interface Source {
  id: string;
  type: 'pdf' | 'audio' | 'image' | 'website' | 'youtube' | 'copiedText';
  title: string;
  content: string; // The raw text extracted
  createdAt: number;
  metadata?: Record<string, any>;
}

export interface Note {
  id: string;
  content: string;
  createdAt: number;
}

export interface Artifact {
  id: string;
  type: 'flashcards' | 'quiz' | 'infographic' | 'slideDeck' | 'audioOverview' | 'executiveBrief';
  title: string;
  content: any; // Structured JSON or text
  createdAt: number;
  status: 'generating' | 'completed' | 'failed';
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  sources: Source[];
  artifacts: Artifact[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
  citations?: string[];
  groundingMetadata?: any; // Google Search Grounding Data
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface BackgroundJob {
  id: string;
  notebookId: string;
  type: Artifact['type'];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: string;
}
