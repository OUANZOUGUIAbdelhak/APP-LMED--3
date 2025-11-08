import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import mime from 'mime-types';

function splitIntoLines(text) {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

function chunkLines(lines, maxChars = 800, overlapLines = 2) {
  const chunks = [];
  let start = 0;
  while (start < lines.length) {
    let end = start;
    let len = 0;
    while (end < lines.length && (len + lines[end].length + 1) <= maxChars) {
      len += lines[end].length + 1;
      end += 1;
    }
    const text = lines.slice(start, end).join('\n').trim();
    if (text) {
      chunks.push({ text, lineStart: start + 1, lineEnd: end });
    }
    if (end === start) {
      end += 1; // ensure progress even if a single line is long
    }
    start = Math.max(end - overlapLines, end);
  }
  return chunks;
}

async function parsePdf(filePath, originalName) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const parsed = await pdf(dataBuffer);
    const text = (parsed.text || '').trim();
    
    console.log(`PDF parsed: ${originalName}, pages: ${parsed.numpages}, text length: ${text.length}`);
    
    if (!text || text.length === 0) {
      console.warn(`PDF ${originalName} has no extractable text (might be scanned/image PDF)`);
      return { 
        text: `[PDF file with ${parsed.numpages} pages - no extractable text. This may be a scanned document.]`, 
        segments: [{ 
          text: `This PDF has ${parsed.numpages} pages but no extractable text. It may be a scanned image or protected document.`,
          lineStart: 1,
          lineEnd: 1,
          page: null,
          filename: originalName
        }]
      };
    }
    
    const lines = splitIntoLines(text);
    const segments = chunkLines(lines).map(seg => ({ ...seg, page: null, filename: originalName }));
    return { text, segments };
  } catch (err) {
    console.error(`PDF parsing error for ${originalName}:`, err.message);
    throw new Error(`Failed to parse PDF: ${err.message}`);
  }
}

async function parseDocx(filePath, originalName) {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = (result.value || '').trim();
  const lines = splitIntoLines(text);
  const segments = chunkLines(lines).map(seg => ({ ...seg, page: null, filename: originalName }));
  return { text, segments };
}

async function parseTxt(filePath, originalName) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = splitIntoLines(text);
  const segments = chunkLines(lines).map(seg => ({ ...seg, page: null, filename: originalName }));
  return { text, segments };
}

export async function parseUploadedFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const mimeType = mime.lookup(originalName) || '';
  if (ext === '.pdf' || mimeType === 'application/pdf') return parsePdf(filePath, originalName);
  if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return parseDocx(filePath, originalName);
  return parseTxt(filePath, originalName);
}

export async function parseTextDirect(content, originalName = 'inline.txt') {
  const lines = splitIntoLines(content || '');
  const segments = chunkLines(lines).map(seg => ({ ...seg, page: null, filename: originalName }));
  return { text: content, segments };
}


