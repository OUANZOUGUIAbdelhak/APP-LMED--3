# Integration Guide for Your your team

This guide explains how to integrate the Document Q&A API into your existing application.

## Overview

The Document Q&A API provides a standalone service that your frontend and backend can communicate with via REST endpoints. It handles:

1. Document upload and parsing (PDF, DOCX, TXT)
2. Semantic search (RAG - Retrieval-Augmented Generation)
3. Question answering with accurate citations
4. Chat history management
5. Intelligent tool calling for file system operations

## Architecture Integration

```
┌─────────────────────────────────────────┐
│      Your Existing Application          │
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │    │   Backend    │  │
│  │  (Your UI)   │    │ (Your API)   │  │
│  └──────┬───────┘    └──────┬───────┘  │
│         │                   │          │
└─────────┼───────────────────┼──────────┘
          │ HTTP              │ HTTP
          │                   │
┌─────────▼───────────────────▼──────────┐
│      Document Q&A API                  │
│      (Port 3001)                       │
│                                        │
│  - Upload documents                    │
│  - RAG search                          │
│  - Agent chat                          │
│  - Session management                  │
└────────────────────────────────────────┘
```

## Integration Approaches

### Option 1: Direct Frontend Integration (Recommended for Simple Apps)

Your frontend calls the Document Q&A API directly.

**Pros**:
- Simple to implement
- No backend changes needed
- Real-time responses

**Cons**:
- API key exposed to frontend (use proxy for production)
- CORS must be configured

**Implementation**:

```typescript
// src/services/documentQA.ts
const DOC_QA_API = 'http://localhost:3001/api';

export class DocumentQAService {
  async uploadDocument(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${DOC_QA_API}/documents/upload`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    return data.docId;
  }

  async askQuestion(
    question: string,
    sessionId: string,
    documentIds?: string[]
  ): Promise<{ reply: string; sources: any[] }> {
    const response = await fetch(`${DOC_QA_API}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        sessionId,
        documentIds
      })
    });
    
    return response.json();
  }

  async resetSession(sessionId: string): Promise<void> {
    await fetch(`${DOC_QA_API}/session/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
  }
}

// Usage in component
import { DocumentQAService } from './services/documentQA';

function ChatComponent() {
  const [docId, setDocId] = useState<string | null>(null);
  const qaService = new DocumentQAService();

  const handleFileUpload = async (file: File) => {
    const id = await qaService.uploadDocument(file);
    setDocId(id);
  };

  const handleAskQuestion = async (question: string) => {
    const { reply, sources } = await qaService.askQuestion(
      question,
      'user-session-123',
      docId ? [docId] : undefined
    );
    // Display reply and sources
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleFileUpload(e.target.files[0])} />
      {/* Chat UI */}
    </div>
  );
}
```

---

### Option 2: Backend Proxy Integration (Recommended for Production)

Your backend acts as a proxy to the Document Q&A API.

**Pros**:
- API keys stay secure on backend
- Can add authentication/authorization
- Can transform/cache responses
- Better monitoring and logging

**Cons**:
- Requires backend changes
- Slightly more latency

**Implementation**:

```javascript
// your-backend/routes/documents.js
import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const DOC_QA_API = 'http://localhost:3001/api';

// Proxy upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // Add your authentication/authorization here
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Forward to Document Q&A API
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await fetch(`${DOC_QA_API}/documents/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    
    // Store document metadata in your database
    await db.documents.create({
      userId: req.user.id,
      docId: data.docId,
      filename: data.filename,
      originalName: data.originalName
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy chat endpoint
router.post('/chat', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { message, documentIds } = req.body;

    // Verify user owns the documents
    if (documentIds) {
      const userDocs = await db.documents.findAll({
        where: { userId: req.user.id, docId: { $in: documentIds } }
      });
      if (userDocs.length !== documentIds.length) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Forward to Document Q&A API
    const response = await fetch(`${DOC_QA_API}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId: `user-${req.user.id}`,
        documentIds
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**Frontend usage**:

```typescript
// Now call your own backend instead
const response = await fetch('/api/documents/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

---

### Option 3: Microservice Integration

Run Document Q&A API as a separate microservice in your infrastructure.

**Deployment**:

```yaml
# docker-compose.yml
version: '3.8'

services:
  your-app:
    image: your-app:latest
    ports:
      - "3000:3000"
    environment:
      - DOC_QA_API_URL=http://document-qa:3001
    depends_on:
      - document-qa

  document-qa:
    build: ./document-qa-api
    ports:
      - "3001:3001"
    environment:
      - GROQ_API_KEY=${GROQ_API_KEY}
      - PORT=3001
    volumes:
      - document-uploads:/app/data/uploads

volumes:
  document-uploads:
```

---

## API Endpoints Summary

### 1. Upload Document
```
POST /api/documents/upload
Content-Type: multipart/form-data
Body: { file: File }
Response: { docId, filename, originalName, segments }
```

### 2. Chat with Agent
```
POST /api/agent/chat
Content-Type: application/json
Body: { message, sessionId, documentIds?, activeDocumentId? }
Response: { reply, sources, sessionId }
```

### 3. RAG Query (Optional)
```
POST /api/rag/query
Content-Type: application/json
Body: { query, documentIds?, topK? }
Response: { results: [{ docId, content, score, metadata }] }
```

### 4. Reset Session
```
POST /api/session/reset
Content-Type: application/json
Body: { sessionId }
Response: { success, sessionId }
```

### 5. List Documents
```
GET /api/documents
Response: { documents: [{ docId, segmentCount }] }
```

### 6. Delete Document
```
DELETE /api/documents/:docId
Response: { success, docId }
```

---

## UI Integration Examples

### Example 1: Document Upload Widget

```tsx
import { useState } from 'react';

function DocumentUploader({ onUploadComplete }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:3001/api/documents/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      onUploadComplete(data.docId, data.originalName);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={(e) => handleUpload(e.target.files[0])}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

### Example 2: Chat Interface

```tsx
import { useState } from 'react';

function DocumentChat({ documentId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          sessionId: 'user-session',
          documentIds: documentId ? [documentId] : undefined
        })
      });

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.reply,
        sources: data.sources
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <p>{msg.content}</p>
            {msg.sources && (
              <div className="sources">
                {msg.sources.map((src, j) => (
                  <details key={j}>
                    <summary>Source {j + 1}: {src.docId}</summary>
                    <p>{src.content}</p>
                  </details>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask a question..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

---

## Environment Configuration

### Development

```env
# Document Q&A API (.env)
GROQ_API_KEY=gsk_your_dev_key
PORT=3001
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,docx,txt
```

### Production

```env
# Document Q&A API (.env)
GROQ_API_KEY=gsk_your_prod_key
PORT=3001
MAX_FILE_SIZE=52428800  # 50MB
ALLOWED_FILE_TYPES=pdf,docx,txt,doc,rtf

# Optional: Add these for production
NODE_ENV=production
LOG_LEVEL=info
REDIS_URL=redis://localhost:6379
S3_BUCKET=your-documents-bucket
```

---

## Testing the Integration

### 1. Unit Tests (Jest)

```javascript
// tests/documentQA.test.js
import { DocumentQAService } from '../src/services/documentQA';

describe('DocumentQA Service', () => {
  const service = new DocumentQAService();

  test('should upload document', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const docId = await service.uploadDocument(file);
    expect(docId).toBeTruthy();
  });

  test('should answer question', async () => {
    const { reply } = await service.askQuestion(
      'What is this about?',
      'test-session',
      ['doc-id']
    );
    expect(reply).toBeTruthy();
  });
});
```

### 2. Integration Tests (Postman/Newman)

```json
{
  "info": {
    "name": "Document Q&A API Tests"
  },
  "item": [
    {
      "name": "Upload Document",
      "request": {
        "method": "POST",
        "url": "http://localhost:3001/api/documents/upload",
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": "test.pdf"
            }
          ]
        }
      }
    },
    {
      "name": "Ask Question",
      "request": {
        "method": "POST",
        "url": "http://localhost:3001/api/agent/chat",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"message\": \"Summarize this\", \"sessionId\": \"test\", \"documentIds\": [\"{{docId}}\"]}"
        }
      }
    }
  ]
}
```

---

## Performance Considerations

### 1. File Upload Optimization

```javascript
// Compress large files before upload
import pako from 'pako';

async function uploadLargeDocument(file: File) {
  if (file.size > 5 * 1024 * 1024) { // > 5MB
    // Show progress
    const formData = new FormData();
    formData.append('file', file);
    
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      const percent = (e.loaded / e.total) * 100;
      console.log(`Upload: ${percent}%`);
    });
    
    // Upload with progress tracking
  }
}
```

### 2. Response Caching

```javascript
// Cache frequent queries
const cache = new Map();

async function cachedQuery(query: string, documentIds: string[]) {
  const key = `${query}-${documentIds.join(',')}`;
  
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = await fetch(/* ... */);
  cache.set(key, result);
  
  // Expire after 5 minutes
  setTimeout(() => cache.delete(key), 5 * 60 * 1000);
  
  return result;
}
```

### 3. Streaming Responses (Future Enhancement)

For very long responses, consider implementing streaming:

```javascript
// Server-side (future enhancement)
app.post('/api/agent/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Stream chunks as they're generated
  for await (const chunk of generateResponse()) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  
  res.end();
});
```

---

## Security Checklist

- [ ] API key stored in environment variables (not in code)
- [ ] CORS configured to allow only your domain
- [ ] File upload size limits enforced
- [ ] File type validation on both client and server
- [ ] User authentication before document access
- [ ] Document access control (users can only access their own docs)
- [ ] Rate limiting on API endpoints
- [ ] Input sanitization for user messages
- [ ] HTTPS in production
- [ ] Regular security updates for dependencies

---

## Monitoring and Logging

### Add Request Logging

```javascript
// your-backend/middleware/logging.js
export function logDocumentQARequests(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
      documentIds: req.body?.documentIds
    });
  });
  
  next();
}
```

### Track Usage Metrics

```javascript
// Track document uploads
await analytics.track('document_uploaded', {
  userId: req.user.id,
  fileType: req.file.mimetype,
  fileSize: req.file.size
});

// Track questions asked
await analytics.track('question_asked', {
  userId: req.user.id,
  documentCount: documentIds.length,
  responseTime: duration
});
```

---

## Support and Maintenance

### Common Issues

1. **"Connection refused"**: Ensure Document Q&A API is running on port 3001
2. **"Groq API error"**: Check API key is valid and has credits
3. **"File too large"**: Increase `MAX_FILE_SIZE` in `.env`
4. **"Parse error"**: Some PDFs are scanned images and need OCR

### Getting Help

1. Check server logs: `tail -f document-qa-api/*.log`
2. Test endpoints directly with cURL
3. Review the [README.md](./README.md) troubleshooting section
4. Contact the development team

---

## Next Steps

1. **Start with Option 1** (Direct Frontend Integration) for quick testing
2. **Move to Option 2** (Backend Proxy) for production
3. **Add authentication** to secure document access
4. **Implement caching** for better performance
5. **Monitor usage** and optimize as needed
6. **Consider upgrading** vector store for production scale

Good luck with your integration! 🚀

