export type FileType = 'pdf' | 'docx' | 'md' | 'txt' | 'xlsx' | 'folder';

export interface FileNode {
  id: string;
  name: string;
  type: FileType;
  content?: string;
  docId?: string;
  savedFilename?: string; // Actual filename on server (with timestamp)
  children?: FileNode[];
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachedFile?: string;
  sources?: {
    filename: string;
    docId?: string;
    score: number;
    text_preview: string;
    page?: number | null;
    sheet?: string | null;
    lineStart?: number;
    lineEnd?: number;
  }[];
  usedGeneralKnowledge?: boolean;
}

export interface AppState {
  theme: 'light' | 'dark';
  activeFileId: string | null;
  sidebarWidth: number;
  chatWidth: number;
}

