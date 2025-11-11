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
 * @param {boolean} options.hasRelevantDocs - Whether relevant docs were found
 * @param {Array<string>} options.mentionedDocuments - Documents mentioned by user (for cross-doc queries)
 * @returns {Promise<{response: string, toolCalls: Array}>}
 */
export async function runAgentLoop({ message, history = [], retrieved = [], apiKey, model, uploadsDir, activeDocument, hasRelevantDocs = true, mentionedDocuments }) {
  const groq = new Groq({ apiKey });

  const systemPrompt = buildSystemPrompt(message, retrieved, activeDocument, hasRelevantDocs, mentionedDocuments);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: message }
  ];

  const toolCallLog = [];
  let currentMessages = [...messages];
  const maxIterations = 10;
  
  // Detect meta-questions that need tools even if RAG found results
  const metaQuestionPatterns = [
    /what (files|documents|files and folders) (do I have|are in|are there)/i,
    /list (all )?(my )?(files|documents|files and folders)/i,
    /show me (all )?(my )?(files|documents|files and folders)/i,
    /what's in (my )?(workspace|folder|directory)/i,
    /(list|show|what) (all )?files/i
  ];
  const isMetaQuestion = metaQuestionPatterns.some(pattern => pattern.test(message));
  
  // Enable tools if no RAG results OR if it's a meta-question (workspace listing)
  const enableTools = retrieved.length === 0 || isMetaQuestion;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model,
        temperature: hasRelevantDocs ? 0.2 : 0.5, // Higher temperature for general knowledge
        max_tokens: 1200,
        messages: currentMessages,
        tools: enableTools && toolSpecs.length > 0 ? toolSpecs : undefined,
        tool_choice: enableTools && toolSpecs.length > 0 ? 'auto' : undefined,
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

function buildSystemPrompt(message, retrieved, activeDocument, hasRelevantDocs, mentionedDocuments) {
  let baseInstructions = `You are a helpful AI assistant with access to a document workspace.

**Workspace**: All user documents are in a dedicated uploads directory. Use relative paths (e.g., "document.pdf", "folder/file.txt") when calling tools.

**Available Tools**:
- list_dir: List files and folders in the workspace
- extract_document: Extract full text from a document (PDF, DOCX, TXT, XLSX, TEX)
- read_file: Read specific lines from a text file
- grep_files: Search for content across files
- insert_text: Insert text into a file at a specific line/column position (use when user approves a suggestion)`;

  if (activeDocument) {
    baseInstructions += `\n\n**IMPORTANT**: The user is currently viewing/asking about the document: "${activeDocument}"
When the user says "this document" or "the document" (without specifying a name), they are referring to "${activeDocument}".
However, if the user mentions OTHER documents by name (e.g., "document X", "the PDF file Y", "from document Z"), you MUST search for and read those documents using extract_document or grep_files tools.
DO NOT restrict yourself to only the active document when other documents are mentioned.`;
  }

  baseInstructions += `\n\n**Workflow for questions**:
1. If the user asks about what documents/files they have, use the list_dir tool to get the file listing
2. If a specific document is mentioned or active, use extract_document with that filename
3. If no document is specified and it's not a workspace listing question, use grep_files to search across all documents
4. For content questions, analyze and provide detailed answers with source citations
5. Always cite sources with filename and line/page references like [filename lines X-Y] (but NOT for workspace listing questions)

**LaTeX File Support**:
- When working with .tex files, understand LaTeX syntax, commands, environments, and structure
- For review requests (e.g., "Review my abstract"), read the relevant section and provide feedback on clarity, structure, grammar, and LaTeX formatting
- When proposing edits, provide corrected LaTeX code blocks that maintain proper syntax
- Use insert_text tool only when the user explicitly approves a suggestion (e.g., "yes, insert that" or "apply the changes")

**Cross-Document Reasoning**:
- When asked to synthesize information from multiple documents (e.g., "Based on document X and Y, what is the best conclusion?"), use extract_document or grep_files to read all referenced documents
- CRITICAL: Even if a LaTeX file is currently open, if the user mentions OTHER documents (by name, like "document X", "the PDF", "file Y"), you MUST search across ALL documents in the workspace to find and read those documents
- Use grep_files or extract_document to find documents mentioned by the user, even if they're not the currently active document
${mentionedDocuments && mentionedDocuments.length > 0 ? `- **IMPORTANT**: The user mentioned these documents: ${mentionedDocuments.join(', ')}. You MUST find and read these documents using list_dir to find the exact filename, then extract_document to read their content.` : ''}
- Analyze and synthesize information from multiple sources before providing answers
- When proposing text for insertion (like conclusions or summaries), clearly indicate which documents were used as sources
- Ask for confirmation before inserting synthesized text: "Would you like me to insert this text into your article?"
- Example: If user says "take the abstract from document X and put it in my LaTeX file", you must: 1) Use list_dir to see all files, 2) Find document X (may have timestamp prefix), 3) Read document X using extract_document with the exact filename, 4) Extract the abstract section, 5) Propose inserting it into the LaTeX file using proper LaTeX formatting

**Important**: If the user asks a question and no relevant information is found in the documents after searching, provide a helpful general answer based on your knowledge and clearly state that this information is not from the documents.`;

  // Detect meta-questions that need list_dir
  const metaQuestionPatterns = [
    /what (files|documents|files and folders) (do I have|are in|are there)/i,
    /list (all )?(my )?(files|documents|files and folders)/i,
    /show me (all )?(my )?(files|documents|files and folders)/i,
    /what's in (my )?(workspace|folder|directory)/i,
    /(list|show|what) (all )?files/i
  ];
  const isMetaQuestion = metaQuestionPatterns.some(pattern => pattern.test(message));
  
  if (isMetaQuestion && retrieved.length === 0) {
    return baseInstructions + `\n\n**CRITICAL INSTRUCTIONS FOR WORKSPACE LISTING**:
The user is asking "what documents do I have?" or similar. This is a request to LIST FILES, not to search document content.

YOU MUST:
1. Call the list_dir tool to get the file listing from the workspace
2. When you receive the file list, format it nicely by:
   - Removing timestamp prefixes from filenames (e.g., "1762428737786-Linging med.pdf" → "Linging med.pdf")
   - Presenting as a clean bulleted list
   - Grouping similar files together
3. Present the formatted list in a user-friendly way like:
   "Here are the documents in your workspace:
   
   • Linging med.pdf
   • Bonjour.docx
   • Bonjour.pdf
   • Option.pdf
   • TOEFL_SCCORE_OUANZOUGUI_ABDELHKA(1).pdf
   • glass_data (2).xlsx
   • welcome.md"
4. Do NOT mention tools, provide citations, or add "General Knowledge" messages

DO NOT:
- Explain that you're using a tool - just use it and present results
- Provide document references or sources for file listings
- Guess what files exist - use the tool output`;
  }

  if (retrieved.length === 0 && !hasRelevantDocs) {
    return baseInstructions + `\n\n**NOTE**: No relevant documents were found in the workspace for this query. You should answer the question using your general knowledge while being helpful and accurate. Clearly mention that the answer is not based on the workspace documents.`;
  }

  if (retrieved.length === 0) {
    return baseInstructions;
  }

  const sourcesSection = retrieved
    .map((r, i) => {
      const cite = `${r.filename}${r.page ? ` p${r.page}` : ''}${r.sheet ? ` sheet:${r.sheet}` : ''} lines ${r.lineStart}-${r.lineEnd}`;
      return `SOURCE ${i + 1} [${cite}]:\n${r.text}`;
    })
    .join('\n\n');

  const documentName = retrieved[0]?.filename || activeDocument || 'the document';
  const uniqueDocs = [...new Set(retrieved.map(r => r.filename))];

  return `${baseInstructions}

**CRITICAL**: The user is asking about content that may be in the workspace documents. The following sources have been retrieved from ${uniqueDocs.length} document(s) in the workspace.
DO NOT use \`extract_document\` or \`list_dir\` - the relevant content is already provided below.
Answer the question using ONLY these retrieved sources. If the answer can be found in these sources, use them and cite appropriately. If the answer is not in these sources, say so clearly.

**Retrieved Content from Workspace Documents**:
${sourcesSection}

**Instructions**: 
- If the user's question can be answered using the sources above, provide a detailed answer with citations
- Cite sources using format: [filename${retrieved[0]?.sheet ? ' sheet:SheetName' : ''} lines X-Y]
- If the answer is NOT in the provided sources, clearly state: "Based on the documents in your workspace, I could not find information about [topic]. [Provide general knowledge answer if helpful]."`;
}

