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
export async function runAgentLoop({ message, history = [], retrieved = [], apiKey, model, uploadsDir, activeDocument, hasRelevantDocs = true, mentionedDocuments, vectorStore }) {
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
  
  // Detect article creation requests
  const articleCreationPatterns = [
    /create (an? )?(article|paper|document|latex|tex) (about|on|for)/i,
    /(I want|I need|can you) (to )?create (an? )?(article|paper|document|latex|tex)/i,
    /write (an? )?(article|paper|document) (about|on)/i,
    /generate (an? )?(article|paper|document|latex|tex) (about|on)/i,
    /make (an? )?(article|paper|document|latex|tex) (about|on)/i
  ];
  const isArticleCreation = articleCreationPatterns.some(pattern => pattern.test(message));
  
  // Enable tools if no RAG results OR if it's a meta-question (workspace listing) OR article creation
  const enableTools = retrieved.length === 0 || isMetaQuestion || isArticleCreation;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let completion;
    try {
      // Increase max_tokens and temperature for article creation to allow generating longer, more creative content
      const isArticleCreationRequest = articleCreationPatterns.some(pattern => pattern.test(message));
      const maxTokens = isArticleCreationRequest ? 4000 : 1200;
      const temperature = isArticleCreationRequest ? 0.7 : (hasRelevantDocs ? 0.2 : 0.5); // Higher temperature for creative article writing
      
      completion = await groq.chat.completions.create({
        model,
        temperature: temperature,
        max_tokens: maxTokens,
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
      // Extract created files from tool call log
      const createdFiles = toolCallLog
        .filter(tc => tc.createdFile)
        .map(tc => tc.createdFile);
      
      return {
        response: assistantMessage.content || '',
        toolCalls: toolCallLog,
        createdFiles: createdFiles.length > 0 ? createdFiles : undefined
      };
    }

    // Execute tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
      
      let toolOutput;
      try {
        toolOutput = await executeTool(toolName, toolArgs, { uploadsDir, vectorStore });
      } catch (err) {
        toolOutput = `Error: ${err.message}`;
      }
      
      // Extract file creation metadata if create_latex_file was called
      let createdFile = null;
      if (toolName === 'create_latex_file') {
        try {
          const parsed = JSON.parse(toolOutput);
          if (parsed.success && parsed.filename && parsed.docId) {
            createdFile = {
              filename: parsed.filename,
              docId: parsed.docId,
              topic: parsed.topic,
              title: parsed.title
            };
          }
        } catch (e) {
          // Not JSON, continue normally
        }
      }
      
      toolCallLog.push({ 
        name: toolName, 
        args: toolArgs,
        ...(createdFile && { createdFile })
      });

      // For create_latex_file, extract the message from JSON if it's structured
      let toolContent = toolOutput;
      if (toolName === 'create_latex_file') {
        try {
          const parsed = JSON.parse(toolOutput);
          if (parsed.message) {
            toolContent = parsed.message; // Use the human-readable message for the agent
          }
        } catch (e) {
          // Not JSON, use as-is
        }
      }
      
      currentMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: toolContent
      });
    }
  }

  // Max iterations reached
  // Extract created files from tool call log
  const createdFiles = toolCallLog
    .filter(tc => tc.createdFile)
    .map(tc => tc.createdFile);
  
  return {
    response: 'Agent reached maximum iterations without completing the task.',
    toolCalls: toolCallLog,
    createdFiles: createdFiles.length > 0 ? createdFiles : undefined
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
- insert_text: Insert text into a file at a specific line/column position (use when user approves a suggestion)
- create_latex_file: Create a new LaTeX (.tex) file with article content about a specified topic`;

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
- Use insert_text tool when the user explicitly approves a suggestion OR when automatically populating a newly created LaTeX file with content
- **Creating LaTeX Articles**: When the user asks to create an article, paper, or document about a topic (e.g., "create an article about machine learning", "I want to write a paper on quantum computing"), you MUST:
  1. First, call create_latex_file with the topic to create the file structure
  2. Read the created file using read_file to see the exact structure and line numbers
  3. Then AUTOMATICALLY generate meaningful, detailed content about the topic
  4. Use insert_text tool MULTIPLE TIMES to insert the generated content into the appropriate sections:
     - Find the line with "\\begin{abstract}" and insert abstract content on the next line
     - Find "\\section{Introduction}" and insert introduction content after it
     - Find "\\section{Background and Fundamentals}" and insert background content after it
     - Find "\\section{Key Concepts and Principles}" and insert key concepts content after it
     - Find "\\section{Applications and Use Cases}" and insert applications content after it
     - Find "\\section{Current Developments and Future Directions}" and insert developments content after it
     - Find "\\section{Conclusion}" and insert conclusion content after it
  5. Generate comprehensive, well-written content (2-4 paragraphs per section) that is informative and relevant to the topic
  6. Use proper LaTeX formatting (\\paragraph{}, \\textbf{}, \\textit{}, \\emph{}, etc.) where appropriate
  7. DO NOT ask for permission - automatically insert all the content after creating the file
  8. The user expects a complete article with actual content, not just a template with placeholders
  9. After inserting all content, read the file again to verify everything was inserted correctly

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

