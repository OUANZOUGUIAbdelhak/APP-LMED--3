# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Application                        │
│                    (Your technical lead's App)                       │
│                                                                  │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │    Frontend      │              │     Backend      │        │
│  │   (React/Vue)    │◄────────────►│   (Node/Python)  │        │
│  └────────┬─────────┘              └────────┬─────────┘        │
│           │                                  │                  │
└───────────┼──────────────────────────────────┼──────────────────┘
            │                                  │
            │ HTTP/REST                        │ HTTP/REST
            │                                  │
┌───────────▼──────────────────────────────────▼──────────────────┐
│                   Document Q&A API (Port 3001)                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Express.js Server                       │ │
│  │                                                            │ │
│  │  Routes:                                                   │ │
│  │  • POST /api/documents/upload                             │ │
│  │  • POST /api/agent/chat                                   │ │
│  │  • POST /api/rag/query                                    │ │
│  │  • POST /api/session/reset                                │ │
│  │  • GET  /api/documents                                    │ │
│  │  • DELETE /api/documents/:id                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  VectorStore    │  │  MemoryStore    │  │  File Storage   │ │
│  │  (RAG Search)   │  │ (Chat History)  │  │  (Uploads)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     Groq Agent Loop                        │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  System Prompt + RAG Context + Chat History          │ │ │
│  │  └──────────────────┬───────────────────────────────────┘ │ │
│  │                     │                                      │ │
│  │  ┌──────────────────▼───────────────────────────────────┐ │ │
│  │  │         Groq LLM (Llama 3.1 70B)                     │ │ │
│  │  │         with Function Calling                        │ │ │
│  │  └──────────────────┬───────────────────────────────────┘ │ │
│  │                     │                                      │ │
│  │  ┌──────────────────▼───────────────────────────────────┐ │ │
│  │  │              Tool Handlers                           │ │ │
│  │  │  • read_file      (Read document contents)           │ │ │
│  │  │  • list_dir       (List uploaded files)              │ │ │
│  │  │  • grep_files     (Search within documents)          │ │ │
│  │  │  • extract_document (Extract full text)              │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              │
                    ┌─────────▼──────────┐
                    │   Groq Cloud API   │
                    │  (LLM Inference)   │
                    └────────────────────┘
```

---

## Data Flow: Document Upload

```
1. User selects file
   │
   ├─► Frontend: FormData with file
   │
   ├─► POST /api/documents/upload
   │
   ├─► Multer: Save to data/uploads/
   │       └─► Filename: {timestamp}-{original-name}
   │
   ├─► Parser: Extract text
   │       ├─► PDF: pdf-parse
   │       ├─► DOCX: mammoth
   │       └─► TXT: fs.readFile
   │
   ├─► Chunker: Split into segments
   │       └─► Split by paragraphs (double newlines)
   │
   ├─► Embedder: Generate vectors
   │       └─► TF-IDF based (replaceable)
   │
   ├─► VectorStore: Index document
   │       └─► Map: docId → {segments, embeddings}
   │
   └─► Response: {docId, filename, segments}
```

---

## Data Flow: Question Answering

```
1. User asks question
   │
   ├─► Frontend: JSON with message + documentIds
   │
   ├─► POST /api/agent/chat
   │
   ├─► MemoryStore: Retrieve chat history
   │       └─► Get last N messages for session
   │
   ├─► RAG Search (if documentIds provided)
   │       ├─► Embed query
   │       ├─► Search VectorStore
   │       └─► Return top 5 chunks
   │
   ├─► Build System Prompt
   │       ├─► If RAG results: "Use only these sources..."
   │       └─► If no RAG: "You have access to tools..."
   │
   ├─► Groq Agent Loop
   │       │
   │       ├─► Call Groq LLM
   │       │       ├─► Model: llama-3.1-70b-versatile
   │       │       ├─► Messages: [system, history, user]
   │       │       └─► Tools: [read_file, list_dir, grep, extract]
   │       │
   │       ├─► LLM Response
   │       │       ├─► Option A: Direct answer
   │       │       └─► Option B: Tool calls
   │       │
   │       ├─► If Tool Calls:
   │       │       ├─► Execute tool handler
   │       │       ├─► Add result to messages
   │       │       └─► Loop back to LLM
   │       │
   │       └─► Max 10 iterations
   │
   ├─► Extract Answer + Sources
   │       └─► Format: {reply, sources, sessionId}
   │
   ├─► MemoryStore: Save to history
   │       ├─► Add user message
   │       └─► Add assistant message
   │
   └─► Response: {reply, sources, sessionId}
```

---

## RAG (Retrieval-Augmented Generation) Process

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG Pipeline                             │
└─────────────────────────────────────────────────────────────┘

Step 1: Indexing (happens during upload)
┌──────────────┐
│  Document    │
│  "Machine    │
│  learning    │
│  is..."      │
└──────┬───────┘
       │
       ├─► Parse & Chunk
       │   ├─► Chunk 1: "Machine learning is a subset..."
       │   ├─► Chunk 2: "Neural networks consist of..."
       │   └─► Chunk 3: "Applications include NLP..."
       │
       ├─► Generate Embeddings
       │   ├─► Chunk 1 → [0.12, 0.45, 0.89, ...]  (384-dim vector)
       │   ├─► Chunk 2 → [0.34, 0.21, 0.67, ...]
       │   └─► Chunk 3 → [0.78, 0.91, 0.23, ...]
       │
       └─► Store in VectorStore
           └─► docId → {chunks, embeddings}

Step 2: Retrieval (happens during query)
┌──────────────┐
│  User Query  │
│  "What is    │
│  machine     │
│  learning?"  │
└──────┬───────┘
       │
       ├─► Generate Query Embedding
       │   └─► [0.15, 0.42, 0.88, ...]
       │
       ├─► Cosine Similarity Search
       │   ├─► Compare with all chunk embeddings
       │   ├─► Score 1: 0.92 (Chunk 1) ← High similarity
       │   ├─► Score 2: 0.67 (Chunk 2)
       │   └─► Score 3: 0.45 (Chunk 3)
       │
       ├─► Rank & Select Top K
       │   └─► Top 5 most similar chunks
       │
       └─► Return Results
           ├─► Chunk 1: "Machine learning is a subset..." (score: 0.92)
           ├─► Chunk 2: "Neural networks consist of..." (score: 0.67)
           └─► ...

Step 3: Generation (LLM answers using retrieved chunks)
┌──────────────────────────────────────────────────┐
│  System Prompt:                                  │
│  "Use ONLY these sources to answer:              │
│                                                  │
│  [1] Machine learning is a subset of AI...      │
│  [2] Neural networks consist of layers...       │
│                                                  │
│  User Question: What is machine learning?"      │
└──────────────────┬───────────────────────────────┘
                   │
                   ├─► Groq LLM
                   │
                   └─► Answer with Citations
                       "Machine learning is a subset of artificial
                        intelligence [Source 1]. It uses neural networks
                        which consist of layers [Source 2]."
```

---

## Tool Calling Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Tool Calling Example                           │
└─────────────────────────────────────────────────────────────┘

User: "What files are in the uploads folder?"

Step 1: LLM Decides to Use Tool
┌────────────────────────────────────┐
│  Groq LLM Response:                │
│  {                                 │
│    "tool_calls": [{                │
│      "id": "call_123",             │
│      "function": {                 │
│        "name": "list_dir",         │
│        "arguments": "{\"path\":\".\"}│
│      }                             │
│    }]                              │
│  }                                 │
└────────────────┬───────────────────┘
                 │
Step 2: Execute Tool
                 │
┌────────────────▼───────────────────┐
│  Tool Handler: list_dir            │
│  ├─► Resolve path: uploads/       │
│  ├─► Read directory                │
│  └─► Return:                       │
│      {                             │
│        "files": [                  │
│          "1730890800-doc1.pdf",    │
│          "1730890801-doc2.docx"    │
│        ],                          │
│        "directories": []           │
│      }                             │
└────────────────┬───────────────────┘
                 │
Step 3: Add Result to Conversation
                 │
┌────────────────▼───────────────────┐
│  Messages:                         │
│  [                                 │
│    {role: "user", content: "..."},│
│    {role: "assistant",             │
│     tool_calls: [...]},            │
│    {role: "tool",                  │
│     tool_call_id: "call_123",      │
│     content: "{\"files\":[...]}"}  │
│  ]                                 │
└────────────────┬───────────────────┘
                 │
Step 4: LLM Uses Result to Answer
                 │
┌────────────────▼───────────────────┐
│  Groq LLM Response:                │
│  "The uploads folder contains 2    │
│  documents: doc1.pdf and doc2.docx"│
└────────────────────────────────────┘
```

---

## Component Details

### 1. VectorStore

```javascript
class VectorStore {
  documents: Map<docId, {segments, embeddings}>
  
  async indexDocument(docId, segments) {
    // Generate embeddings for each segment
    embeddings = await Promise.all(
      segments.map(seg => this.generateEmbedding(seg.content))
    )
    
    // Store
    this.documents.set(docId, { segments, embeddings })
  }
  
  async search(query, topK, documentIds) {
    // Embed query
    queryEmbedding = await this.generateEmbedding(query)
    
    // Calculate similarity for all chunks
    results = []
    for (docId, {segments, embeddings}) in documents {
      if (documentIds && !documentIds.includes(docId)) continue
      
      for (i, embedding) in embeddings {
        score = cosineSimilarity(queryEmbedding, embedding)
        results.push({
          docId,
          content: segments[i].content,
          score,
          metadata: segments[i].metadata
        })
      }
    }
    
    // Sort by score and return top K
    return results.sort((a, b) => b.score - a.score).slice(0, topK)
  }
}
```

### 2. MemoryStore

```javascript
class MemoryStore {
  sessions: Map<sessionId, messages[]>
  
  get(sessionId) {
    return this.sessions.get(sessionId) || []
  }
  
  add(sessionId, message) {
    history = this.get(sessionId)
    history.push(message)
    
    // Keep only last 20 messages
    if (history.length > 20) {
      history.shift()
    }
    
    this.sessions.set(sessionId, history)
  }
  
  clear(sessionId) {
    this.sessions.delete(sessionId)
  }
}
```

### 3. Agent Loop

```javascript
async function runAgentLoop({userMessage, history, retrieved, uploadsDir}) {
  // Build system prompt
  systemPrompt = buildSystemPrompt(retrieved)
  
  // Initialize messages
  messages = [
    {role: 'system', content: systemPrompt},
    ...history,
    {role: 'user', content: userMessage}
  ]
  
  // Iteration loop
  for (i = 0; i < 10; i++) {
    // Call Groq
    response = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages,
      tools: retrieved.length > 0 ? undefined : toolSpecs
    })
    
    assistantMessage = response.choices[0].message
    
    // If no tool calls, return answer
    if (!assistantMessage.tool_calls) {
      return {
        reply: assistantMessage.content,
        sources: retrieved
      }
    }
    
    // Execute tool calls
    messages.push(assistantMessage)
    
    for (toolCall of assistantMessage.tool_calls) {
      result = await executeToolHandler(toolCall)
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      })
    }
    
    // Loop continues...
  }
  
  return {reply: "Max iterations reached", sources: []}
}
```

---

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
└─────────────────────────────────────────────────────────────┘

Layer 1: File Upload Validation
├─► File type check (PDF, DOCX, TXT only)
├─► File size limit (10MB default)
└─► Sanitize filename (remove special chars)

Layer 2: Workspace Sandboxing
├─► All file operations scoped to data/uploads/
├─► Path resolution with security check:
│   fullPath = resolve(uploadsDir, userPath)
│   if (!fullPath.startsWith(uploadsDir)) {
│     throw Error("Access denied")
│   }
└─► Prevents directory traversal attacks

Layer 3: Tool Execution
├─► Validate tool arguments
├─► Catch and sanitize errors
└─► Return structured JSON (no raw errors)

Layer 4: API Security (Your team should add)
├─► Authentication (JWT, OAuth)
├─► Authorization (user can only access their docs)
├─► Rate limiting (prevent abuse)
└─► HTTPS in production
```

---

## Scalability Considerations

### Current (Development)

```
┌──────────────────────────────────┐
│     Single Node.js Process       │
│                                  │
│  ┌────────────┐  ┌────────────┐ │
│  │ VectorStore│  │MemoryStore │ │
│  │ (In-Memory)│  │(In-Memory) │ │
│  └────────────┘  └────────────┘ │
│                                  │
│  ┌────────────────────────────┐ │
│  │   Local File Storage       │ │
│  │   (data/uploads/)          │ │
│  └────────────────────────────┘ │
└──────────────────────────────────┘

Limits:
• ~1,000 documents
• ~100 concurrent users
• Single point of failure
```

### Production (Recommended)

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                        │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
┌───────▼───┐ ┌──▼──────┐ ┌▼────────┐
│  Node 1   │ │ Node 2  │ │ Node 3  │
│  (API)    │ │ (API)   │ │ (API)   │
└─────┬─────┘ └────┬────┘ └────┬────┘
      │            │           │
      └────────────┼───────────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
│ Pinecone  │ │ Redis  │ │   S3     │
│ (Vectors) │ │(Memory)│ │ (Files)  │
└───────────┘ └────────┘ └──────────┘

Benefits:
• Unlimited documents
• 1,000+ concurrent users
• High availability
• Auto-scaling
```

---

## Performance Metrics

### Document Upload
- Small (< 1MB): ~1-2 seconds
- Medium (1-10MB): ~3-5 seconds
- Large (10-50MB): ~10-30 seconds

### Question Answering
- RAG search: ~100-200ms
- LLM inference: ~1-3 seconds
- Tool calling: +500ms per tool
- Total: ~2-5 seconds

### Optimization Tips
1. Cache frequent queries
2. Batch document uploads
3. Use streaming for large responses
4. Implement pagination for search results
5. Use CDN for static assets

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Technology Stack                     │
└─────────────────────────────────────────────────────────┘

Backend Framework
├─► Express.js (Node.js web framework)
└─► Middleware: cors, multer, dotenv

Document Processing
├─► pdf-parse (PDF text extraction)
├─► mammoth (DOCX to text)
└─► fs/promises (TXT reading)

AI/ML
├─► Groq SDK (LLM API client)
├─► Model: Llama 3.1 70B Versatile
└─► Custom TF-IDF embeddings (replaceable)

Storage
├─► In-memory Map (Vector store)
├─► In-memory Map (Chat memory)
└─► Local filesystem (File storage)

Development
├─► Node.js 18+
├─► ES Modules (import/export)
└─► Environment variables (.env)

Production Recommendations
├─► Pinecone/Weaviate (Vector DB)
├─► Redis (Chat memory)
├─► AWS S3 (File storage)
├─► OpenAI/Cohere (Embeddings)
└─► Docker (Containerization)
```

---

## Comparison with Alternatives

| Feature | This API | LangChain | LlamaIndex | Custom Build |
|---------|----------|-----------|------------|--------------|
| **Setup Time** | 5 minutes | 1-2 hours | 1-2 hours | 1-2 weeks |
| **Customization** | High | Medium | Medium | Very High |
| **Dependencies** | Minimal | Many | Many | Varies |
| **Learning Curve** | Low | High | High | Very High |
| **Production Ready** | Yes* | Yes | Yes | Depends |
| **Tool Calling** | ✅ | ✅ | ✅ | Manual |
| **RAG** | ✅ | ✅ | ✅ | Manual |
| **Codex Tools** | ✅ | ❌ | ❌ | Manual |
| **Documentation** | Excellent | Good | Good | None |

*With recommended upgrades for scale

---

## Future Enhancements

### Phase 1 (Immediate)
- [ ] Add authentication middleware
- [ ] Implement rate limiting
- [ ] Add request logging
- [ ] Set up monitoring

### Phase 2 (Short-term)
- [ ] Upgrade to Pinecone/Weaviate
- [ ] Use OpenAI embeddings
- [ ] Add Redis for memory
- [ ] Implement S3 storage

### Phase 3 (Long-term)
- [ ] Multi-language support
- [ ] OCR for scanned PDFs
- [ ] Streaming responses
- [ ] Batch processing
- [ ] Advanced analytics

---

This architecture provides a solid foundation for document Q&A while remaining flexible for future enhancements and scaling.

