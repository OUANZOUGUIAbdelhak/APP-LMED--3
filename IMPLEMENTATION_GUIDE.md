# Implementation Guide - Enhanced Document AI Workspace

## 🎉 New Features Implemented

### 1. **XLSX File Support**
- ✅ Full Excel file parsing and indexing
- ✅ Q&A capabilities over spreadsheet data
- ✅ Sheet-aware content extraction
- ✅ Cell-level data access

### 2. **Advanced Document Viewers**

#### PDF Viewer
- ✅ Full PDF rendering with react-pdf
- ✅ Page navigation (previous/next)
- ✅ Zoom controls (zoom in/out)
- ✅ Page indicator
- ✅ Error handling for corrupted files

#### DOCX Viewer
- ✅ Word document rendering with docx-preview
- ✅ Preserves formatting (fonts, styles, colors)
- ✅ Displays headers, footers, footnotes
- ✅ Page breaks and document structure
- ✅ Modern Word-like appearance

#### XLSX Viewer
- ✅ Excel spreadsheet rendering with full table view
- ✅ Multiple sheet support with tab navigation
- ✅ Edit mode for cell editing
- ✅ Column headers (A, B, C...) and row numbers
- ✅ Export functionality
- ✅ Cell-by-cell editing with keyboard navigation

### 3. **Intelligent Document Search**
- ✅ Automatic search across all documents when none selected
- ✅ Relevance scoring (>0.5 threshold)
- ✅ Document references with filename, page, sheet, and line numbers
- ✅ Source citations in chat responses

### 4. **General Knowledge Fallback**
- ✅ Automatic fallback to general knowledge when no relevant documents found
- ✅ Visual indicator showing "General Knowledge Response"
- ✅ Clear communication about information source
- ✅ Higher temperature for general responses (0.5 vs 0.2)

## 📦 Installation

### 1. Install Server Dependencies

```bash
cd server
npm install
```

New packages added:
- `xlsx@^0.18.5` - Excel file parsing

### 2. Install Client Dependencies

```bash
cd ..
npm install
```

New packages added:
- `docx-preview@^0.3.0` - Word document rendering
- `xlsx@^0.18.5` - Excel file handling (client-side)
- `@react-pdf-viewer/core@^3.12.0` - PDF viewer core
- `@react-pdf-viewer/default-layout@^3.12.0` - PDF viewer UI

### 3. Environment Setup

Create or update `server/.env`:

```env
PORT=3001
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-70b-versatile
```

## 🚀 Running the Application

### Development Mode

```bash
# Start both server and client
npm run dev:all

# Or run separately:
# Terminal 1 - Server
npm run server

# Terminal 2 - Client
npm run dev
```

### Production Mode

```bash
# Build client
npm run build

# Start server
npm run server:start
```

## 📖 Usage Guide

### Uploading Documents

1. Click the "Upload File" button in the sidebar
2. Select supported file types:
   - PDF (.pdf)
   - Word (.docx, .doc)
   - Excel (.xlsx, .xls)
   - Markdown (.md)
   - Text (.txt)
3. File is automatically:
   - Uploaded to server
   - Parsed and indexed
   - Ready for Q&A

### Document Viewing

#### PDF Documents
- **Navigation**: Use ◀ ▶ buttons or Page N of M display
- **Zoom**: Use zoom in/out buttons or view percentage
- **Viewing**: Full page rendering with text selection

#### Word Documents
- **Viewing**: Rendered with original formatting
- **Features**: Headers, footers, styles preserved
- **Layout**: Modern document appearance

#### Excel Spreadsheets
- **Sheet Navigation**: Dropdown to switch between sheets
- **View Mode**: Read-only table view with headers
- **Edit Mode**: Click "Edit Mode" button
  - Click any cell to edit
  - Press Enter to save
  - Press Escape to cancel
- **Export**: Download modified spreadsheet

### AI Chat Features

#### With Document Context
```
User: "What's in this spreadsheet?"
AI: [Analyzes active/attached document]
    Sources: filename.xlsx sheet:Sheet1 lines 1-50
```

#### Without Specific Document
```
User: "What is machine learning?"
AI: [Searches all documents]
    - If relevant docs found: Cites sources
    - If no relevant docs: Uses general knowledge
      🌐 General Knowledge Response indicator shown
```

#### Document References
All AI responses include:
- **Filename**: Which document was used
- **Page**: PDF page number (if applicable)
- **Sheet**: Excel sheet name (if applicable)
- **Lines**: Line range in document
- **Score**: Relevance percentage

## 🏗️ Architecture

### Backend Changes

#### `server/lib/parser.js`
- Added `parseXlsx()` function
- Sheet-aware segmentation
- Cell reference formatting (A1, B2, etc.)

#### `server/lib/agent.js`
- Updated `buildSystemPrompt()` with XLSX support
- Added `hasRelevantDocs` parameter
- Dynamic temperature (0.2 for docs, 0.5 for general)
- Enhanced tool descriptions

#### `server/index.js`
- Added `/uploads` static file serving
- Enhanced `/api/agent/chat` endpoint
- Automatic document search logic
- Relevance threshold filtering (0.5)

### Frontend Changes

#### `src/components/DocumentViewer.tsx`
- New `PDFViewer` component (full-featured)
- New `DocxViewer` component (with docx-preview)
- New `XlsxViewer` component (Excel-like interface)
- File URL generation for binary files
- Proper file path handling

#### `src/components/ChatPanel.tsx`
- General knowledge indicator
- Enhanced source citations
- Page and sheet number display
- Line range information

#### `src/stores/chatStore.ts`
- Added `usedGeneralKnowledge` parameter
- Source metadata preservation

#### `src/types/index.ts`
- Added `xlsx` to FileType
- Extended ChatMessage with `usedGeneralKnowledge`
- Enhanced source metadata (page, sheet, lineStart, lineEnd)

## 🔧 Configuration

### Relevance Threshold
Adjust in `server/index.js`:
```javascript
const relevantDocs = allDocsSearch.filter(r => r.score > 0.5);
```

### Temperature Settings
In `server/lib/agent.js`:
```javascript
temperature: hasRelevantDocs ? 0.2 : 0.5
```

### Max Tokens
In `server/lib/agent.js`:
```javascript
max_tokens: 1200
```

## 🎨 UI/UX Enhancements

### Document Viewers
- **Consistent Styling**: All viewers use similar toolbar patterns
- **Dark Mode Support**: All components support dark theme
- **Loading States**: Spinner indicators during load
- **Error Handling**: User-friendly error messages
- **Responsive Design**: Works on different screen sizes

### Chat Interface
- **Source Cards**: Blue cards for document sources
- **General Knowledge Badge**: Purple card for general responses
- **Metadata Display**: Page/sheet/line information
- **Relevance Scores**: Percentage match display

## 🐛 Troubleshooting

### PDF Not Rendering
- Check PDF.js worker URL in `DocumentViewer.tsx`
- Verify file path is accessible
- Check browser console for errors

### DOCX Shows Empty
- Ensure `docx-preview` is installed
- Check file format (should be .docx not .doc)
- Verify file isn't corrupted

### XLSX Not Loading
- Confirm xlsx package is installed
- Check file isn't password protected
- Verify file format

### General Knowledge Not Working
- Check GROQ_API_KEY in .env
- Verify internet connection
- Check server logs for errors

## 📝 Testing Checklist

- [ ] Upload PDF and verify rendering
- [ ] Upload DOCX and check formatting
- [ ] Upload XLSX and navigate sheets
- [ ] Edit XLSX cells and export
- [ ] Ask question about specific document
- [ ] Ask question with no relevant docs
- [ ] Verify general knowledge indicator appears
- [ ] Check source citations include page/sheet/lines
- [ ] Test zoom controls on PDF
- [ ] Test sheet switching in Excel viewer
- [ ] Upload multiple documents
- [ ] Ask question that spans multiple documents

## 🚀 Next Steps / Future Enhancements

1. **DOCX Editing**: Add full editing capabilities (currently view-only)
2. **PDF Annotation**: Add ability to highlight and comment
3. **XLSX Formulas**: Support formula evaluation
4. **Web Search Integration**: Add real web search API for general knowledge
5. **Document Comparison**: Compare multiple documents
6. **Advanced Filters**: Filter documents by type, date, etc.
7. **Batch Operations**: Bulk upload and processing
8. **Export Reports**: Generate summary reports from Q&A

## 📚 API Reference

### New Endpoint Features

#### POST /api/agent/chat
**Request:**
```json
{
  "message": "Your question",
  "document": {
    "filename": "example.xlsx",
    "content": "..."
  },
  "documentIds": ["doc-id-1"]
}
```

**Response:**
```json
{
  "response": "AI answer",
  "sources": [
    {
      "filename": "example.xlsx",
      "score": 0.85,
      "text_preview": "...",
      "page": null,
      "sheet": "Sheet1",
      "lineStart": 10,
      "lineEnd": 25
    }
  ],
  "toolCalls": [],
  "usedGeneralKnowledge": false
}
```

## 🔐 Security Considerations

1. **File Upload Limits**: Currently 10MB (configurable in server/index.js)
2. **File Type Validation**: Only specified extensions accepted
3. **Static File Serving**: Uploads served from dedicated directory
4. **API Key Storage**: Never expose GROQ_API_KEY in client code

## 📄 License

This implementation follows the existing project license.

## 👥 Support

For issues or questions:
1. Check this guide first
2. Review browser console for errors
3. Check server logs
4. Verify all dependencies installed
5. Ensure environment variables set correctly

