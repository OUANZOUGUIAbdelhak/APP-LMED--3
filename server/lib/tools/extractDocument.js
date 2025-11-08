import path from 'path';
import { parseUploadedFile } from '../parser.js';

/**
 * Extract full text from a document (PDF, DOCX, TXT)
 * @param {string} filename - Filename in the uploads directory
 * @param {string} uploadsDir - Absolute path to uploads directory
 * @returns {Promise<string>}
 */
export async function extractDocument({ filename }, { uploadsDir }) {
  if (!filename) {
    throw new Error('filename is required');
  }

  // Security: prevent path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(uploadsDir, safeName);

  try {
    const parsed = await parseUploadedFile(filePath, safeName);
    const fullText = parsed.segments.map(seg => seg.text).join('\n\n');
    
    if (!fullText || fullText.trim().length === 0) {
      return `Document "${safeName}" appears to be empty or could not be parsed.`;
    }

    return `Document: ${safeName}\n\n${fullText}`;
  } catch (err) {
    throw new Error(`Failed to extract document: ${err.message}`);
  }
}

export const extractDocumentToolSpec = {
  type: 'function',
  function: {
    name: 'extract_document',
    description: 'Extract and read the full text content of an uploaded document (PDF, DOCX, TXT, etc.). Use this to understand what a document contains.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the document in the uploads directory (e.g., "report.pdf").'
        }
      },
      required: ['filename']
    }
  }
};

