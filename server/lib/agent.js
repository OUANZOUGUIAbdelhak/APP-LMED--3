import Groq from 'groq-sdk';
import { toolSpecs, executeTool } from './tools/index.js';

/**
 * Run an agent loop with Groq function calling
 * @param {object} options
 * @param {string} options.message - User message
 * @param {Array} options.history - Chat history [{role,content}]
 * @param {Array} options.retrieved - RAG retrieved chunks
 * @param {string} options.apiKey - Groq API key
 * @param {string} options.model - Groq model
 * @param {string} options.uploadsDir - Workspace directory path
 * @param {string} options.activeDocument - Currently selected/attached document filename
 * @returns {Promise<{response: string, toolCalls: Array}>}
 */
export async function runAgentLoop({ message, history = [], retrieved = [], apiKey, model, uploadsDir, activeDocument }) {
  const groq = new Groq({ apiKey });

  const systemPrompt = buildSystemPrompt(retrieved, activeDocument);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: message }
  ];

  const toolCallLog = [];
  let currentMessages = [...messages];
  const maxIterations = 10;
  
  // Disable tools if RAG sources are already provided
  const enableTools = retrieved.length === 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 1200,
        messages: currentMessages,
        tools: enableTools && toolSpecs.length > 0 ? toolSpecs : undefined,
      });
    } catch (err) {
      console.error('Groq API error:', err.message);
      throw new Error(`Groq API call failed: ${err.message}`);
    }

    const choice = completion.choices?.[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    currentMessages.push(assistantMessage);

    // If no tool calls, we're done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        response: assistantMessage.content || '',
        toolCalls: toolCallLog
      };
    }

    // Execute tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
      
      toolCallLog.push({ name: toolName, args: toolArgs });
      
      let toolOutput;
      try {
        toolOutput = await executeTool(toolName, toolArgs, { uploadsDir });
      } catch (err) {
        toolOutput = `Error: ${err.message}`;
      }

      currentMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: toolOutput
      });
    }
  }

  // Max iterations reached
  return {
    response: 'Agent reached maximum iterations without completing the task.',
    toolCalls: toolCallLog
  };
}

function buildSystemPrompt(retrieved, activeDocument) {
  let baseInstructions = `You are a helpful AI assistant with access to a document workspace.

**Workspace**: All user documents are in a dedicated uploads directory. Use relative paths (e.g., "document.pdf", "folder/file.txt") when calling tools.

**Available Tools**:
- \`list_dir\`: List files/folders in workspace (use "." for root)
- \`extract_document\`: Extract full text from a document (PDF, DOCX, TXT)
- \`read_file\`: Read specific lines from a text file
- \`grep_files\`: Search for content across files`;

  if (activeDocument) {
    baseInstructions += `\n\n**IMPORTANT**: The user is currently viewing/asking about the document: "${activeDocument}"
When the user says "this document" or "the document", they are referring to "${activeDocument}".
Use \`extract_document\` with filename="${activeDocument}" to read its content.`;
  }

  baseInstructions += `\n\n**Workflow for "tell me about this document" questions**:
1. If a specific document is mentioned or active, use \`extract_document\` with that filename
2. Analyze and summarize the content with key points
3. Cite sources with filename and line/page references

**When citing sources**: Include filename and line/page references like [filename lines X-Y].`;

  if (retrieved.length === 0) {
    return baseInstructions;
  }

  const sourcesSection = retrieved
    .map((r, i) => {
      const cite = `${r.filename}${r.page ? ` p${r.page}` : ''} lines ${r.lineStart}-${r.lineEnd}`;
      return `SOURCE ${i + 1} [${cite}]:\n${r.text}`;
    })
    .join('\n\n');

  const documentName = retrieved[0]?.filename || activeDocument || 'the document';

  return `${baseInstructions}

**CRITICAL**: The user is asking about "${documentName}". The following sources are ALREADY extracted from this document.
DO NOT use \`extract_document\` or \`list_dir\` - the content is already provided below.
Answer ONLY using these sources and cite them appropriately.

**Retrieved Chunks from "${documentName}"**:
${sourcesSection}`;
}

