import fs from 'fs/promises';
import path from 'path';

const MAX_LINE_LENGTH = 500;

/**
 * Codex-style read_file tool (workspace-aware)
 * @param {string} file_path - Relative path within workspace or absolute path
 * @param {number} offset - 1-indexed line number to start from (default 1)
 * @param {number} limit - Max lines to return (default 2000)
 * @param {object} context - Tool context with uploadsDir
 * @returns {Promise<string>}
 */
export async function readFile({ file_path, offset = 1, limit = 2000 }, { uploadsDir }) {
  // If relative path, resolve within workspace
  let resolvedPath = file_path;
  if (!path.isAbsolute(file_path)) {
    resolvedPath = path.join(uploadsDir, file_path);
  }
  if (offset < 1) {
    throw new Error('offset must be a 1-indexed line number');
  }
  if (limit < 1) {
    throw new Error('limit must be greater than zero');
  }

  const content = await fs.readFile(resolvedPath, 'utf8');
  const lines = content.split(/\r?\n/);

  if (offset > lines.length) {
    throw new Error('offset exceeds file length');
  }

  const collected = [];
  const start = offset - 1;
  const end = Math.min(start + limit, lines.length);

  for (let i = start; i < end; i++) {
    const lineNum = i + 1;
    let line = lines[i];
    if (line.length > MAX_LINE_LENGTH) {
      line = line.slice(0, MAX_LINE_LENGTH);
    }
    collected.push(`L${lineNum}: ${line}`);
  }

  return collected.join('\n');
}

export const readFileToolSpec = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read a file from the workspace (uploaded documents directory). Returns lines with line numbers prefixed (L<num>:). Use offset and limit to paginate large files.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Relative path to the file within the workspace (e.g., "document.txt" or "subfolder/file.pdf").'
        },
        offset: {
          type: 'integer',
          description: '1-indexed line number to start reading from (default 1).',
          default: 1
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of lines to return (default 2000).',
          default: 2000
        }
      },
      required: ['file_path']
    }
  }
};

