// API Service Layer
// Replace these with your actual backend endpoints

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getSessionId(): string {
  const key = 'chat-session-id';
  if (typeof localStorage !== 'undefined') {
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, sid);
    }
    return sid;
  }
  return 'local-session';
}

export function newSession(): string {
  const key = 'chat-session-id';
  const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, sid);
  }
  return sid;
}

export async function resetSession(): Promise<void> {
  await fetch(`${API_BASE_URL}/session/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': getSessionId(),
    },
  }).catch(() => {});
}

// Debug logging
console.log('🔧 API Configuration:');
console.log('  VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('  API_BASE_URL:', API_BASE_URL);

export interface ChatRequest {
  message: string;
  context?: string;
  model?: string;
  use_rag?: boolean;
  top_k?: number;
}

export interface ChatResponse {
  response: string;
  timestamp: string;
  sources?: {
    filename: string;
    score: number;
    text_preview: string;
  }[];
}

/**
 * Send a chat message to the AI backend
 * This is a placeholder - replace with your actual API implementation
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': getSessionId(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Send a message to the agent (with tool-calling and workspace access)
 */
export async function sendAgentMessage(
  message: string,
  opts?: { document?: { filename: string; content: string }; documentIds?: string[] }
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
    body: JSON.stringify({ message, document: opts?.document, documentIds: opts?.documentIds }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Upload a document to the backend for processing
 * Useful for RAG implementations
 */
export async function uploadDocument(file: File): Promise<{ id: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

/**
 * Query the RAG system with a document context
 */
export async function queryRAG(query: string, documentIds?: string[]): Promise<ChatResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId(),
      },
      body: JSON.stringify({ query, documentIds }),
    });

    if (!response.ok) {
      throw new Error(`RAG query error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('RAG query error:', error);
    throw error;
  }
}

