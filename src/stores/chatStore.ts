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
  addMessage: (role: 'user' | 'assistant', content: string, attachedFile?: string, sources?: any[], usedGeneralKnowledge?: boolean) => void;
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

      addMessage: (role, content, attachedFile, sources, usedGeneralKnowledge) => {
        const message: ChatMessage = {
          id: nanoid(),
          role,
          content,
          timestamp: new Date(),
          attachedFile,
          sources,
          usedGeneralKnowledge,
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
        const { addMessage, setIsTyping } = get();
        
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
          
          // Handle created files (e.g., LaTeX files created by agent)
          if (data.createdFiles && data.createdFiles.length > 0) {
            const { addFile, setFileMeta, updateFileContent, setActiveFile } = useFileSystemStore.getState();
            let firstCreatedFileId: string | null = null;
            
            for (const createdFile of data.createdFiles) {
              // Check if file already exists
              const existingFile = useFileSystemStore.getState().findFileBySavedFilename(createdFile.filename);
              if (!existingFile) {
                // Extract display name (remove timestamp prefix if present)
                const displayName = createdFile.filename.replace(/^\d+-/, '');
                const fileType = displayName.toLowerCase().endsWith('.tex') ? 'tex' : 'txt';
                
                // Add file to file system
                const newFileId = addFile(displayName, fileType, undefined, `[Created file: ${displayName}]`);
                
                // Remember the first created file to set as active
                if (!firstCreatedFileId) {
                  firstCreatedFileId = newFileId;
                }
                
                // Set metadata
                setFileMeta(newFileId, {
                  docId: createdFile.docId,
                  savedFilename: createdFile.filename
                });
                
                // Fetch file content from server
                (async () => {
                  try {
                    let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                    if (baseUrl.endsWith('/api')) {
                      baseUrl = baseUrl.slice(0, -4);
                    }
                    const encodedFilename = encodeURIComponent(createdFile.filename);
                    const fileUrl = `${baseUrl}/uploads/${encodedFilename}`;
                    
                    const response = await fetch(fileUrl);
                    if (response.ok) {
                      const content = await response.text();
                      updateFileContent(newFileId, content);
                      console.log(`✅ Loaded content for created file: ${displayName}`);
                    }
                  } catch (err) {
                    console.warn(`Failed to load content for ${displayName}:`, err);
                  }
                })();
                
                console.log(`✅ Added created file to workspace: ${displayName} (${createdFile.docId})`);
              }
            }
            
            // Automatically set the first created file as active so insertions work immediately
            if (firstCreatedFileId) {
              setActiveFile(firstCreatedFileId);
              console.log(`✅ Set created file as active: ${firstCreatedFileId}`);
            }
          }
          
          // Add message with sources and general knowledge flag
          addMessage('assistant', data.response, undefined, data.sources, (data as any).usedGeneralKnowledge);
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

