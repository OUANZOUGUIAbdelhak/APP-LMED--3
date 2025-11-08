# AI-Powered Document Workspace

A modern, web-based workspace similar to Cursor or Notion, featuring a three-pane interface with document management, editing capabilities, and an integrated AI chat assistant.

![AI Document Workspace](https://img.shields.io/badge/React-18.2.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.3.6-blue)

## ✨ Features

### 📂 Document Management (Left Sidebar)
- **Hierarchical file/folder tree** with full CRUD operations
- **Drag & drop** file organization and import
- **Multi-file import** support (PDF, DOCX, Markdown, TXT)
- **Right-click context menu** for quick actions
- **Export functionality** with ZIP compression for bulk exports
- Persistent storage using localStorage

### 📝 Document Editor (Middle Pane)
- **Markdown editor** with live preview and toolbar
- **PDF viewer** with zoom and navigation
- **DOCX support** with text extraction and rendering
- **Plain text editor** for TXT files
- **Auto-save** functionality
- Smooth scrolling and responsive design

### 💬 AI Chat Assistant (Right Sidebar)
- Modern chat interface with message history
- **Document-aware conversations** - drag files to attach context
- Markdown rendering in messages
- Typing indicators and timestamps
- **RAG-ready architecture** for future LlamaIndex integration
- Mock API responses (ready for real LLM integration)

### 🎨 UI/UX
- **Light/Dark mode** with smooth transitions
- **Resizable panes** using react-split
- **Cursor-style minimalist design**
- **Responsive layout** optimized for desktop
- Custom color palette and CSS variables
- Smooth animations and transitions

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Start the development server:**
```bash
npm run dev
```

3. **Open your browser:**
Navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
ai-document-workspace/
├── src/
│   ├── components/          # React components
│   │   ├── Toolbar.tsx     # Top toolbar with actions
│   │   ├── BottomBar.tsx   # Bottom status bar
│   │   ├── FileExplorer.tsx # Left sidebar file tree
│   │   ├── DocumentViewer.tsx # Middle pane editor
│   │   └── ChatPanel.tsx   # Right sidebar chat
│   ├── stores/             # Zustand state management
│   │   ├── fileSystemStore.ts
│   │   ├── chatStore.ts
│   │   └── appStore.ts
│   ├── types/              # TypeScript interfaces
│   │   └── index.ts
│   ├── lib/                # Utility functions
│   │   └── fileUtils.ts
│   ├── styles/             # Global styles
│   │   └── globals.css
│   ├── App.tsx             # Main application
│   └── main.tsx            # Entry point
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🎯 Key Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first styling
- **Zustand** - State management
- **React Split** - Resizable panes
- **React Markdown** - Markdown rendering
- **SimpleMDE** - Markdown editor
- **React PDF** - PDF viewing
- **Mammoth** - DOCX text extraction
- **Lucide React** - Icon library
- **Framer Motion** - Animations (ready to use)

## 🔧 Usage Guide

### Creating Documents
1. Click the **New File** button in the toolbar
2. Or right-click a folder and select "New File"
3. Choose the file type (Markdown, TXT)

### Importing Documents
1. Click the **Import** button in the toolbar
2. Or drag and drop files directly into the sidebar
3. Supports: `.pdf`, `.docx`, `.md`, `.txt`

### Editing Documents
1. Click on any file in the sidebar to open it
2. Edit in the middle pane
3. Changes auto-save automatically

### Using the AI Assistant
1. Type your question in the chat input
2. **Drag a document** from the sidebar into the chat to attach context
3. Press Enter to send (Shift+Enter for new line)
4. The AI will respond with context-aware answers

### Organizing Files
- **Drag files** to reorder or move into folders
- **Right-click** for quick actions (rename, delete, export)
- **Create folders** to organize your workspace

### Exporting
- Click **Export All** to download all documents as a ZIP
- Or right-click individual files to export them

## 🧠 Backend (Node + Groq + RAG)

The project includes a Node backend that provides:

- Document upload and parsing (PDF, DOCX, TXT)
- Local embedding index using `@xenova/transformers` (no external embedding API)
- Retrieval and citations (filename, page where available, line ranges)
- Chat endpoints powered by Groq models with multi-turn memory per session

### Backend Setup

1. Create a `.env` file in `server/` with:

```
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-70b-versatile
PORT=3001
```

2. Install backend dependencies:

```bash
cd server && npm i
```

3. Start the backend:

```bash
npm run server
```

4. Start the frontend in another terminal:

```bash
npm run dev
```

The frontend looks for `VITE_API_URL` and falls back to `http://localhost:3001/api`.

## 🧠 Future Enhancements (RAG Integration)

The application is architected to support Retrieval-Augmented Generation (RAG):

1. **Document Ingestion Pipeline**
   - Automatic text extraction when files are added
   - Chunking and embedding generation

2. **Vector Database Integration**
   - LlamaIndex + FAISS/Chroma setup
   - Semantic search capabilities

3. **Enhanced Chat Context**
   - Query augmentation with retrieved snippets
   - Context mode toggle (use all docs vs. single doc)

4. **Backend API**
   - Replace mock `/api/chat` endpoint
   - Connect to OpenAI, Anthropic, or local models
   - Implement proper document storage (PostgreSQL/MongoDB)

### Connecting a Real LLM

Replace the mock API in `src/stores/chatStore.ts`:

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message, 
    context,
    model: 'gpt-4' // or your preferred model
  }),
});
```

## 🎨 Customization

### Color Palette
Edit `tailwind.config.js` to customize colors:

```js
colors: {
  primary: '#1380F5',
  // Add your custom colors
}
```

### CSS Variables
Modify `src/styles/globals.css`:

```css
:root {
  --color-primary: #1380F5;
  --color-sidebar-bg: #F6F8FB;
  /* Customize variables */
}
```

## 🐛 Known Limitations

- PDF viewing shows placeholder (requires file buffer implementation)
- DOCX editing is view-only (extracted text displayed)
- PDF page-level parsing can be improved (currently line ranges; page when available)
- Storage is browser-based (no backend persistence yet)

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Inspired by Cursor, Notion, and modern document workspaces
- Built with modern web technologies and best practices
- Designed for extensibility and future enhancements

---

**Built with ❤️ for the future of AI-powered document workflows**

