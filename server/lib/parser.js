import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import mime from 'mime-types';
import XLSX from 'xlsx';

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

async function parseXlsx(filePath, originalName) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileStats = fs.statSync(filePath);
    console.log(`Reading XLSX file: ${filePath}, size: ${fileStats.size} bytes`);

    const workbook = XLSX.readFile(filePath, { 
      cellDates: false,
      cellNF: false,
      cellStyles: false,
      sheetStubs: true
    });

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Workbook appears to be empty or invalid');
    }

    const allSegments = [];
    const sheetTexts = [];

    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      try {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          console.warn(`Sheet "${sheetName}" is empty or missing`);
          return;
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '',
          raw: false
        });

        const sheetLines = [`=== Sheet: ${sheetName} ===`];

        const rows = Array.isArray(jsonData) ? jsonData : [];
        rows.forEach((row, rowIndex) => {
          if (Array.isArray(row) && row.length > 0) {
            const rowText = row
              .map((cell, colIndex) => {
                try {
                  const colLetter = XLSX.utils.encode_col(colIndex);
                  const value =
                    cell === null || cell === undefined
                      ? ''
                      : typeof cell === 'object'
                      ? JSON.stringify(cell)
                      : String(cell);
                  return `${colLetter}${rowIndex + 1}: ${value}`;
                } catch (cellErr) {
                  console.warn(`Error processing cell ${colIndex} in row ${rowIndex}:`, cellErr);
                  return `${XLSX.utils.encode_col(colIndex)}${rowIndex + 1}: [error]`;
                }
              })
              .join(' | ');
            if (rowText.trim()) {
              sheetLines.push(rowText);
            }
          }
        });

        if (sheetLines.length > 1) {
          const sheetSegments = chunkLines(sheetLines, 800, 2).map(seg => ({
            ...seg,
            page: null,
            sheet: sheetName,
            sheetIndex,
            filename: originalName,
          }));

          allSegments.push(...sheetSegments);
          sheetTexts.push(sheetLines.join('\n'));
        }
      } catch (sheetErr) {
        console.error(`Error processing sheet "${sheetName}":`, sheetErr);
        // Continue with other sheets
      }
    });

    if (allSegments.length === 0) {
      throw new Error('No extractable content found in spreadsheet');
    }

    const fullText = sheetTexts.join('\n\n');
    console.log(`XLSX parsed: ${originalName}, sheets: ${workbook.SheetNames.length}, segments: ${allSegments.length}, text length: ${fullText.length}`);

    return { text: fullText, segments: allSegments };
  } catch (err) {
    console.error(`XLSX parsing error for ${originalName}:`, err);
    console.error('Error stack:', err.stack);
    throw new Error(`Failed to parse XLSX: ${err.message}`);
  }
}

export async function parseUploadedFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const mimeType = mime.lookup(originalName) || '';
  if (ext === '.pdf' || mimeType === 'application/pdf') return parsePdf(filePath, originalName);
  if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return parseDocx(filePath, originalName);
  if (ext === '.xlsx' || ext === '.xls' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') return parseXlsx(filePath, originalName);
  return parseTxt(filePath, originalName);
}

export async function parseTextDirect(content, originalName = 'inline.txt') {
  const lines = splitIntoLines(content || '');
  const segments = chunkLines(lines).map(seg => ({ ...seg, page: null, filename: originalName }));
  return { text: content, segments };
}


