import { FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useState } from 'react';

export const BottomBar = () => {
  const { activeFileId, getFileById, getFilePath } = useFileSystemStore();
  const [zoom, setZoom] = useState(100);
  
  const activeFile = activeFileId ? getFileById(activeFileId) : null;
  const filePath = activeFileId ? getFilePath(activeFileId) : '';
  
  const wordCount = activeFile?.content 
    ? activeFile.content.split(/\s+/).filter(word => word.length > 0).length 
    : 0;
  
  const charCount = activeFile?.content?.length || 0;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  return (
    <div className="h-bottombar border-t border-border-light dark:border-border-dark bg-toolbar-light dark:bg-toolbar-dark flex items-center justify-between px-4 text-xs text-text-muted-light dark:text-text-muted-dark">
      <div className="flex items-center gap-4">
        {activeFile && (
          <>
            <div className="flex items-center gap-2">
              <FileText size={14} />
              <span className="truncate max-w-[300px]" title={filePath}>
                {filePath}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{charCount} characters</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="w-12 text-center">{zoom}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
        </div>
        
        {activeFile && (
          <>
            <span>•</span>
            <span className="uppercase">{activeFile.type}</span>
          </>
        )}
      </div>
    </div>
  );
};

