import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Import core modules
import { VectorStore } from './lib/vectorStore.js';
import { MemoryStore } from './lib/memory.js';
import { runAgentLoop } from './lib/agent.js';
import { parsePdf, parseDocx, parseTxt } from './lib/parser.js';

dotenv.config();

// Validate LLM configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'groq';
const supportedProviders = ['groq', 'bytedance', 'openai'];

if (!supportedProviders.includes(LLM_PROVIDER)) {
  console.error(`Unsupported LLM_PROVIDER: ${LLM_PROVIDER}. Supported: ${supportedProviders.join(', ')}`);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize stores
const vectorStore = new VectorStore();
const memoryStore = new MemoryStore();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, 'data', 'uploads');
await fs.mkdir(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${sanitized}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,txt').split(',');
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${ext} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  const apiKeyConfigured = !!(
    process.env.GROQ_API_KEY || 
    process.env.BYTEDANCE_API_KEY || 
    process.env.OPENAI_API_KEY
  );
  
  res.json({
    status: 'ok',
    llmProvider: LLM_PROVIDER,
    llmConfigured: apiKeyConfigured,
    timestamp: new Date().toISOString()
  });
});

/**
 * Upload and index a document
 * POST /api/documents/upload
 * Body: multipart/form-data with 'file' field
 * Returns: { docId, filename, originalName, segments }
 */
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('[UPLOAD] Processing file:', req.file.filename);
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let segments = [];
    
    // Parse document based on type
    if (ext === '.pdf') {
      segments = await parsePdf(filePath);
    } else if (ext === '.docx') {
      segments = await parseDocx(filePath);
    } else if (ext === '.txt') {
      segments = await parseTxt(filePath);
    }

    console.log(`[UPLOAD] Parsed ${segments.length} segments from ${req.file.filename}`);

    // Index in vector store
    const docId = await vectorStore.indexDocument(req.file.filename, segments);
    console.log(`[UPLOAD] Indexed document with ID: ${docId}`);

    res.json({
      docId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      segments: segments.length
    });

  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Query documents using RAG
 * POST /api/rag/query
 * Body: { query: string, documentIds?: string[], topK?: number }
 * Returns: { results: [{ docId, content, score, metadata }] }
 */
app.post('/api/rag/query', async (req, res) => {
  try {
    const { query, documentIds, topK = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await vectorStore.search(query, topK, documentIds);
    
    res.json({ results });

  } catch (error) {
    console.error('[RAG] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Chat with agent (with RAG and tool calling)
 * POST /api/agent/chat
 * Body: { 
 *   message: string, 
 *   sessionId?: string,
 *   documentIds?: string[],
 *   activeDocumentId?: string 
 * }
 * Returns: { reply: string, sources: [...], sessionId: string }
 */
app.post('/api/agent/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default', documentIds, activeDocumentId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('[AGENT] Processing message:', { message, sessionId, documentIds, activeDocumentId });

    // Get chat history
    const history = memoryStore.get(sessionId);

    // Perform RAG search if documents are provided
    let retrieved = [];
    let activeDocumentName = null;

    if (documentIds && documentIds.length > 0) {
      retrieved = await vectorStore.search(message, 5, documentIds);
      console.log(`[AGENT] Retrieved ${retrieved.length} chunks from RAG`);

      // Determine active document name
      if (activeDocumentId) {
        activeDocumentName = activeDocumentId;
      } else if (retrieved.length > 0) {
        activeDocumentName = retrieved[0].docId;
      }
    }

    // Run agent loop with tools
    const agentResponse = await runAgentLoop({
      userMessage: message,
      history,
      retrieved,
      uploadsDir,
      activeDocument: activeDocumentName,
      llmProvider: LLM_PROVIDER
    });

    // Update memory
    memoryStore.add(sessionId, { role: 'user', content: message });
    memoryStore.add(sessionId, { role: 'assistant', content: agentResponse.reply });

    res.json({
      reply: agentResponse.reply,
      sources: agentResponse.sources || [],
      sessionId
    });

  } catch (error) {
    console.error('[AGENT] Error:', error);
    console.error('[AGENT] Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset chat session
 * POST /api/session/reset
 * Body: { sessionId?: string }
 * Returns: { success: true, sessionId: string }
 */
app.post('/api/session/reset', (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    memoryStore.clear(sessionId);
    console.log(`[SESSION] Reset session: ${sessionId}`);
    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('[SESSION] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get indexed documents
 * GET /api/documents
 * Returns: { documents: [{ docId, segmentCount }] }
 */
app.get('/api/documents', (req, res) => {
  try {
    const documents = vectorStore.getDocuments();
    res.json({ documents });
  } catch (error) {
    console.error('[DOCUMENTS] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a document
 * DELETE /api/documents/:docId
 * Returns: { success: true, docId: string }
 */
app.delete('/api/documents/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    await vectorStore.deleteDocument(docId);
    
    // Also delete the physical file if it exists
    const filePath = path.join(uploadsDir, docId);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.warn(`[DELETE] Could not delete file: ${filePath}`, err.message);
    }

    res.json({ success: true, docId });
  } catch (error) {
    console.error('[DELETE] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  const apiKeyConfigured = !!(
    process.env.GROQ_API_KEY || 
    process.env.BYTEDANCE_API_KEY || 
    process.env.OPENAI_API_KEY
  );
  
  console.log(`\n🚀 Document Q&A API running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
  console.log(`🤖 LLM Provider: ${LLM_PROVIDER}`);
  console.log(`🔑 LLM API configured: ${apiKeyConfigured}\n`);
});

