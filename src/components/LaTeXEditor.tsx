import { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Save, Download } from 'lucide-react';
import { saveAs } from 'file-saver';
import * as monaco from 'monaco-editor';

// Configure Monaco for LaTeX syntax highlighting
const configureMonacoForLaTeX = () => {
  try {
    // Register LaTeX language if not already registered
    const languages = monaco.languages.getLanguages();
    if (!languages.find(lang => lang.id === 'latex')) {
      monaco.languages.register({ id: 'latex' });
      
      // Define LaTeX tokens
      monaco.languages.setMonarchTokensProvider('latex', {
        tokenizer: {
          root: [
            // Comments
            [/%[^\n]*/, 'comment'],
            // Commands
            [/\\[a-zA-Z@]+/, 'keyword'],
            // Math delimiters
            [/\$/, 'delimiter'],
            [/\[/, 'delimiter'],
            [/\]/, 'delimiter'],
            // Braces
            [/\{/, 'delimiter.bracket'],
            [/\}/, 'delimiter.bracket'],
            // Strings
            [/"[^"]*"/, 'string'],
            // Numbers
            [/\d+/, 'number'],
          ],
        },
      });

      // Define LaTeX theme
      monaco.editor.defineTheme('latex-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
          { token: 'keyword', foreground: '569CD6' },
          { token: 'string', foreground: 'CE9178' },
          { token: 'number', foreground: 'B5CEA8' },
          { token: 'delimiter', foreground: 'D4D4D4' },
        ],
        colors: {
          'editor.background': '#1E1E1E',
        },
      });
    }
  } catch (err) {
    console.warn('Failed to configure Monaco for LaTeX:', err);
  }
};

interface LaTeXEditorProps {
  content: string;
  fileName?: string;
  onChange: (value: string) => void;
  onInsertText?: (text: string, position: { line: number; column: number }) => void;
}

export const LaTeXEditor = ({ content, fileName, onChange, onInsertText }: LaTeXEditorProps) => {
  const [value, setValue] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    setValue(content);
    setHasUnsavedChanges(false);
  }, [content]);

  useEffect(() => {
    configureMonacoForLaTeX();
  }, []);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    
    try {
      // Set LaTeX theme
      monaco.editor.setTheme('latex-theme');
    } catch (err) {
      console.warn('Failed to set LaTeX theme:', err);
    }
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineNumbers: 'on',
      minimap: { enabled: true },
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
      insertSpaces: true,
    });
  };

  const handleChange = (newValue: string | undefined) => {
    const updatedValue = newValue || '';
    setValue(updatedValue);
    onChange(updatedValue);
    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  const handleSave = () => {
    onChange(value);
    setHasUnsavedChanges(false);
    setStatusMessage('Changes saved to workspace');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleExport = () => {
    try {
      const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
      const baseName = fileName ? fileName.replace(/\.tex$/i, '') : 'document';
      saveAs(blob, `${baseName}.tex`);
      setStatusMessage('LaTeX file exported successfully');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err) {
      console.error('Export error:', err);
      setStatusMessage('Failed to export LaTeX file');
    }
  };

  // Expose insertText function to parent via ref callback
  useEffect(() => {
    if (onInsertText && editorRef.current) {
      // This will be called from parent component when text needs to be inserted
      (window as any).insertLaTeXText = (text: string, line: number, column: number) => {
        if (editorRef.current) {
          const position = new monaco.Position(line, column);
          const range = new monaco.Range(line, column, line, column);
          editorRef.current.executeEdits('insert-text', [
            {
              range,
              text,
            },
          ]);
          editorRef.current.setPosition(position);
          editorRef.current.focus();
        }
      };
    }
    return () => {
      delete (window as any).insertLaTeXText;
    };
  }, [onInsertText]);

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            LaTeX Editor
          </span>
          {fileName && (
            <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
              {fileName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
            Export .tex
          </button>
        </div>
        {statusMessage && (
          <span className="text-xs font-medium text-blue-600 dark:text-blue-300">
            {statusMessage}
          </span>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="latex"
          value={value}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme="latex-theme"
          options={{
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: true },
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: 2,
            insertSpaces: true,
            renderWhitespace: 'selection',
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
    </div>
  );
};

