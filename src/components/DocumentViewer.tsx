import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { FileText, AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Save } from 'lucide-react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import * as XLSX from 'xlsx';
import Spreadsheet, { type CellBase, type Matrix } from 'react-spreadsheet';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { saveAs } from 'file-saver';

type SpreadsheetCell = CellBase<string>;
type SpreadsheetMatrix = Matrix<SpreadsheetCell>;

const DEFAULT_SHEET_NAME = 'Sheet1';

const isPlaceholderContent = (content?: string | null) => {
  if (!content) return true;
  const trimmed = content.trim();
  if (!trimmed) return true;
  return trimmed.startsWith('[Uploaded file:');
};

const createEmptyRow = (length: number): SpreadsheetCell[] =>
  Array.from({ length: Math.max(length, 1) }, () => ({ value: '' }));

const createEmptyMatrix = (rows = 1, cols = 1): SpreadsheetMatrix =>
  Array.from({ length: Math.max(rows, 1) }, () => createEmptyRow(cols));

const normalizeMatrix = (matrix: Matrix<CellBase<string>>): SpreadsheetMatrix => {
  const maxCols = matrix.reduce((max, row) => Math.max(max, row.length), 0) || 1;
  return matrix.map((row) => {
    const sanitized = row.map((cell) => ({ value: cell?.value ?? '' }));
    if (sanitized.length < maxCols) {
      return sanitized.concat(createEmptyRow(maxCols - sanitized.length));
    }
    return sanitized;
  });
};

const aoaToMatrix = (aoa: any[][]): SpreadsheetMatrix => {
  if (!Array.isArray(aoa) || aoa.length === 0) {
    return createEmptyMatrix();
  }

  return aoa.map((row: any[]) => {
    if (!Array.isArray(row) || row.length === 0) {
      return createEmptyRow(1);
    }
    return row.map((cell) => ({ value: cell === null || cell === undefined ? '' : String(cell) }));
  });
};

const matrixToAoa = (matrix: SpreadsheetMatrix): string[][] => {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return [['']];
  }
  const normalized = normalizeMatrix(matrix);
  return normalized.map(row => row.map(cell => (cell?.value ?? '')));
};

interface WorkbookSnapshot {
  sheets: Record<string, string[][]>;
  order: string[];
}

const parseWorkbookContent = (content: string): WorkbookSnapshot | null => {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return {
        sheets: { [DEFAULT_SHEET_NAME]: parsed },
        order: [DEFAULT_SHEET_NAME],
      };
    }
    if (parsed && typeof parsed === 'object' && parsed.sheets) {
      const sheets = parsed.sheets as Record<string, string[][]>;
      const order = Array.isArray(parsed.order) && parsed.order.length > 0
        ? parsed.order as string[]
        : Object.keys(sheets);
      return { sheets, order };
    }
  } catch (err) {
    console.warn('Failed to parse stored workbook content', err);
  }
  return null;
};

const buildSnapshotFromSheets = (source: Record<string, SpreadsheetMatrix>, order: string[]): WorkbookSnapshot => {
  const effectiveOrder = order.length ? order : [DEFAULT_SHEET_NAME];
  const snapshotSheets: Record<string, string[][]> = {};
  effectiveOrder.forEach((name) => {
    const matrix = source[name] ?? createEmptyMatrix(10, 5);
    snapshotSheets[name] = matrixToAoa(matrix);
  });
  return {
    order: effectiveOrder,
    sheets: snapshotSheets,
  };
};

const MarkdownEditor = ({ content, onChange }: { content: string; onChange: (value: string) => void }) => {
  const [value, setValue] = useState(content);

  useEffect(() => {
    setValue(content);
  }, [content]);
  

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="h-full">
      <SimpleMDE
        value={value}
        onChange={handleChange}
        options={{
          spellChecker: false,
          autosave: {
            enabled: true,
            uniqueId: 'markdown-editor',
            delay: 1000,
          },
          placeholder: 'Start writing...',
          status: false,
          toolbar: [
            'bold',
            'italic',
            'heading',
            '|',
            'quote',
            'unordered-list',
            'ordered-list',
            '|',
            'link',
            'image',
            '|',
            'preview',
            'side-by-side',
            'fullscreen',
            '|',
            'guide',
          ],
        }}
      />
    </div>
  );
};

const TextEditor = ({ content, onChange }: { content: string; onChange: (value: string) => void }) => {
  const [value, setValue] = useState(content);

  useEffect(() => {
    setValue(content);
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onChange(e.target.value);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      className="w-full h-full p-6 resize-none outline-none bg-transparent text-text-primary-light dark:text-text-primary-dark font-mono text-sm"
      placeholder="Start typing..."
    />
  );
};

const PDFViewer = ({ filePath }: { filePath?: string }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState<string | null>(null);

  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
  }), []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('PDF load error:', err);
    console.error('PDF file path:', filePath);
    const errorMessage = err.message || err.toString();
    setError(`Failed to load PDF: ${errorMessage}. File path: ${filePath}`);
  };

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      return Math.min(Math.max(1, newPage), numPages);
    });
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No PDF file selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium">
            Page {pageNumber} of {numPages || '?'}
          </span>
          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ZoomOut size={20} />
          </button>
          <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ZoomIn size={20} />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto p-6 flex justify-center">
        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-2xl">
            <div className="flex gap-3">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  Error Loading PDF
                </h3>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <Document
            file={filePath}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            options={pdfOptions}
            loading={
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-500">Loading PDF...</p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />
          </Document>
        )}
      </div>
    </div>
  );
};

const DocxViewer = ({
  filePath,
  initialContent,
  fileName,
  onChange
}: {
  filePath?: string;
  initialContent?: string;
  fileName?: string;
  onChange?: (content: string) => void;
}) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(filePath) && isPlaceholderContent(initialContent));
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const hasPersistedRemote = useRef(false);

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: [] }],
        ['link', 'blockquote', 'code-block'],
        ['clean'],
      ],
    }),
    []
  );

  const quillFormats = useMemo(
    () => ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'align', 'link', 'blockquote', 'code-block'],
    []
  );

  useEffect(() => {
    let cancelled = false;

    const loadDocx = async () => {
      if (!filePath && isPlaceholderContent(initialContent)) {
        setHtmlContent('');
        setIsLoading(false);
        return;
      }

      if (!isPlaceholderContent(initialContent)) {
        setHtmlContent(initialContent || '');
        setIsLoading(false);
        setError(null);
        return;
      }

      if (!filePath) return;

      try {
        setIsLoading(true);
        setError(null);
        console.log('Loading DOCX from:', filePath);
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch DOCX file (status ${response.status}): ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        console.log('DOCX file loaded, size:', arrayBuffer.byteLength, 'bytes');
        
        const mammoth = await import('mammoth/mammoth.browser');
        const conversion = await mammoth.convertToHtml({ arrayBuffer });
        if (cancelled) return;
        
        const convertedHtml = conversion.value || '<p><em>No content extracted from document.</em></p>';
        console.log('DOCX converted to HTML, length:', convertedHtml.length);
        
        if (convertedHtml.length < 50) {
          console.warn('DOCX conversion produced very little content:', convertedHtml);
        }
        
        setHtmlContent(convertedHtml);
        setError(null);
        if (!hasPersistedRemote.current && onChange) {
          hasPersistedRemote.current = true;
          onChange(convertedHtml);
        }
      } catch (err) {
        console.error('DOCX load error:', err);
        if (!cancelled) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          setError(`Failed to load DOCX file: ${errorMsg}. File path: ${filePath}`);
          setHtmlContent('');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDocx();

    return () => {
      cancelled = true;
    };
  }, [filePath, initialContent, onChange]);

  const handleQuillChange = (value: string) => {
    setHtmlContent(value);
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  const handleSave = () => {
    if (!onChange) return;
    onChange(htmlContent);
    setHasUnsavedChanges(false);
    setStatusMessage('Changes saved to workspace');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleExport = async () => {
    try {
      setStatusMessage('Preparing DOCX export…');
      const wrappedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${htmlContent}</body></html>`;
      const baseName = fileName ? fileName.replace(/\.docx$/i, '') : 'document';
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE_URL}/documents/export-docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: wrappedHtml,
          fileName: `${baseName}-edited.docx`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      saveAs(blob, `${baseName}-edited.docx`);
      setStatusMessage('DOCX exported successfully');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err) {
      console.error('DOCX export error:', err);
      setStatusMessage('Failed to export DOCX');
    }
  };

  if (!filePath && isPlaceholderContent(initialContent)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No DOCX file selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(prev => !prev)}
            className={`px-3 py-1 rounded text-sm ${isEditing ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
          >
            {isEditing ? 'Switch to Reading' : 'Enter Edit Mode'}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className="flex items-center gap-2 px-3 py-1 rounded text-sm bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600"
          >
            <Save size={16} />
            Save
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1 rounded text-sm bg-blue-500 text-white hover:bg-blue-600"
          >
            <Download size={16} />
            Export DOCX
          </button>
        </div>
        {statusMessage && (
          <span className="text-xs font-medium text-blue-600 dark:text-blue-300">{statusMessage}</span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-500">Loading DOCX...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-3xl mx-auto">
            <div className="flex gap-3">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Error Loading DOCX</h3>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        ) : isEditing ? (
          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 min-h-[70vh]">
            <ReactQuill
              theme="snow"
              value={htmlContent}
              onChange={handleQuillChange}
              modules={quillModules}
              formats={quillFormats}
              className="h-[60vh]"
            />
          </div>
        ) : htmlContent ? (
          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-12 prose prose-sm sm:prose lg:prose-lg dark:prose-invert min-h-[70vh]">
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No content to display</p>
              <p className="text-sm mt-2">The document may be empty or failed to load.</p>
              {filePath && (
                <p className="text-xs mt-2 text-gray-400">File: {filePath}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const XlsxViewer = ({
  filePath,
  initialContent,
  fileName,
  onChange,
}: {
  filePath?: string;
  initialContent?: string;
  fileName?: string;
  onChange?: (data: WorkbookSnapshot) => void;
}) => {
  const [sheetOrder, setSheetOrder] = useState<string[]>([DEFAULT_SHEET_NAME]);
  const [sheets, setSheets] = useState<Record<string, SpreadsheetMatrix>>({
    [DEFAULT_SHEET_NAME]: createEmptyMatrix(10, 5),
  });
  const [activeSheet, setActiveSheet] = useState<string>(DEFAULT_SHEET_NAME);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(filePath) && isPlaceholderContent(initialContent));
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const hasPersistedRemote = useRef(false);

  const hydrateFromSnapshot = useCallback((snapshot: WorkbookSnapshot) => {
    const normalizedOrder = snapshot?.order?.length ? snapshot.order : Object.keys(snapshot?.sheets || {});
    const effectiveOrder = normalizedOrder.length ? normalizedOrder : [DEFAULT_SHEET_NAME];
    const hydrated: Record<string, SpreadsheetMatrix> = {};
    effectiveOrder.forEach((name) => {
      const sheetData = snapshot?.sheets?.[name];
      hydrated[name] = aoaToMatrix(sheetData || [['']]);
    });
    if (!hydrated[effectiveOrder[0]]) {
      hydrated[effectiveOrder[0]] = createEmptyMatrix(10, 5);
    }
    setSheetOrder(effectiveOrder);
    setSheets(hydrated);
    setActiveSheet(effectiveOrder[0]);
    setHasUnsavedChanges(false);
    setStatusMessage(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadWorkbook = async () => {
      if (initialContent && !isPlaceholderContent(initialContent)) {
        const snapshot = parseWorkbookContent(initialContent);
        if (snapshot) {
          hydrateFromSnapshot(snapshot);
          setError(null);
          setIsLoading(false);
          return;
        } else {
          console.warn('Stored workbook content could not be parsed. Attempting to reload from source file.');
        }
      }

      if (!filePath) {
        if (isPlaceholderContent(initialContent)) {
          hydrateFromSnapshot({
            order: [DEFAULT_SHEET_NAME],
            sheets: { [DEFAULT_SHEET_NAME]: matrixToAoa(createEmptyMatrix(10, 5)) },
          });
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch XLSX file (status ${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const order = workbook.SheetNames.length ? workbook.SheetNames : [DEFAULT_SHEET_NAME];
        const snapshot: WorkbookSnapshot = {
          order,
          sheets: {},
        };
        order.forEach((name) => {
          const worksheet = workbook.Sheets[name];
          const raw = XLSX.utils.sheet_to_json(worksheet || {}, { header: 1, defval: '' }) as any[][];
          const sanitized = Array.isArray(raw) && raw.length > 0 ? raw : [['']];
          snapshot.sheets[name] = sanitized.map((row) =>
            Array.isArray(row) && row.length > 0 ? row.map((cell) => (cell ?? '').toString()) : ['']
          );
        });
        if (cancelled) return;
        hydrateFromSnapshot(snapshot);
        if (!hasPersistedRemote.current && onChange) {
          hasPersistedRemote.current = true;
          onChange(snapshot);
        }
      } catch (err) {
        console.error('XLSX load error:', err);
        if (!cancelled) {
          setError('Failed to load XLSX file. The file may be corrupted.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadWorkbook();

    return () => {
      cancelled = true;
    };
  }, [filePath, initialContent, hydrateFromSnapshot, onChange]);

  const currentMatrix = useMemo(
    () => sheets[activeSheet] ?? createEmptyMatrix(10, 5),
    [sheets, activeSheet]
  );

  const columnLabels = useMemo(() => {
    const maxCols = currentMatrix.reduce((max, row) => Math.max(max, row.length), 0) || 1;
    return Array.from({ length: maxCols }, (_, index) => XLSX.utils.encode_col(index));
  }, [currentMatrix]);

  const rowLabels = useMemo(() => {
    return Array.from({ length: currentMatrix.length || 1 }, (_, index) => String(index + 1));
  }, [currentMatrix]);

  const handleSpreadsheetChange = (newData: Matrix<CellBase<string>>) => {
    const normalized = normalizeMatrix(newData);
    setSheets((prev) => ({
      ...prev,
      [activeSheet]: normalized,
    }));
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  const handleAddRow = () => {
    setSheets((prev) => {
      const current = prev[activeSheet] ?? createEmptyMatrix(10, 5);
      const columnCount = current.reduce((max, row) => Math.max(max, row.length), 0) || 1;
      const updated = [...current, createEmptyRow(columnCount)] as SpreadsheetMatrix;
      return { ...prev, [activeSheet]: updated };
    });
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  const handleAddColumn = () => {
    setSheets((prev) => {
      const current = prev[activeSheet] ?? createEmptyMatrix(10, 5);
      const updated = current.map((row) => [...row, { value: '' }]) as SpreadsheetMatrix;
      return { ...prev, [activeSheet]: updated };
    });
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  const handleClearSheet = () => {
    setSheets((prev) => ({ ...prev, [activeSheet]: createEmptyMatrix(10, 5) }));
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  const handleAddSheet = () => {
    let index = sheetOrder.length + 1;
    let candidate = `Sheet${index}`;
    const existing = new Set(sheetOrder);
    while (existing.has(candidate)) {
      index += 1;
      candidate = `Sheet${index}`;
    }
    setSheetOrder((prev) => [...prev, candidate]);
    setSheets((prev) => ({ ...prev, [candidate]: createEmptyMatrix(10, 5) }));
    setActiveSheet(candidate);
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  const handleSheetChange = (sheetName: string) => {
    setActiveSheet(sheetName);
    setStatusMessage(null);
  };

  const handleSave = () => {
    if (!onChange) return;
    const snapshot = buildSnapshotFromSheets(sheets, sheetOrder);
    onChange(snapshot);
    setHasUnsavedChanges(false);
    setStatusMessage('Changes saved to workspace');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleExport = () => {
    try {
      const snapshot = buildSnapshotFromSheets(sheets, sheetOrder);
      const workbook = XLSX.utils.book_new();
      snapshot.order.forEach((name) => {
        const ws = XLSX.utils.aoa_to_sheet(snapshot.sheets[name] || [['']]);
        XLSX.utils.book_append_sheet(workbook, ws, name);
      });
      const baseName = fileName ? fileName.replace(/\.(xlsx|xls)$/i, '') : 'spreadsheet';
      XLSX.writeFile(workbook, `${baseName}-edited.xlsx`);
      setStatusMessage('XLSX exported successfully');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err) {
      console.error('XLSX export error:', err);
      setStatusMessage('Failed to export XLSX');
    }
  };

  if (!filePath && isPlaceholderContent(initialContent)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No XLSX file selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Sheet:</span>
            <select
              value={activeSheet}
              onChange={(e) => handleSheetChange(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              {sheetOrder.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddSheet}
            className="px-3 py-1 rounded text-sm bg-blue-500 text-white hover:bg-blue-600"
          >
            + Sheet
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={handleAddRow}
            className="px-3 py-1 rounded text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            + Row
          </button>
          <button
            onClick={handleAddColumn}
            className="px-3 py-1 rounded text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            + Column
          </button>
          <button
            onClick={handleClearSheet}
            className="px-3 py-1 rounded text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Clear Sheet
          </button>
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className="flex items-center gap-2 px-3 py-1 rounded text-sm bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600"
          >
            <Save size={16} />
            Save
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1 rounded text-sm bg-blue-500 text-white hover:bg-blue-600"
          >
            <Download size={16} />
            Export XLSX
          </button>
        </div>
      </div>
      {statusMessage && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-200">
          {statusMessage}
        </div>
      )}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-500">Loading XLSX...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-2xl mx-auto">
            <div className="flex gap-3">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Error Loading XLSX</h3>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-x-auto p-2">
            <Spreadsheet
              data={currentMatrix}
              onChange={handleSpreadsheetChange}
              columnLabels={columnLabels}
              rowLabels={rowLabels}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyState = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-text-muted-light dark:text-text-muted-dark">
        <FileText size={64} className="mx-auto mb-4 opacity-30" />
        <h3 className="text-xl font-semibold mb-2">No Document Selected</h3>
        <p className="text-sm">Select a document from the sidebar to start editing</p>
      </div>
    </div>
  );
};

export const DocumentViewer = () => {
  const { activeFileId, getFileById, updateFileContent } = useFileSystemStore();
  const activeFile = activeFileId ? getFileById(activeFileId) : null;

  const handleContentChange = (newContent: string | any) => {
    if (activeFileId) {
      if (typeof newContent === 'string') {
        updateFileContent(activeFileId, newContent);
      } else {
        // For XLSX data, convert to JSON string
        updateFileContent(activeFileId, JSON.stringify(newContent));
      }
    }
  };

  // Get file URL for binary files (PDF, DOCX, XLSX)
  const getFileUrl = () => {
    if (!activeFile) return undefined;
    
    // If file has savedFilename, use server URL
    if (activeFile.savedFilename) {
      let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      // Remove /api suffix if present, since uploads are served directly
      if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4);
      }
      return `${baseUrl}/uploads/${activeFile.savedFilename}`;
    }
    
    // If content is available for binary files, create blob URL
    if (activeFile.content && (activeFile.type === 'pdf' || activeFile.type === 'docx' || activeFile.type === 'xlsx')) {
      try {
        // Assuming content is base64 or raw data
        const blob = new Blob([activeFile.content], { 
          type: activeFile.type === 'pdf' ? 'application/pdf' : 
                activeFile.type === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        return URL.createObjectURL(blob);
      } catch (err) {
        console.error('Failed to create blob URL:', err);
        return undefined;
      }
    }
    
    return undefined;
  };

  if (!activeFile) {
    return <EmptyState />;
  }

  if (activeFile.type === 'folder') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-text-muted-light dark:text-text-muted-dark">
          <FileText size={64} className="mx-auto mb-4 opacity-30" />
          <h3 className="text-xl font-semibold mb-2">Folder Selected</h3>
          <p className="text-sm">Select a file to view or edit its contents</p>
        </div>
      </div>
    );
  }

  const fileUrl = getFileUrl();

  return (
    <div className="h-full overflow-hidden bg-editor-light dark:bg-editor-dark">
      {activeFile.type === 'md' && (
        <MarkdownEditor 
          content={activeFile.content || ''} 
          onChange={handleContentChange}
        />
      )}
      
      {activeFile.type === 'txt' && (
        <TextEditor 
          content={activeFile.content || ''} 
          onChange={handleContentChange}
        />
      )}
      
      {activeFile.type === 'pdf' && (
        <PDFViewer filePath={fileUrl} />
      )}
      
      {activeFile.type === 'docx' && (
        <DocxViewer 
          filePath={fileUrl}
          initialContent={activeFile.content}
          fileName={activeFile.name}
          onChange={handleContentChange}
        />
      )}
      
      {activeFile.type === 'xlsx' && (
        <XlsxViewer 
          filePath={fileUrl}
          initialContent={activeFile.content}
          fileName={activeFile.name}
          onChange={handleContentChange}
        />
      )}
    </div>
  );
};

