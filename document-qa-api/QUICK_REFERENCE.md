# Quick Reference Card

## 🚀 5-Minute Setup

```bash
# 1. Install
cd document-qa-api && npm install

# 2. Configure (choose one)
cp env.example .env

# For Groq (default, free)
echo "LLM_PROVIDER=groq" >> .env
echo "GROQ_API_KEY=gsk_your_key" >> .env

# For ByteDance (Chinese content)
echo "LLM_PROVIDER=bytedance" >> .env
echo "BYTEDANCE_API_KEY=your_key" >> .env
echo "BYTEDANCE_MODEL=ep-your_endpoint" >> .env

# For OpenAI (highest quality)
echo "LLM_PROVIDER=openai" >> .env
echo "OPENAI_API_KEY=sk-your_key" >> .env

# 3. Start
npm start

# 4. Test
curl http://localhost:3001/api/health
```

---

## 📖 Documentation Index

| File | Purpose | Read Time |
|------|---------|-----------|
| `README.md` | Complete API reference | 15 min |
| `QUICK_START.md` | Setup guide | 5 min |
| `LLM_PROVIDERS.md` | Provider setup | 10 min |
| `TECHNICAL_OVERVIEW.md` | Technical summary | 20 min |
| `INTEGRATION_GUIDE.md` | Integration examples | 30 min |
| `ARCHITECTURE.md` | System architecture | 25 min |
| `INTEGRATION_CHECKLIST.md` | Step-by-step tasks | 10 min |
| `PACKAGE_CONTENTS.md` | File descriptions | 10 min |

---

## 🔌 API Endpoints

```bash
# Health check
GET /api/health

# Upload document
POST /api/documents/upload
Content-Type: multipart/form-data
Body: file=@document.pdf

# Ask question
POST /api/agent/chat
Content-Type: application/json
Body: {"message": "...", "documentIds": ["..."]}

# Semantic search
POST /api/rag/query
Content-Type: application/json
Body: {"query": "...", "documentIds": ["..."]}

# Reset session
POST /api/session/reset
Content-Type: application/json
Body: {"sessionId": "..."}

# List documents
GET /api/documents

# Delete document
DELETE /api/documents/:docId
```

---

## 🤖 LLM Providers

### Groq (Default)
```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-70b-versatile
```
**Get key**: https://console.groq.com  
**Best for**: Development, fast responses  
**Cost**: Free tier (14,400 req/day)

### ByteDance
```env
LLM_PROVIDER=bytedance
BYTEDANCE_API_KEY=...
BYTEDANCE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
BYTEDANCE_MODEL=ep-20241106174816-xxxxx
```
**Get key**: https://console.volcengine.com/ark  
**Best for**: Chinese content, China region  
**Cost**: Varies by model

### OpenAI
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```
**Get key**: https://platform.openai.com/api-keys  
**Best for**: Highest quality, production  
**Cost**: $0.01-0.03 per 1K tokens

---

## 🧪 Testing

```bash
# Automated tests
./test-api.sh          # Linux/Mac
.\test-api.ps1         # Windows

# Manual test
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@test.pdf"

curl -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Summarize this", "documentIds": ["DOC_ID"]}'
```

---

## 🔧 Common Issues

### "LLM client not initialized"
**Fix**: Check API key in `.env`, restart server

### "Unsupported LLM_PROVIDER"
**Fix**: Use `groq`, `bytedance`, or `openai`

### ByteDance: "Invalid endpoint"
**Fix**: Check endpoint ID format: `ep-YYYYMMDDHHMMSS-xxxxx`

### "Failed to parse PDF"
**Fix**: PDF might be scanned (needs OCR) or corrupted

---

## 📊 File Structure

```
document-qa-api/
├── index.js              # Main server
├── package.json          # Dependencies
├── env.example           # Config template
├── lib/
│   ├── agent.js          # LLM agent
│   ├── vectorStore.js    # RAG search
│   ├── memory.js         # Chat history
│   ├── parser.js         # Doc parsing
│   └── tools/            # 5 tools
├── *.md                  # 8 docs
└── test-api.*            # 2 test scripts
```

---

## 💡 Quick Tips

### Switch Providers
Just change `.env` and restart:
```bash
LLM_PROVIDER=bytedance
npm start
```

### Adjust Response Length
Edit `lib/agent.js`:
```javascript
max_tokens: 2048  // Change this
```

### Change Port
Edit `.env`:
```env
PORT=8080
```

### Increase File Size Limit
Edit `.env`:
```env
MAX_FILE_SIZE=52428800  # 50MB
```

---

## 🎯 Integration Checklist

- [ ] Install dependencies (`npm install`)
- [ ] Configure LLM provider (`.env`)
- [ ] Start server (`npm start`)
- [ ] Test health endpoint
- [ ] Upload test document
- [ ] Ask test question
- [ ] Implement frontend upload UI
- [ ] Implement chat interface
- [ ] Add authentication
- [ ] Deploy to production

---

## 📞 Support

**Documentation**: See `README.md` for full reference  
**LLM Setup**: See `LLM_PROVIDERS.md` for provider guides  
**Integration**: See `INTEGRATION_GUIDE.md` for examples  
**Architecture**: See `ARCHITECTURE.md` for technical details

---

## ✅ Success Criteria

- [x] Server starts without errors
- [x] Health check returns `"status": "ok"`
- [x] Can upload documents
- [x] Can ask questions
- [x] Responses include citations
- [x] Multi-turn conversations work

---

**Version**: 1.0.0  
**Updated**: November 6, 2025  
**Status**: Production Ready

