import { readFile, readFileToolSpec } from './readFile.js';
import { listDir, listDirToolSpec } from './listDir.js';
import { grepFiles, grepFilesToolSpec } from './grepFiles.js';
import { extractDocument, extractDocumentToolSpec } from './extractDocument.js';
import { insertText, insertTextToolSpec } from './insertText.js';
import { createLatexFile, createLatexFileToolSpec } from './createLatexFile.js';

export const toolHandlers = {
  read_file: readFile,
  list_dir: listDir,
  grep_files: grepFiles,
  extract_document: extractDocument,
  insert_text: insertText,
  create_latex_file: createLatexFile,
};

export const toolSpecs = [
  readFileToolSpec,
  listDirToolSpec,
  grepFilesToolSpec,
  extractDocumentToolSpec,
  insertTextToolSpec,
  createLatexFileToolSpec,
];

/**
 * Execute a tool call with workspace context
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments (parsed JSON)
 * @param {object} context - Tool context (uploadsDir, etc.)
 * @returns {Promise<string>} - Tool output
 */
export async function executeTool(name, args, context) {
  const handler = toolHandlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  try {
    const result = await handler(args, context);
    return result;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

