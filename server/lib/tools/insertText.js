import fs from 'fs';
import path from 'path';

/**
 * Insert text into a file at a specific line position
 * @param {object} args - { filename: string, text: string, line: number, column?: number }
 * @param {object} context - { uploadsDir: string }
 * @returns {Promise<string>}
 */
export async function insertText({ filename, text, line, column = 1 }, { uploadsDir }) {
  if (!filename) {
    throw new Error('filename is required');
  }
  if (text === undefined || text === null) {
    throw new Error('text is required');
  }
  if (typeof line !== 'number' || line < 1) {
    throw new Error('line must be a positive number');
  }

  // Security: prevent path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(uploadsDir, safeName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${safeName}`);
  }

  try {
    // Read current content
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    // Validate line number
    if (line > lines.length + 1) {
      throw new Error(`Line ${line} is beyond the end of the file (file has ${lines.length} lines)`);
    }

    // Insert text
    const insertLine = line - 1; // Convert to 0-based index
    const insertColumn = Math.max(0, column - 1); // Convert to 0-based index

    if (insertLine === lines.length) {
      // Append at end of file
      lines.push(text);
    } else if (insertColumn === 0) {
      // Insert as new line before the specified line
      lines.splice(insertLine, 0, text);
    } else {
      // Insert at specific column in existing line
      const currentLine = lines[insertLine];
      const before = currentLine.slice(0, insertColumn);
      const after = currentLine.slice(insertColumn);
      lines[insertLine] = before + text + after;
    }

    // Write back
    const newContent = lines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');

    return `Successfully inserted text into ${safeName} at line ${line}, column ${column}.`;
  } catch (err) {
    throw new Error(`Failed to insert text: ${err.message}`);
  }
}

export const insertTextToolSpec = {
  type: 'function',
  function: {
    name: 'insert_text',
    description: 'Insert text into a file at a specific line and column position. Use this when the user approves a suggestion OR when automatically populating a newly created LaTeX file with content. Always read the file first using read_file to find the exact line numbers before inserting.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename in the uploads directory (e.g., "document.tex")',
        },
        text: {
          type: 'string',
          description: 'The text to insert',
        },
        line: {
          type: 'number',
          description: 'Line number where to insert (1-based)',
        },
        column: {
          type: 'number',
          description: 'Column number where to insert (1-based, optional, defaults to 1)',
        },
      },
      required: ['filename', 'text', 'line'],
    },
  },
};

