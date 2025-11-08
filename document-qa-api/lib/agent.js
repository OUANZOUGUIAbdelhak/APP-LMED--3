import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { getToolHandlers, getToolSpecs } from './tools/index.js';

// Initialize LLM clients
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const bytedance = process.env.BYTEDANCE_API_KEY ? new OpenAI({
  apiKey: process.env.BYTEDANCE_API_KEY,
  baseURL: process.env.BYTEDANCE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
}) : null;

/**
 * Build system prompt for the agent
 */
function buildSystemPrompt(retrieved, activeDocument) {
  if (retrieved.length > 0) {
    const sources = retrieved.map((r, i) => 
      `[${i + 1}] ${r.docId} (chunk ${r.metadata?.chunk || 'unknown'})\n${r.content}`
    ).join('\n\n');

    return `You are a helpful AI assistant specialized in answering questions about documents.

ACTIVE DOCUMENT: ${activeDocument || 'Unknown'}

You have been provided with relevant excerpts from the document below. Use ONLY these sources to answer the user's question. Do not use any external knowledge or make assumptions beyond what is explicitly stated in the sources.

When answering:
1. Cite your sources using the format [Source N] where N is the source number
2. If the answer is not in the provided sources, say "I don't have enough information in the provided document to answer that question."
3. Be precise and quote directly from the sources when possible
4. Do NOT use tools like extract_document or list_dir - all necessary information is already provided below

SOURCES:
${sources}

Answer the user's question based solely on the above sources.`;
  }

  return `You are a helpful AI assistant. You can answer general questions and help users understand documents when they are provided.

You have access to tools to read files, list directories, search file contents, and extract document text. Use these tools when the user asks about specific documents or files.

When working with documents:
1. Use the available tools to access file contents
2. Provide accurate answers with specific references (file names, line numbers, sections)
3. If you need to read a file, use the read_file tool
4. If you need to search for content, use the grep_files tool
5. If you need to extract text from a document, use the extract_document tool

Be helpful, accurate, and cite your sources.`;
}

/**
 * Get LLM client and model based on provider
 */
function getLLMConfig(provider) {
  switch (provider) {
    case 'groq':
      return {
        client: groq,
        model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile'
      };
    case 'bytedance':
      return {
        client: bytedance,
        model: process.env.BYTEDANCE_MODEL || 'ep-20241106174816-xxxxxx' // User should set their endpoint ID
      };
    case 'openai':
      return {
        client: openai,
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
      };
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Run the agent loop with tool calling
 */
export async function runAgentLoop({ userMessage, history, retrieved, uploadsDir, activeDocument, llmProvider = 'groq' }) {
  const systemPrompt = buildSystemPrompt(retrieved, activeDocument);
  
  // Build messages
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ];

  // Get tool handlers and specs
  const toolHandlers = getToolHandlers(uploadsDir);
  const toolSpecs = getToolSpecs();

  // Get LLM configuration
  const { client, model } = getLLMConfig(llmProvider);
  
  if (!client) {
    throw new Error(`LLM client not initialized for provider: ${llmProvider}. Check API key configuration.`);
  }

  let currentMessages = messages;
  let iterationCount = 0;
  const maxIterations = 10;

  while (iterationCount < maxIterations) {
    iterationCount++;

    try {
      // Call LLM with or without tools based on RAG results
      const completion = await client.chat.completions.create({
        model,
        messages: currentMessages,
        tools: retrieved.length > 0 ? undefined : toolSpecs,
        tool_choice: retrieved.length > 0 ? undefined : 'auto',
        temperature: 0.7,
        max_tokens: 2048
      });

      const assistantMessage = completion.choices[0].message;

      // If no tool calls, return the response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return {
          reply: assistantMessage.content,
          sources: retrieved.map(r => ({
            docId: r.docId,
            content: r.content,
            metadata: r.metadata
          }))
        };
      }

      // Execute tool calls
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[Agent] Calling tool: ${toolName}`, toolArgs);

        const handler = toolHandlers[toolName];
        if (!handler) {
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Unknown tool: ${toolName}` })
          });
          continue;
        }

        try {
          const result = await handler(toolArgs);
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        } catch (error) {
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message })
          });
        }
      }

    } catch (error) {
      console.error(`[Agent] ${llmProvider.toUpperCase()} API error:`, error);
      throw new Error(`Agent failed: ${error.message}`);
    }
  }

  return {
    reply: 'I apologize, but I reached the maximum number of iterations while processing your request. Please try rephrasing your question.',
    sources: []
  };
}

