import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Bot, User, Loader2, FileText, Plus } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { newSession, resetSession } from '../services/api';
import { useFileSystemStore } from '../stores/fileSystemStore';
import ReactMarkdown from 'react-markdown';
import { formatDate } from '../lib/fileUtils';
import { ChatMessage } from '../types';
import { InsertSuggestion } from './InsertSuggestion';

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  const { 
    getFileById, 
    findFileByDocId, 
    findFileBySavedFilename, 
    setActiveFile,
    activeFileId
  } = useFileSystemStore(state => ({
    getFileById: state.getFileById,
    findFileByDocId: state.findFileByDocId,
    findFileBySavedFilename: state.findFileBySavedFilename,
    setActiveFile: state.setActiveFile,
    activeFileId: state.activeFileId,
  }));
  
  const attachedFile = message.attachedFile ? getFileById(message.attachedFile) : null;
  const activeFile = activeFileId ? getFileById(activeFileId) : null;

  // Detect insertion suggestions in assistant messages
  // Look for code blocks, especially LaTeX, and phrases like "insert", "add", "would you like me to insert"
  const detectInsertionSuggestions = () => {
    if (isUser || !message.content) return null;
    
    const content = message.content.toLowerCase();
    const hasInsertionPhrase = 
      content.includes('would you like me to insert') ||
      content.includes('insert this') ||
      content.includes('add this') ||
      content.includes('apply this') ||
      content.includes('use this');
    
    if (!hasInsertionPhrase) return null;

    // Extract code blocks from markdown
    const codeBlockRegex = /```(?:latex|tex)?\n?([\s\S]*?)```/g;
    const matches = Array.from(message.content.matchAll(codeBlockRegex));
    
    if (matches.length > 0) {
      // Get the last code block (most likely the suggestion)
      const lastMatch = matches[matches.length - 1];
      const suggestedText = lastMatch[1].trim();
      
      // Determine target file
      const targetFile = activeFile?.savedFilename || activeFile?.name;
      
      return {
        text: suggestedText,
        targetFile,
        line: undefined, // Will insert at end or let user specify
      };
    }
    
    return null;
  };

  const insertionSuggestion = detectInsertionSuggestions();

  const resolveSourceFile = (source: NonNullable<ChatMessage['sources']>[number]) => {
    if (source.docId) {
      const byDoc = findFileByDocId(source.docId);
      if (byDoc) return byDoc;
    }
    if (source.filename) {
      const bySaved = findFileBySavedFilename(source.filename);
      if (bySaved) return bySaved;
    }
    return null;
  };

  const handleSourceClick = (source: NonNullable<ChatMessage['sources']>[number]) => {
    const file = resolveSourceFile(source);
    if (file) {
      setActiveFile(file.id);
    } else {
      console.warn(`Referenced document not found locally for`, source);
    }
  };

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}
      `}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={`flex flex-col gap-1 max-w-[75%] min-w-0`}>
        <div className={`
          px-4 py-2 rounded-2xl break-words
          ${isUser 
            ? 'bg-chat-user-light dark:bg-chat-user-dark rounded-tr-sm' 
            : 'bg-chat-assistant-light dark:bg-chat-assistant-dark rounded-tl-sm'}
        `}>
          {attachedFile && (
            <div className="mb-2 pb-2 border-b border-gray-300 dark:border-gray-600 flex items-center gap-2">
              <Paperclip size={14} />
              <span className="text-xs font-medium">{attachedFile.name}</span>
            </div>
          )}
          
          <div className="prose prose-sm dark:prose-invert max-w-none break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>

          {/* General Knowledge Indicator */}
          {message.usedGeneralKnowledge && (
            <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
              <div className="text-xs bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 border border-purple-200 dark:border-purple-800">
                <p className="text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1">
                  <span>🌐</span>
                  General Knowledge Response
                </p>
                <p className="text-purple-600 dark:text-purple-400 mt-1 text-[10px]">
                  No relevant documents found in workspace. Answer provided from general knowledge.
                </p>
              </div>
            </div>
          )}

          {/* Insertion Suggestion */}
          {insertionSuggestion && !isUser && (
            <InsertSuggestion
              suggestedText={insertionSuggestion.text}
              targetFile={insertionSuggestion.targetFile}
              line={insertionSuggestion.line}
              onInserted={() => {
                // Optionally refresh the file or show success message
                console.log('Text inserted successfully');
              }}
            />
          )}

          {/* Source Citations - RAG Feature */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1 text-text-primary-light dark:text-text-primary-dark">
                <FileText size={12} />
                📚 Sources ({message.sources.length}):
              </p>
              {message.sources.map((source, idx) => (
                <div 
                  key={idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSourceClick(source)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSourceClick(source);
                    }
                  }}
                  className="text-xs bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 mb-2 last:mb-0 border border-blue-200 dark:border-blue-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 transition-transform hover:-translate-y-0.5"
                  title="Open this document in the reviewer panel"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <FileText size={10} />
                      {resolveSourceFile(source)?.name || source.filename}
                      {source.page && <span className="text-[9px]">(p. {source.page})</span>}
                      {source.sheet && <span className="text-[9px]">(sheet: {source.sheet})</span>}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 text-[10px]">
                      {Math.round(source.score * 100)}% match
                    </span>
                  </div>
                  {(source.lineStart || source.lineEnd) && (
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-1">
                      Lines {source.lineStart}-{source.lineEnd}
                    </p>
                  )}
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {source.text_preview}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <span className={`text-xs text-text-muted-light dark:text-text-muted-dark px-2 ${isUser ? 'text-right' : 'text-left'}`}>
          {formatDate(new Date(message.timestamp))}
        </span>
      </div>
    </div>
  );
};

const TypingIndicator = () => {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
        <Bot size={16} className="text-gray-600 dark:text-gray-300" />
      </div>
      
      <div className="bg-chat-assistant-light dark:bg-chat-assistant-dark px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};

export const ChatPanel = () => {
  const { messages, isTyping, attachedFileId, setAttachedFile, sendMessage } = useChatStore();
  const { getFileById } = useFileSystemStore();
  const activeFileId = useFileSystemStore(state => state.activeFileId);
  
  const [inputValue, setInputValue] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const attachedFile = attachedFileId ? getFileById(attachedFileId) : null;
  const activeFile = activeFileId ? getFileById(activeFileId) : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const context = attachedFile?.content && !attachedFile.content.startsWith('[Uploaded file:') && attachedFile.content.trim().length >= 30
      ? attachedFile.content
      : undefined;
    const docIdToUse = attachedFile?.docId || activeFile?.docId || undefined;
    await sendMessage(inputValue, context, docIdToUse);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const fileId = e.dataTransfer.getData('fileId');
    if (fileId) {
      setAttachedFile(fileId);
    }
  };

  const handleFileAttach = () => {
    // This would open a file picker in the sidebar
    // For now, we'll just show a message
    alert('Drag a document from the sidebar to attach it to the chat');
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-border-light dark:border-border-dark">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
              <Bot size={18} className="text-primary" />
              AI Assistant
            </h2>
            <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
              Ask questions about your documents
            </p>
          </div>
          <button
            onClick={async () => {
              // Clear server-side memory and start a new session id
              try { await resetSession(); } catch {}
              newSession();
              useChatStore.getState().clearMessages();
            }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Start a new chat"
          >
            <Plus size={14} />
            New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className={`
          flex-1 overflow-y-auto p-4
          ${dragOver ? 'bg-primary/5 border-2 border-primary border-dashed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-primary">
              <Paperclip size={48} className="mx-auto mb-2" />
              <p className="font-medium">Drop document to attach</p>
            </div>
          </div>
        )}

        {!dragOver && (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {isTyping && <TypingIndicator />}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border-light dark:border-border-dark p-4">
        {attachedFile && (
          <div className="mb-2 bg-primary/10 rounded-lg p-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Paperclip size={14} className="text-primary" />
              <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
                {attachedFile.name}
              </span>
            </div>
            <button
              onClick={() => setAttachedFile(null)}
              className="p-1 rounded hover:bg-primary/20 transition-colors"
            >
              <X size={14} className="text-text-muted-light dark:text-text-muted-dark" />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleFileAttach}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
            title="Attach document (drag from sidebar)"
          >
            <Paperclip size={18} className="text-text-muted-light dark:text-text-muted-dark" />
          </button>

          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="flex-1 resize-none bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-primary text-sm text-text-primary-light dark:text-text-primary-dark placeholder-text-muted-light dark:placeholder-text-muted-dark"
            rows={3}
            disabled={isTyping}
          />

          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send message (Enter)"
          >
            {isTyping ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>

        <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

