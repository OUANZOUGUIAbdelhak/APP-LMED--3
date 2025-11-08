import { useEffect, useState } from 'react';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { FileText, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
// import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Setup PDF.js worker
// pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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

const PDFViewer = ({ }: { content: string }) => {
  // For demo purposes, we show a placeholder
  // In production, you'd load the actual PDF file
  // const [numPages, setNumPages] = useState<number>(0);
  // const [pageNumber, setPageNumber] = useState(1);
  // const [error, setError] = useState(false);
  
  return (
    <div className="flex flex-col items-center p-6 gap-4">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 max-w-2xl">
        <div className="flex gap-3">
          <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
              PDF Preview
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              PDF viewing requires the actual file buffer. This demo shows placeholder content.
              In production, implement proper PDF loading with file buffers or URLs.
            </p>
          </div>
        </div>
      </div>
      
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 max-w-2xl w-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">PDF Document</p>
          <p className="text-sm mt-2">PDF content will be displayed here</p>
        </div>
      </div>
    </div>
  );
};

const DocxViewer = ({ content }: { content: string }) => {
  return (
    <div className="p-12 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-12 min-h-[800px]">
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
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

  const handleContentChange = (newContent: string) => {
    if (activeFileId) {
      updateFileContent(activeFileId, newContent);
    }
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

  return (
    <div className="h-full overflow-y-auto bg-editor-light dark:bg-editor-dark">
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
        <PDFViewer content={activeFile.content || ''} />
      )}
      
      {activeFile.type === 'docx' && (
        <DocxViewer content={activeFile.content || ''} />
      )}
    </div>
  );
};

