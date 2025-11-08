# Quick Start Guide

Get the Document Q&A API running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- LLM API key ([Get one here](https://console.groq.com))

## Setup Steps

### 1. Install Dependencies

```bash
cd document-qa-api
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
# Copy the example
cp env.example .env

# Edit .env and add your LLM API key
# GROQ_API_KEY=gsk_your_actual_key_here
```

Or create `.env` manually:

```env
GROQ_API_KEY=gsk_your_actual_key_here
PORT=3001
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,docx,txt
```

### 3. Start the Server

```bash
npm start
```

You should see:

```
🚀 Document Q&A API running on http://localhost:3001
📁 Upload directory: /path/to/document-qa-api/data/uploads
🔑 Groq API configured: true
```

## Test the API

### 1. Health Check

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "groqConfigured": true,
  "timestamp": "2025-11-06T10:30:00.000Z"
}
```

### 2. Upload a Document

```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@/path/to/your/document.pdf"
```

Expected response:
```json
{
  "docId": "1730890800000-document.pdf",
  "filename": "1730890800000-document.pdf",
  "originalName": "document.pdf",
  "segments": 15
}
```

**Save the `docId` for the next step!**

### 3. Ask a Question

```bash
curl -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is this document about?",
    "sessionId": "test-session",
    "documentIds": ["1730890800000-document.pdf"]
  }'
```

Expected response:
```json
{
  "reply": "This document discusses...",
  "sources": [
    {
      "docId": "1730890800000-document.pdf",
      "content": "...",
      "metadata": { "chunk": 1, "source": "pdf" }
    }
  ],
  "sessionId": "test-session"
}
```

## Integration Examples

### JavaScript/TypeScript

```typescript
// Upload document
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const uploadRes = await fetch('http://localhost:3001/api/documents/upload', {
  method: 'POST',
  body: formData
});
const { docId } = await uploadRes.json();

// Ask question
const chatRes = await fetch('http://localhost:3001/api/agent/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Summarize this document',
    sessionId: 'user-123',
    documentIds: [docId]
  })
});
const { reply, sources } = await chatRes.json();
console.log(reply);
```

### Python

```python
import requests

# Upload document
with open('document.pdf', 'rb') as f:
    upload_res = requests.post(
        'http://localhost:3001/api/documents/upload',
        files={'file': f}
    )
doc_id = upload_res.json()['docId']

# Ask question
chat_res = requests.post(
    'http://localhost:3001/api/agent/chat',
    json={
        'message': 'Summarize this document',
        'sessionId': 'user-123',
        'documentIds': [doc_id]
    }
)
print(chat_res.json()['reply'])
```

### cURL (Bash Script)

```bash
#!/bin/bash

# Upload document
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3001/api/documents/upload \
  -F "file=@document.pdf")

DOC_ID=$(echo $UPLOAD_RESPONSE | jq -r '.docId')
echo "Uploaded document: $DOC_ID"

# Ask question
CHAT_RESPONSE=$(curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Summarize this document\",
    \"sessionId\": \"test\",
    \"documentIds\": [\"$DOC_ID\"]
  }")

echo "Answer:"
echo $CHAT_RESPONSE | jq -r '.reply'
```

## Common Issues

### "Groq API configured: false"

**Problem**: Missing or invalid LLM API key

**Solution**: 
1. Check `.env` file exists
2. Verify `GROQ_API_KEY` is set correctly
3. Restart the server after updating `.env`

### "Failed to parse PDF"

**Problem**: PDF is scanned (image-based) or corrupted

**Solution**:
1. Try a different PDF
2. For scanned PDFs, you'll need OCR (not included)
3. Check file size is under limit (10MB default)

### "Access denied: path outside workspace"

**Problem**: Trying to access files outside uploads directory

**Solution**: This is a security feature. Only uploaded documents are accessible.

## Next Steps

1. Read the full [README.md](./README.md) for detailed API documentation
2. Integrate into your application (see Integration Guide in README)
3. For production, consider:
   - Using a proper vector database (Pinecone, Weaviate)
   - Adding authentication (JWT)
   - Implementing rate limiting
   - Using cloud storage (S3)

## Support

For issues or questions:
1. Check the [README.md](./README.md) troubleshooting section
2. Review server logs for error details
3. Contact your technical lead or team lead

