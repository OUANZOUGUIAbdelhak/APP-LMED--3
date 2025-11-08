# LLM Provider Configuration Guide

This API supports multiple LLM providers. Choose the one that best fits your needs.

## Supported Providers

- **Groq** - Fast, cost-effective (default)
- **ByteDance** - Doubao/Volcano Engine models
- **OpenAI** - GPT-4 and GPT-3.5

---

## Configuration

### 1. Choose Your Provider

Edit `.env` and set `LLM_PROVIDER`:

```env
LLM_PROVIDER=groq        # or bytedance, or openai
```

### 2. Configure API Keys

Add the appropriate API key for your chosen provider:

---

## Provider Setup Guides

### Groq (Default)

**Get API Key**: [https://console.groq.com](https://console.groq.com)

**Configuration**:
```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.1-70b-versatile
```

**Available Models**:
- `llama-3.1-70b-versatile` (recommended)
- `llama-3.1-8b-instant`
- `mixtral-8x7b-32768`
- `gemma2-9b-it`

**Pricing**:
- Free tier: 14,400 requests/day
- Paid: $0.10 per 1M tokens

**Pros**:
- ✅ Very fast inference
- ✅ Generous free tier
- ✅ Good for development

---

### ByteDance (Doubao/Volcano Engine)

**Get API Key**: [https://console.volcengine.com/ark](https://console.volcengine.com/ark)

**Configuration**:
```env
LLM_PROVIDER=bytedance
BYTEDANCE_API_KEY=your_api_key_here
BYTEDANCE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
BYTEDANCE_MODEL=your_endpoint_id_here
```

**Setup Steps**:

1. **Create Account** at Volcano Engine Console
2. **Create Inference Endpoint**:
   - Go to "Model Inference" → "Inference Endpoints"
   - Click "Create Endpoint"
   - Choose your model (e.g., Doubao-pro-32k)
   - Note the **Endpoint ID** (format: `ep-20241106174816-xxxxx`)
3. **Get API Key**:
   - Go to "API Keys"
   - Create new API key
   - Copy the key
4. **Configure**:
   ```env
   BYTEDANCE_API_KEY=your_api_key_from_step_3
   BYTEDANCE_MODEL=ep-20241106174816-xxxxx  # from step 2
   ```

**Available Models** (via Volcano Engine):
- Doubao-pro-32k (recommended for Q&A)
- Doubao-lite-32k (faster, cheaper)
- Doubao-pro-128k (long context)

**Base URLs** (by region):
- China (Beijing): `https://ark.cn-beijing.volces.com/api/v3`
- International: Check Volcano Engine docs

**Pricing**:
- Varies by model
- Check Volcano Engine pricing page

**Pros**:
- ✅ Good Chinese language support
- ✅ Competitive pricing
- ✅ Low latency in China

---

### OpenAI

**Get API Key**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**Configuration**:
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your_key_here
OPENAI_MODEL=gpt-4-turbo-preview
```

**Available Models**:
- `gpt-4-turbo-preview` (recommended)
- `gpt-4`
- `gpt-3.5-turbo`

**Pricing**:
- GPT-4 Turbo: $0.01 per 1K input tokens, $0.03 per 1K output tokens
- GPT-3.5 Turbo: $0.0005 per 1K input tokens, $0.0015 per 1K output tokens

**Pros**:
- ✅ Highest quality responses
- ✅ Best reasoning capabilities
- ✅ Most reliable

---

## Testing Your Configuration

### 1. Start the Server

```bash
npm start
```

You should see:
```
🚀 Document Q&A API running on http://localhost:3001
🤖 LLM Provider: bytedance  # (or groq, or openai)
🔑 LLM API configured: true
```

### 2. Health Check

```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "ok",
  "llmProvider": "bytedance",
  "llmConfigured": true,
  "timestamp": "2025-11-06T..."
}
```

### 3. Test with a Question

```bash
# Upload a document first
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@test.pdf"

# Ask a question
curl -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is this document about?", "documentIds": ["DOC_ID"]}'
```

---

## Switching Providers

To switch providers, just update `.env`:

```env
# Before
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...

# After
LLM_PROVIDER=bytedance
BYTEDANCE_API_KEY=your_key
BYTEDANCE_MODEL=ep-...
```

Then restart the server:
```bash
npm start
```

---

## Troubleshooting

### "LLM client not initialized"

**Problem**: API key not configured

**Solution**:
1. Check `.env` file exists
2. Verify API key is set for your chosen provider
3. Restart the server

### "Unsupported LLM_PROVIDER"

**Problem**: Invalid provider name

**Solution**: Use one of: `groq`, `bytedance`, `openai`

### ByteDance: "Invalid endpoint"

**Problem**: Wrong endpoint ID or base URL

**Solution**:
1. Check endpoint ID format: `ep-YYYYMMDDHHMMSS-xxxxx`
2. Verify base URL matches your region
3. Ensure endpoint is active in Volcano Engine console

### OpenAI: "Incorrect API key"

**Problem**: Invalid or expired API key

**Solution**:
1. Generate new key at platform.openai.com
2. Check for extra spaces in `.env`
3. Verify account has credits

---

## Performance Comparison

| Provider | Speed | Cost | Quality | Chinese | Best For |
|----------|-------|------|---------|---------|----------|
| **Groq** | ⚡⚡⚡ | 💰 | ⭐⭐⭐ | ⭐⭐ | Development, Fast responses |
| **ByteDance** | ⚡⚡ | 💰💰 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Chinese content, China region |
| **OpenAI** | ⚡ | 💰💰💰 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Highest quality, Production |

---

## Recommendations

### For Development
**Use Groq**:
- Free tier is generous
- Very fast responses
- Good enough quality

### For Chinese Content
**Use ByteDance**:
- Best Chinese language understanding
- Low latency in China
- Competitive pricing

### For Production (International)
**Use OpenAI**:
- Highest quality responses
- Most reliable
- Best reasoning

### For Production (China)
**Use ByteDance**:
- Better performance in China
- Chinese language support
- Regulatory compliance

---

## Advanced Configuration

### Custom Model Parameters

You can customize model behavior by editing `lib/agent.js`:

```javascript
const completion = await client.chat.completions.create({
  model,
  messages: currentMessages,
  tools: retrieved.length > 0 ? undefined : toolSpecs,
  tool_choice: retrieved.length > 0 ? undefined : 'auto',
  temperature: 0.7,      // Lower = more deterministic (0.0-1.0)
  max_tokens: 2048,      // Maximum response length
  top_p: 0.9,            // Nucleus sampling (optional)
  frequency_penalty: 0,  // Reduce repetition (optional)
  presence_penalty: 0    // Encourage new topics (optional)
});
```

### Multiple Providers (Load Balancing)

For high availability, you can implement fallback logic:

```javascript
// In lib/agent.js
async function callLLMWithFallback(messages, tools) {
  const providers = ['bytedance', 'groq', 'openai'];
  
  for (const provider of providers) {
    try {
      const { client, model } = getLLMConfig(provider);
      if (!client) continue;
      
      return await client.chat.completions.create({
        model,
        messages,
        tools
      });
    } catch (error) {
      console.warn(`Provider ${provider} failed, trying next...`);
    }
  }
  
  throw new Error('All LLM providers failed');
}
```

---

## Cost Optimization

### 1. Use Appropriate Models

- Development: Groq (free tier)
- Production (high volume): ByteDance Doubao-lite
- Production (high quality): OpenAI GPT-4 Turbo

### 2. Optimize Token Usage

- Use smaller chunks in RAG (reduce context size)
- Limit chat history (default: 20 messages)
- Use lower `max_tokens` for shorter responses

### 3. Implement Caching

Cache frequent queries to avoid duplicate LLM calls:

```javascript
const cache = new Map();

function getCachedResponse(query, docIds) {
  const key = `${query}-${docIds.join(',')}`;
  if (cache.has(key)) {
    return cache.get(key);
  }
  // ... call LLM ...
  cache.set(key, response);
  return response;
}
```

---

## Support

For provider-specific issues:
- **Groq**: [https://console.groq.com/docs](https://console.groq.com/docs)
- **ByteDance**: [https://www.volcengine.com/docs/82379](https://www.volcengine.com/docs/82379)
- **OpenAI**: [https://platform.openai.com/docs](https://platform.openai.com/docs)

For API issues, check the logs and verify your configuration.

