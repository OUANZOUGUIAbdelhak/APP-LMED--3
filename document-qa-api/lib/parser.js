import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Parse PDF document into text segments
 */
export async function parsePdf(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    
    console.log(`[Parser] PDF text length: ${data.text.length}`);
    
    if (!data.text || data.text.trim().length === 0) {
      console.warn('[Parser] PDF appears to be empty or scanned');
      return [{
        content: '[This PDF appears to be empty or contains only scanned images. Text extraction failed.]',
        metadata: { page: 1, type: 'error' }
      }];
    }

    // Split into chunks by page or paragraph
    const pages = data.text.split(/\n\n+/);
    return pages
      .filter(p => p.trim().length > 0)
      .map((content, idx) => ({
        content: content.trim(),
        metadata: { chunk: idx + 1, source: 'pdf' }
      }));
  } catch (error) {
    console.error('[Parser] PDF error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Parse DOCX document into text segments
 */
export async function parseDocx(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    
    if (!result.value || result.value.trim().length === 0) {
      return [{
        content: '[This DOCX file appears to be empty.]',
        metadata: { type: 'error' }
      }];
    }

    // Split into paragraphs
    const paragraphs = result.value.split(/\n\n+/);
    return paragraphs
      .filter(p => p.trim().length > 0)
      .map((content, idx) => ({
        content: content.trim(),
        metadata: { chunk: idx + 1, source: 'docx' }
      }));
  } catch (error) {
    console.error('[Parser] DOCX error:', error);
    throw new Error(`Failed to parse DOCX: ${error.message}`);
  }
}

/**
 * Parse TXT document into text segments
 */
export async function parseTxt(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    if (!content || content.trim().length === 0) {
      return [{
        content: '[This text file is empty.]',
        metadata: { type: 'error' }
      }];
    }

    // Split into paragraphs or lines
    const chunks = content.split(/\n\n+/);
    return chunks
      .filter(c => c.trim().length > 0)
      .map((content, idx) => ({
        content: content.trim(),
        metadata: { chunk: idx + 1, source: 'txt' }
      }));
  } catch (error) {
    console.error('[Parser] TXT error:', error);
    throw new Error(`Failed to parse TXT: ${error.message}`);
  }
}

