# Document Q&A API

A production-ready API for document question-answering using Retrieval-Augmented Generation (RAG) and Groq LLM with intelligent tool calling.

## Features

- 📄 **Multi-format Support**: PDF, DOCX, TXT document parsing
- 🔍 **Semantic Search**: Vector-based document retrieval (RAG)
- 🤖 **Intelligent Agent**: Groq-powered LLM with function calling
- 💬 **Chat Memory**: Session-based conversation history
- 🛠️ **File System Tools**: Read, list, search, and extract documents
- 🔒 **Workspace Security**: Sandboxed file access
- 📊 **Accurate Citations**: Source references with line numbers

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP/REST
┌──────▼──────────────────────────────────────┐
│           Express API Server                │
├─────────────────────────────────────────────┤
│  Endpoints:                                 │
│  - POST /api/documents/upload               │
│  - POST /api/rag/query                      │
│  - POST /api/agent/chat                     │
│  - POST /api/session/reset                  │
│  - GET  /api/documents                      │
│  - DELETE /api/documents/:docId             │
└──────┬────────────────────┬─────────────────┘
       │                    │
┌──────▼──────┐      ┌──────▼──────────┐
│ VectorStore │      │  MemoryStore    │
│  (RAG)      │      │  (Chat History) │
└──────┬──────┘      └─────────────────┘
       │
┌──────▼────────────────────────────────┐
│         Groq Agent Loop               │
│  ┌─────────────────────────────────┐  │
│  │  System Prompt + RAG Context    │  │
│  └─────────────┬───────────────────┘  │
│                │                      │
│  ┌─────────────▼───────────────────┐  │
│  │    Groq LLM (Function Calling)  │  │
│  └─────────────┬───────────────────┘  │
│                │                      │
│  ┌─────────────▼───────────────────┐  │
│  │         Tool Handlers           │  │
│  │  - read_file                    │  │
│  │  - list_dir                     │  │
│  │  - grep_files                   │  │
│  │  - extract_document             │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

## Installation

### 1. Install Dependencies

```bash
cd document-qa-api
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and configure your LLM provider. See `LLM_PROVIDERS.md` for detailed setup guides.

**For Groq** (default):
```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
```

**For ByteDance**:
```env
LLM_PROVIDER=bytedance
BYTEDANCE_API_KEY=your_bytedance_api_key_here
BYTEDANCE_MODEL=your_endpoint_id_here
```

**For OpenAI**:
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Start the Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## API Reference

### 1. Upload Document

Upload and index a document for Q&A.

**Endpoint**: `POST /api/documents/upload`

**Content-Type**: `multipart/form-data`

**Body**:
- `file`: Document file (PDF, DOCX, or TXT)

**Response**:
```json
{
  "docId": "1234567890-document.pdf",
  "filename": "1234567890-document.pdf",
  "originalName": "document.pdf",
  "segments": 15
}
```

**Example (curl)**:
```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@/path/to/document.pdf"
```

**Example (JavaScript)**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:3001/api/documents/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log('Document ID:', data.docId);
```

---

### 2. Chat with Agent

Ask questions about documents with intelligent tool calling.

**Endpoint**: `POST /api/agent/chat`

**Content-Type**: `application/json`

**Body**:
```json
{
  "message": "What is this document about?",
  "sessionId": "user-123",
  "documentIds": ["1234567890-document.pdf"],
  "activeDocumentId": "1234567890-document.pdf"
}
```

**Parameters**:
- `message` (required): User's question
- `sessionId` (optional): Session identifier for chat history (default: "default")
- `documentIds` (optional): Array of document IDs to search (enables RAG)
- `activeDocumentId` (optional): Primary document being discussed

**Response**:
```json
{
  "reply": "This document discusses machine learning algorithms...",
  "sources": [
    {
      "docId": "1234567890-document.pdf",
      "content": "Machine learning is a subset of AI...",
      "metadata": { "chunk": 1, "source": "pdf" }
    }
  ],
  "sessionId": "user-123"
}
```

**Example (JavaScript)**:
```javascript
const response = await fetch('http://localhost:3001/api/agent/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Summarize this document',
    sessionId: 'user-123',
    documentIds: ['1234567890-document.pdf']
  })
});

const data = await response.json();
console.log('Answer:', data.reply);
console.log('Sources:', data.sources);
```

---

### 3. RAG Query

Perform semantic search across documents (without agent).

**Endpoint**: `POST /api/rag/query`

**Content-Type**: `application/json`

**Body**:
```json
{
  "query": "machine learning algorithms",
  "documentIds": ["1234567890-document.pdf"],
  "topK": 5
}
```

**Parameters**:
- `query` (required): Search query
- `documentIds` (optional): Filter by specific documents
- `topK` (optional): Number of results to return (default: 5)

**Response**:
```json
{
  "results": [
    {
      "docId": "1234567890-document.pdf",
      "content": "Machine learning algorithms include...",
      "score": 0.87,
      "metadata": { "chunk": 3, "source": "pdf" }
    }
  ]
}
```

---

### 4. Reset Session

Clear chat history for a session.

**Endpoint**: `POST /api/session/reset`

**Content-Type**: `application/json`

**Body**:
```json
{
  "sessionId": "user-123"
}
```

**Response**:
```json
{
  "success": true,
  "sessionId": "user-123"
}
```

---

### 5. List Documents

Get all indexed documents.

**Endpoint**: `GET /api/documents`

**Response**:
```json
{
  "documents": [
    {
      "docId": "1234567890-document.pdf",
      "segmentCount": 15
    }
  ]
}
```

---

### 6. Delete Document

Remove a document from the index.

**Endpoint**: `DELETE /api/documents/:docId`

**Response**:
```json
{
  "success": true,
  "docId": "1234567890-document.pdf"
}
```

---

### 7. Health Check

Check API status.

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "ok",
  "groqConfigured": true,
  "timestamp": "2025-11-06T10:30:00.000Z"
}
```

## Integration Guide

### Frontend Integration

#### React Example

```typescript
// api.ts
const API_BASE = 'http://localhost:3001/api';

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData
  });
  
  return response.json();
}

export async function chatWithAgent(
  message: string,
  sessionId: string,
  documentIds?: string[]
) {
  const response = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, documentIds })
  });
  
  return response.json();
}

// Component.tsx
function DocumentChat() {
  const [docId, setDocId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleUpload = async (file: File) => {
    const result = await uploadDocument(file);
    setDocId(result.docId);
  };

  const handleSendMessage = async (message: string) => {
    const response = await chatWithAgent(
      message,
      'session-123',
      docId ? [docId] : undefined
    );
    
    setMessages(prev => [...prev, 
      { role: 'user', content: message },
      { role: 'assistant', content: response.reply, sources: response.sources }
    ]);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {/* Chat UI */}
    </div>
  );
}
```

### Backend Integration

#### Node.js/Express Example

```javascript
import express from 'express';
import fetch from 'node-fetch';

const app = express();
const DOC_QA_API = 'http://localhost:3001/api';

app.post('/my-app/ask', async (req, res) => {
  const { question, userId, documentId } = req.body;
  
  // Forward to Document Q&A API
  const response = await fetch(`${DOC_QA_API}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: question,
      sessionId: userId,
      documentIds: documentId ? [documentId] : undefined
    })
  });
  
  const data = await response.json();
  res.json(data);
});
```

### Python Integration

```python
import requests

API_BASE = "http://localhost:3001/api"

def upload_document(file_path):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(f"{API_BASE}/documents/upload", files=files)
        return response.json()

def chat_with_agent(message, session_id, document_ids=None):
    payload = {
        "message": message,
        "sessionId": session_id
    }
    if document_ids:
        payload["documentIds"] = document_ids
    
    response = requests.post(
        f"{API_BASE}/agent/chat",
        json=payload
    )
    return response.json()

# Usage
doc = upload_document("report.pdf")
answer = chat_with_agent(
    "Summarize this document",
    session_id="user-456",
    document_ids=[doc["docId"]]
)
print(answer["reply"])
```

## How It Works

### 1. Document Processing Pipeline

```
Upload → Parse → Chunk → Embed → Index
```

1. **Upload**: File received via multipart/form-data
2. **Parse**: Extract text from PDF/DOCX/TXT
3. **Chunk**: Split into semantic segments (paragraphs/pages)
4. **Embed**: Generate vector embeddings (TF-IDF based, replaceable)
5. **Index**: Store in VectorStore for retrieval

### 2. RAG (Retrieval-Augmented Generation)

When a user asks a question:

1. **Query Embedding**: Convert question to vector
2. **Similarity Search**: Find top-K most relevant document chunks
3. **Context Injection**: Add retrieved chunks to LLM prompt
4. **Constrained Generation**: LLM answers using only provided sources
5. **Citation**: Response includes source references

### 3. Agent Loop with Tool Calling

For complex queries requiring file system access:

1. **System Prompt**: Instructs agent on available tools
2. **LLM Decision**: Groq decides which tools to call
3. **Tool Execution**: API executes requested tools (read_file, grep, etc.)
4. **Result Injection**: Tool outputs added to conversation
5. **Iteration**: Process repeats until final answer (max 10 iterations)

**Available Tools**:
- `read_file`: Read file contents
- `list_dir`: List directory contents
- `grep_files`: Search for text patterns
- `extract_document`: Extract full document text

### 4. Workspace Security

All file operations are sandboxed to `data/uploads/`:
- Path resolution prevents directory traversal
- Only uploaded documents are accessible
- Tool handlers validate paths before execution

## Production Considerations

### 1. Vector Store

The included vector store is in-memory and uses simple TF-IDF embeddings. For production:

**Replace with**:
- **Pinecone**: Managed vector database
- **Weaviate**: Open-source vector search
- **Qdrant**: High-performance vector DB
- **Chroma**: Embeddings database

**Use proper embeddings**:
- OpenAI `text-embedding-3-small`
- Cohere `embed-english-v3.0`
- Sentence Transformers

**Example (Pinecone)**:
```javascript
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('documents');

// Index document
await index.upsert([{
  id: docId,
  values: embedding,
  metadata: { content, docId }
}]);

// Search
const results = await index.query({
  vector: queryEmbedding,
  topK: 5,
  filter: { docId: { $in: documentIds } }
});
```

### 2. Chat Memory

Replace in-memory store with Redis or database:

```javascript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

class RedisMemoryStore {
  async get(sessionId) {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : [];
  }

  async add(sessionId, message) {
    const history = await this.get(sessionId);
    history.push(message);
    await redis.set(`session:${sessionId}`, JSON.stringify(history), 'EX', 3600);
  }
}
```

### 3. File Storage

For scalability, use cloud storage:

```javascript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });

// Upload to S3
await s3.send(new PutObjectCommand({
  Bucket: 'documents-bucket',
  Key: docId,
  Body: fileBuffer
}));
```

### 4. Rate Limiting

Add rate limiting to prevent abuse:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 5. Authentication

Add JWT authentication:

```javascript
import jwt from 'jsonwebtoken';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.use('/api/', authMiddleware);
```

### 6. Monitoring

Add logging and monitoring:

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { 
    ip: req.ip, 
    sessionId: req.body.sessionId 
  });
  next();
});
```

## Troubleshooting

### Document Not Parsing

**Issue**: PDF appears empty or fails to parse

**Solutions**:
1. Check if PDF is scanned (image-based) - requires OCR
2. Try alternative PDF parser: `pdf2json`, `pdfjs-dist`
3. Verify file is not corrupted
4. Check file size limits

### Poor Search Results

**Issue**: RAG returns irrelevant chunks

**Solutions**:
1. Improve chunking strategy (semantic vs. fixed-size)
2. Use better embeddings (OpenAI, Cohere)
3. Adjust `topK` parameter
4. Add metadata filtering
5. Implement re-ranking

### Agent Not Using Tools

**Issue**: Agent doesn't call tools when needed

**Solutions**:
1. Improve system prompt clarity
2. Provide examples in prompt (few-shot)
3. Adjust `temperature` (lower = more deterministic)
4. Check tool specifications are clear
5. Verify Groq model supports function calling

### Memory Issues

**Issue**: Server crashes with large documents

**Solutions**:
1. Implement streaming for large files
2. Add pagination for search results
3. Limit chunk sizes
4. Use worker threads for parsing
5. Implement queue system (Bull, BullMQ)

## License

MIT

## Support

For issues or questions, please open an issue on the repository or contact your technical lead.

