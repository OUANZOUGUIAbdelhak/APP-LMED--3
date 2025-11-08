import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { ChatMessage } from '../types';
import { sendAgentMessage } from '../services/api';
import { useFileSystemStore } from './fileSystemStore';

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  attachedFileId: string | null;
  
  // Actions
  addMessage: (role: 'user' | 'assistant', content: string, attachedFile?: string, sources?: any[]) => void;
  setIsTyping: (isTyping: boolean) => void;
  setAttachedFile: (fileId: string | null) => void;
  clearMessages: () => void;
  sendMessage: (message: string, context?: string, docId?: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [
        {
          id: nanoid(),
          role: 'assistant',
          content: 'Hello! I\'m your AI assistant. I can help you with document analysis, summarization, and answering questions about your documents. Try dragging a document here to add context to our conversation!',
          timestamp: new Date(),
        }
      ],
      isTyping: false,
      attachedFileId: null,

      addMessage: (role, content, attachedFile, sources) => {
        const message: ChatMessage = {
          id: nanoid(),
          role,
          content,
          timestamp: new Date(),
          attachedFile,
          sources,
        };

        set(state => ({
          messages: [...state.messages, message],
        }));
      },

      setIsTyping: (isTyping) => {
        set({ isTyping });
      },

      setAttachedFile: (fileId) => {
        set({ attachedFileId: fileId });
      },

      clearMessages: () => {
        set({ messages: [
          {
            id: nanoid(),
            role: 'assistant',
            content: 'New chat started. Attach a document or ask a question to begin.',
            timestamp: new Date(),
          }
        ] });
      },

      sendMessage: async (message, context, docId) => {
        const { addMessage, setIsTyping, getFileById } = get();
        
        const attachedFileId = get().attachedFileId;
        const attachedFile = attachedFileId ? useFileSystemStore.getState().getFileById(attachedFileId) : null;
        
        // Add user message
        addMessage('user', message, attachedFileId || undefined);
        
        // Clear attached file
        set({ attachedFileId: null });
        
        // Show typing indicator
        setIsTyping(true);

        try {
          // Use the Agent (Groq + Codex tools); attach document content if present
          const data = await sendAgentMessage(message, {
            document: context && attachedFile ? { filename: attachedFile.name, content: context } : undefined,
            documentIds: docId ? [docId] : undefined,
          });
          
          // Add message with sources
          addMessage('assistant', data.response, undefined, data.sources);
        } catch (error) {
          console.error('Chat error:', error);
          const msg = error instanceof Error ? error.message : 'Unknown error';
          addMessage('assistant', `Sorry, I encountered an error: ${msg}`);
        } finally {
          setIsTyping(false);
        }
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        messages: state.messages,
      }),
    }
  )
);

