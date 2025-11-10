import { useState } from 'react';
import { Check, X, Loader2, FileText } from 'lucide-react';
import { insertTextIntoFile } from '../services/api';
import { useFileSystemStore } from '../stores/fileSystemStore';

interface InsertSuggestionProps {
  suggestedText: string;
  targetFile?: string;
  line?: number;
  column?: number;
  onInserted?: () => void;
}

export const InsertSuggestion = ({ 
  suggestedText, 
  targetFile, 
  line, 
  column = 1,
  onInserted 
}: InsertSuggestionProps) => {
  const [isInserting, setIsInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { findFileBySavedFilename, getFileById, activeFileId, updateFileContent } = useFileSystemStore();

  const handleInsert = async () => {
    if (!targetFile && !activeFileId) {
      setError('No target file specified');
      return;
    }

    setIsInserting(true);
    setError(null);

    try {
      // Determine the filename to use
      let filename: string | undefined;
      
      if (targetFile) {
        // Try to find file by savedFilename
        const file = findFileBySavedFilename(targetFile);
        if (file?.savedFilename) {
          filename = file.savedFilename;
        } else {
          filename = targetFile;
        }
      } else if (activeFileId) {
        const file = getFileById(activeFileId);
        if (file?.savedFilename) {
          filename = file.savedFilename;
        } else if (file?.name) {
          filename = file.name;
        }
      }

      if (!filename) {
        throw new Error('Could not determine target file');
      }

      // Determine line number (default to end of file if not specified)
      const insertLine = line || 1;

      // Insert via API
      await insertTextIntoFile(filename, suggestedText, insertLine, column);

          // Update local file content if it's the active file
      if (activeFileId) {
        const file = getFileById(activeFileId);
        if (file) {
          const currentContent = file.content || '';
          const lines = currentContent.split(/\r?\n/);
          
          let newContent: string;
          if (insertLine > lines.length) {
            // Append at end
            newContent = currentContent + '\n' + suggestedText;
          } else {
            // Insert at line
            lines.splice(insertLine - 1, 0, suggestedText);
            newContent = lines.join('\n');
          }
          updateFileContent(activeFileId, newContent, 'AI insertion');
        }
      }

      if (onInserted) {
        onInserted();
      }
    } catch (err) {
      console.error('Insert error:', err);
      setError(err instanceof Error ? err.message : 'Failed to insert text');
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-green-600 dark:text-green-400" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-300">
              Suggested Text to Insert
            </span>
          </div>
        </div>
        
        <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 mb-2 overflow-x-auto">
          <code className="text-gray-800 dark:text-gray-200">{suggestedText}</code>
        </pre>

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 mb-2">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleInsert}
            disabled={isInserting}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isInserting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Inserting...
              </>
            ) : (
              <>
                <Check size={12} />
                Insert into File
              </>
            )}
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {targetFile && `Target: ${targetFile}`}
            {line && ` at line ${line}`}
          </span>
        </div>
      </div>
    </div>
  );
};

