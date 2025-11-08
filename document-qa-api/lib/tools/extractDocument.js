import path from 'path';
import { parsePdf, parseDocx, parseTxt } from '../parser.js';

/**
 * Extract full text from a document (workspace-aware)
 */
export async function extractDocument({ path: docPath }, uploadsDir) {
  try {
    const fullPath = path.resolve(uploadsDir, docPath);
    
    // Security check: ensure path is within uploads directory
    if (!fullPath.startsWith(uploadsDir)) {
      throw new Error('Access denied: path outside workspace');
    }

    const ext = path.extname(docPath).toLowerCase();
    let segments = [];

    if (ext === '.pdf') {
      segments = await parsePdf(fullPath);
    } else if (ext === '.docx') {
      segments = await parseDocx(fullPath);
    } else if (ext === '.txt') {
      segments = await parseTxt(fullPath);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    // Combine all segments into full text
    const fullText = segments.map(s => s.content).join('\n\n');

    return {
      path: docPath,
      text: fullText,
      segments: segments.length
    };
  } catch (error) {
    throw new Error(`Failed to extract document: ${error.message}`);
  }
}

