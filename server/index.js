import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import { v4 as uuidv4 } from 'uuid';
import { parseUploadedFile, parseTextDirect } from './lib/parser.js';
import { VectorStore } from './lib/vectorStore.js';
import { MemoryStore } from './lib/memory.js';
import { runAgentLoop } from './lib/agent.js';
import htmlDocx from 'html-docx-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Storage directories
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// Init services
const vectorStore = new VectorStore(path.join(DATA_DIR, 'index.json'));
const memoryStore = new MemoryStore();

// File upload setup
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    // Accept all file types for now
    cb(null, true);
  }
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Helpers
function getSessionId(req) {
  return (
    req.headers['x-session-id'] ||
    (typeof req.body?.sessionId === 'string' ? req.body.sessionId : null) ||
    null
  );
}

function buildPrompt(question, retrieved, history) {
  const sourcesSection = retrieved
    .map((r, i) => {
      const cite = `${r.filename}${r.page ? ` p${r.page}` : ''} lines ${r.lineStart}-${r.lineEnd}`;
      return `SOURCE ${i + 1} [${cite}]:\n${r.text}`;
    })
    .join('\n\n');

  const historyLines = history
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n');

  return `You are a precise AI assistant. Use ONLY the provided sources to answer.
If the answer is not contained in the sources, say you don't know.
Always include inline citations like [filename pX lines A-B] after each relevant claim.

Question:\n${question}\n\nChat History:\n${historyLines}\n\nSources:\n${sourcesSection}`;
}

function buildGeneralMessages(question, history) {
  const historyMsgs = history.slice(-6).map(h => ({ role: h.role, content: h.content }));
  return [
    { role: 'system', content: 'You are a helpful AI assistant. Answer normally unless asked to cite documents.' },
    ...historyMsgs,
    { role: 'user', content: question }
  ];
}

function isMeaningfulDocument(doc) {
  if (!doc || typeof doc.content !== 'string') return false;
  const t = doc.content.trim();
  if (t.length < 30) return false;
  if (t.startsWith('[Uploaded file:')) return false; // placeholder, not actual content
  return true;
}

// Routes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    rag_enabled: true,
    document_count: vectorStore.countDocuments(),
    groqConfigured: Boolean(process.env.GROQ_API_KEY)
  });
});

app.post('/api/session/reset', (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (sessionId) {
      memoryStore.clear(sessionId);
    }
    res.json({ status: 'cleared' });
  } catch (err) {
    console.error('Session reset error:', err);
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`📄 Processing upload: ${req.file.originalname}`);
    console.log(`   MIME type: ${req.file.mimetype}`);
    console.log(`   Saved as: ${req.file.filename}`);
    console.log(`   Path: ${req.file.path}`);
    console.log(`   Size: ${req.file.size} bytes`);
    
    try {
      const parsed = await parseUploadedFile(req.file.path, req.file.originalname);
      
      console.log(`   Extracted ${parsed.segments.length} segments`);
      
      const docId = uuidv4();
      // Use the actual saved filename (with timestamp) for indexing
      const savedFilename = req.file.filename;
      await vectorStore.indexDocument({
        id: docId,
        filename: savedFilename,
        segments: parsed.segments.map(seg => ({ ...seg, filename: savedFilename }))
      });
      
      console.log(`✅ Indexed document: ${savedFilename} (${docId})`);
      
      res.json({ id: docId, status: 'indexed', filename: savedFilename });
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Even if parsing fails, still save the file reference
      const docId = uuidv4();
      const savedFilename = req.file.filename;
      console.log(`⚠️  Parse failed but file saved: ${savedFilename} (${docId})`);
      res.json({ 
        id: docId, 
        status: 'uploaded', 
        filename: savedFilename,
        warning: `File uploaded but parsing failed: ${parseError.message}`
      });
    }
  } catch (err) {
    console.error('Upload error:', err);
    console.error('Stack:', err.stack);
    
    // Handle multer errors specifically
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large', details: 'Maximum file size is 50MB' });
    }
    
    res.status(500).json({ error: 'Failed to process file', details: err.message });
  }
});

app.post('/api/documents/index', async (req, res) => {
  try {
    const { filename, content } = req.body || {};
    if (!filename || !content) return res.status(400).json({ error: 'filename and content required' });
    const parsed = await parseTextDirect(content, filename);
    const docId = uuidv4();
    await vectorStore.indexDocument({ id: docId, filename, segments: parsed.segments });
    res.json({ id: docId, status: 'indexed' });
  } catch (err) {
    console.error('Index error:', err);
    res.status(500).json({ error: 'Failed to index document' });
  }
});

app.post('/api/documents/index-batch', async (req, res) => {
  try {
    const documents = Array.isArray(req.body) ? req.body : [];
    let count = 0;
    for (const doc of documents) {
      if (!doc.filename || !doc.content) continue;
      const parsed = await parseTextDirect(doc.content, doc.filename);
      const docId = uuidv4();
      await vectorStore.indexDocument({ id: docId, filename: doc.filename, segments: parsed.segments });
      count += 1;
    }
    res.json({ count });
  } catch (err) {
    console.error('Batch index error:', err);
    res.status(500).json({ error: 'Failed to batch index documents' });
  }
});

app.post('/api/documents/clear-all', async (req, res) => {
  try {
    // Clear vector store
    vectorStore.index = { documents: {}, chunks: [] };
    vectorStore._save();
    
    // Delete all files in uploads directory
    const files = fs.readdirSync(UPLOAD_DIR);
    let deletedCount = 0;
    for (const file of files) {
      try {
        const filePath = path.join(UPLOAD_DIR, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (err) {
        console.warn(`Failed to delete ${file}:`, err.message);
      }
    }
    
    console.log(`🗑️  Cleared all documents: ${deletedCount} files deleted, vector store cleared`);
    res.json({ success: true, deletedFiles: deletedCount, message: 'All documents and index cleared successfully' });
  } catch (err) {
    console.error('Clear all error:', err);
    res.status(500).json({ error: 'Failed to clear documents' });
  }
});

app.delete('/api/documents/:docIdOrFilename', async (req, res) => {
  try {
    const { docIdOrFilename } = req.params;
    
    // Delete from vector store
    const deleted = await vectorStore.deleteDocument(docIdOrFilename);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Try to delete the physical file
    const filePath = path.join(UPLOAD_DIR, docIdOrFilename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted file: ${filePath}`);
      }
    } catch (fileErr) {
      console.warn(`⚠️  Could not delete physical file: ${filePath}`, fileErr.message);
    }

    res.json({ success: true, docId: docIdOrFilename });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

app.post('/api/documents/export-docx', (req, res) => {
  try {
    const { html, fileName } = req.body || {};
    if (typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({ error: 'html content is required' });
    }

    const requestedName = typeof fileName === 'string' && fileName.trim().length > 0
      ? fileName.trim()
      : 'document.docx';
    const ensuredName = requestedName.toLowerCase().endsWith('.docx') ? requestedName : `${requestedName}.docx`;
    const safeFileName = ensuredName.replace(/[^a-zA-Z0-9_.-]/g, '_');

    const base64Doc = htmlDocx.asBase64(html);
    const buffer = Buffer.from(base64Doc, 'base64');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error('DOCX export error:', err);
    res.status(500).json({ error: 'Failed to export DOCX' });
  }
});

app.get('/api/documents/search', async (req, res) => {
  try {
    const query = String(req.query.query || '');
    const topK = Number(req.query.top_k || 5);
    if (!query) return res.status(400).json({ error: 'query required' });
    const results = await vectorStore.search(query, topK);
    res.json({ results: results.map(r => ({
      filename: r.filename,
      score: r.score,
      docId: r.docId,
      text: r.text,
      page: r.page || null,
      sheet: r.sheet || null,
      lineStart: r.lineStart,
      lineEnd: r.lineEnd
    })) });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Failed to search' });
  }
});

app.post('/api/rag/query', async (req, res) => {
  try {
    const { query, documentIds } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query required' });
    const sessionId = getSessionId(req);
    const retrieved = await vectorStore.search(query, 5, documentIds);
    const history = sessionId ? memoryStore.getHistory(sessionId) : [];
    const prompt = buildPrompt(query, retrieved, history);

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        { role: 'system', content: 'Follow instructions precisely and include citations.' },
        { role: 'user', content: prompt }
      ]
    });

    const answer = completion.choices?.[0]?.message?.content || '';
    if (sessionId) memoryStore.append(sessionId, { role: 'user', content: query }, { role: 'assistant', content: answer });

    res.json({
      response: answer,
      timestamp: new Date().toISOString(),
      sources: retrieved.map(r => ({
        filename: r.filename,
        docId: r.docId,
        score: r.score,
        text_preview: r.text.slice(0, 320) + (r.text.length > 320 ? '…' : ''),
        page: r.page || null,
        sheet: r.sheet || null,
        lineStart: r.lineStart,
        lineEnd: r.lineEnd
      }))
    });
  } catch (err) {
    console.error('RAG query error:', err);
    res.status(500).json({ error: 'RAG query failed' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, use_rag = false, top_k = 5 } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message required' });
    const sessionId = getSessionId(req);
    const history = sessionId ? memoryStore.getHistory(sessionId) : [];

    let retrieved = [];
    if (use_rag) {
      retrieved = await vectorStore.search(message, Number(top_k) || 5);
    }
    const prompt = buildPrompt(message, retrieved, history);

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        { role: 'system', content: 'Be helpful and cite sources when available.' },
        { role: 'user', content: prompt }
      ]
    });

    const answer = completion.choices?.[0]?.message?.content || '';
    if (sessionId) memoryStore.append(sessionId, { role: 'user', content: message }, { role: 'assistant', content: answer });

    res.json({ response: answer, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat failed' });
  }
});

app.post('/api/agent/chat', async (req, res) => {
  try {
    const { message, document, documentIds } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message required' });
    const sessionId = getSessionId(req);
    const history = sessionId ? memoryStore.getHistory(sessionId) : [];

    // Detect meta-questions about the workspace itself (not about document content)
    const metaQuestionPatterns = [
      /what (files|documents|files and folders) (do I have|are in|are there)/i,
      /list (all )?(my )?(files|documents|files and folders)/i,
      /show me (all )?(my )?(files|documents|files and folders)/i,
      /what's in (my )?(workspace|folder|directory)/i,
      /(list|show|what) (all )?files/i
    ];
    const isMetaQuestion = metaQuestionPatterns.some(pattern => pattern.test(message));
    
    // For meta-questions, directly call list_dir tool instead of relying on Groq function calling
    if (isMetaQuestion) {
      try {
        const { listDir } = await import('./lib/tools/listDir.js');
        const fileList = await listDir({ target_directory: '.', recursive: false }, { uploadsDir: UPLOAD_DIR });
        
        // Format the file list nicely
        const files = fileList.split('\n').filter(f => f.trim());
        const formattedFiles = files.map(file => {
          // Remove timestamp prefix if present (format: timestamp-filename)
          const match = file.match(/^\d+-(.+)$/);
          return match ? match[1] : file;
        });
        
        const formattedList = formattedFiles.length > 0
          ? `Here are the documents in your workspace:\n\n${formattedFiles.map(f => `• ${f}`).join('\n')}`
          : 'Your workspace is empty. Upload some documents to get started!';
        
        if (sessionId) memoryStore.append(sessionId, { role: 'user', content: message }, { role: 'assistant', content: formattedList });
        
        return res.json({
          response: formattedList,
          timestamp: new Date().toISOString(),
          sources: [],
          toolCalls: [{ name: 'list_dir', args: { target_directory: '.' } }],
          usedGeneralKnowledge: false
        });
      } catch (toolErr) {
        console.error('Error calling list_dir:', toolErr);
        // Fall through to normal agent flow if tool fails
      }
    }

    // If a document is attached inline, index it as a transient doc
    let restrictDocIds = Array.isArray(documentIds) && documentIds.length > 0 ? documentIds : undefined;
    let useRag = Boolean(restrictDocIds && restrictDocIds.length > 0);
    if (!useRag && document?.filename && isMeaningfulDocument(document)) {
      const parsed = await parseTextDirect(document.content, document.filename);
      const docId = `transient-${uuidv4()}`;
      await vectorStore.indexDocument({ id: docId, filename: document.filename, segments: parsed.segments });
      restrictDocIds = [docId];
      useRag = true;
    }

    // Note: isMetaQuestion is already detected above if we reach here
    
    // If no specific document context, search all documents for relevant content
    let retrieved = [];
    let hasRelevantDocs = true;
    
    // Skip RAG for meta-questions - let tools handle workspace exploration
    if (!useRag && !isMetaQuestion) {
      // Search across all documents in the vector store
      const allDocsSearch = await vectorStore.search(message, 10); // Get more results
      
      console.log(`🔍 Search results for "${message}":`, allDocsSearch.map(r => ({
        filename: r.filename,
        score: r.score.toFixed(3),
        preview: r.text.slice(0, 100)
      })));
      
      // Use a lower threshold - even weak matches can be helpful
      // Also ensure we have at least some results if any exist
      const relevantDocs = allDocsSearch.filter(r => r.score > 0.3);
      
      if (relevantDocs.length > 0) {
        retrieved = relevantDocs.slice(0, 5); // Take top 5
        useRag = true;
        console.log(`📚 Found ${relevantDocs.length} relevant documents (using top ${retrieved.length})`);
      } else if (allDocsSearch.length > 0) {
        // Even if scores are low, use the best matches we have
        retrieved = allDocsSearch.slice(0, 3);
        useRag = true;
        console.log(`📚 Using ${retrieved.length} best matches (low scores but available)`);
      } else {
        // No documents found at all
        hasRelevantDocs = false;
        console.log(`💭 No documents found in vector store. Total documents: ${vectorStore.countDocuments()}`);
      }
    } else {
      // Retrieve RAG sources with document restriction
      retrieved = await vectorStore.search(message, 5, restrictDocIds);
      console.log(`📚 Retrieved ${retrieved.length} documents from restricted set`);
    }

    // Determine active document filename from retrieved sources or inline document
    let activeDocumentName = null;
    if (retrieved.length > 0) {
      // Use the filename from the first retrieved chunk
      activeDocumentName = retrieved[0].filename;
    } else if (document?.filename) {
      activeDocumentName = document.filename;
    } else if (restrictDocIds && restrictDocIds.length > 0) {
      // Try to get filename from vector store document
      const docMeta = vectorStore.index.documents[restrictDocIds[0]];
      if (docMeta) activeDocumentName = docMeta.filename;
    }

    // Run agent loop with tools + RAG
    const { response: answer, toolCalls } = await runAgentLoop({
      message,
      history,
      retrieved,
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
      uploadsDir: UPLOAD_DIR,
      activeDocument: activeDocumentName,
      hasRelevantDocs
    });

    if (sessionId) memoryStore.append(sessionId, { role: 'user', content: message }, { role: 'assistant', content: answer });

    // For meta-questions (workspace listing), don't include sources and don't mark as general knowledge
    const shouldIncludeSources = !isMetaQuestion;
    const shouldMarkAsGeneralKnowledge = !hasRelevantDocs && !isMetaQuestion;

    res.json({
      response: answer,
      timestamp: new Date().toISOString(),
      sources: shouldIncludeSources ? retrieved.map(r => ({
        filename: r.filename,
        docId: r.docId,
        score: r.score,
        text_preview: r.text.slice(0, 320) + (r.text.length > 320 ? '…' : ''),
        page: r.page || null,
        sheet: r.sheet || null,
        lineStart: r.lineStart,
        lineEnd: r.lineEnd
      })) : [],
      toolCalls: toolCalls || [],
      usedGeneralKnowledge: shouldMarkAsGeneralKnowledge
    });
  } catch (err) {
    console.error('Agent chat error:', err);
    console.error('Error stack:', err.stack);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Agent chat failed: ${errorMessage}` });
  }
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});


