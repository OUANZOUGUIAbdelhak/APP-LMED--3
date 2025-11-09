import { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileText, 
  File, 
  FileCode,
  MoreVertical,
  Edit2,
  Trash2,
  Download,
  Plus,
  X,
  Trash
} from 'lucide-react';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { FileNode, FileType } from '../types';
import { 
  readFileAsText, 
  readFileAsArrayBuffer, 
  getFileType, 
  downloadFile,
  extractTextFromDocx 
} from '../lib/fileUtils';
import { FileUpload } from './FileUpload';

interface FileItemProps {
  file: FileNode;
  level: number;
}

const FileIcon = ({ type }: { type: FileType }) => {
  switch (type) {
    case 'folder':
      return <Folder size={16} />;
    case 'pdf':
      return <FileText size={16} className="text-red-500" />;
    case 'docx':
      return <FileText size={16} className="text-blue-500" />;
    case 'md':
      return <FileCode size={16} className="text-purple-500" />;
    case 'txt':
      return <File size={16} className="text-gray-500" />;
    default:
      return <File size={16} />;
  }
};

const ContextMenu = ({ 
  x, 
  y, 
  file, 
  onClose, 
  onRename, 
  onDelete, 
  onExport,
  onNewFile,
  onNewFolder,
  onClearSelection
}: { 
  x: number; 
  y: number; 
  file: FileNode;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onExport: () => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onClearSelection?: () => void;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {file.type === 'folder' && (
        <>
          <div className="context-menu-item" onClick={onNewFile}>
            <Plus size={14} />
            New File
          </div>
          <div className="context-menu-item" onClick={onNewFolder}>
            <Plus size={14} />
            New Folder
          </div>
          <div className="context-menu-divider" />
        </>
      )}
      <div className="context-menu-item" onClick={onRename}>
        <Edit2 size={14} />
        Rename
      </div>
      {file.type !== 'folder' && (
        <div className="context-menu-item" onClick={onExport}>
          <Download size={14} />
          Export
        </div>
      )}
      {onClearSelection && (
        <>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={onClearSelection}>
            <X size={14} />
            Clear Selection
          </div>
        </>
      )}
      <div className="context-menu-divider" />
      <div className="context-menu-item danger" onClick={onDelete}>
        <Trash2 size={14} />
        Delete
      </div>
    </div>
  );
};

const FileItem = ({ file, level }: FileItemProps) => {
  const { 
    activeFileId, 
    setActiveFile, 
    expandedFolders, 
    toggleFolder,
    renameFile,
    deleteFile,
    addFile
  } = useFileSystemStore();
  
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  
  const isActive = activeFileId === file.id;
  const isExpanded = expandedFolders.has(file.id);
  const isFolder = file.type === 'folder';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent bubbling to parent div
    if (isFolder) {
      toggleFolder(file.id);
    } else {
      // Toggle selection: if already active, deselect; otherwise select
      if (isActive) {
        setActiveFile(null);
      } else {
        setActiveFile(file.id);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRename = () => {
    setIsRenaming(true);
    setContextMenu(null);
  };

  const handleRenameSubmit = () => {
    if (newName.trim() && newName !== file.name) {
      renameFile(file.id, newName);
    }
    setIsRenaming(false);
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
      deleteFile(file.id);
    }
    setContextMenu(null);
  };

  const handleExport = () => {
    if (file.content) {
      downloadFile(file.content, file.name);
    }
    setContextMenu(null);
  };

  const handleNewFile = () => {
    addFile('Untitled.txt', 'txt', file.id, '');
    setContextMenu(null);
  };

  const handleNewFolder = () => {
    addFile('New Folder', 'folder', file.id);
    setContextMenu(null);
  };

  const handleClearSelection = () => {
    setActiveFile(null);
    setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('fileId', file.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isFolder) {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // Handle file move
    const fileId = e.dataTransfer.getData('fileId');
    if (fileId && isFolder) {
      const { moveFile } = useFileSystemStore.getState();
      moveFile(fileId, file.id);
      return;
    }

    // Handle file import
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && isFolder) {
      for (const droppedFile of files) {
        const fileType = getFileType(droppedFile.name);
        let content = '';

        if (fileType === 'docx') {
          const arrayBuffer = await readFileAsArrayBuffer(droppedFile);
          content = await extractTextFromDocx(arrayBuffer);
        } else if (fileType === 'pdf') {
          content = 'PDF viewing is supported in the editor';
        } else {
          content = await readFileAsText(droppedFile);
        }

        addFile(droppedFile.name, fileType, file.id, content);
      }
    }
  };

  return (
    <>
      <div
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`
          flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group
          ${isActive ? 'bg-primary/10 border-l-4 border-primary' : 'border-l-4 border-transparent'}
          ${dragOver ? 'bg-primary/20' : 'hover:bg-sidebar-light/50 dark:hover:bg-gray-700'}
        `}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        {isFolder && (
          <span className="text-text-muted-light dark:text-text-muted-dark">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        
        <span className="text-text-muted-light dark:text-text-muted-dark">
          {isFolder && isExpanded ? <FolderOpen size={16} /> : <FileIcon type={file.type} />}
        </span>

        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="flex-1 bg-white dark:bg-gray-800 border border-primary rounded px-2 py-0.5 text-sm outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm truncate text-text-primary-light dark:text-text-primary-dark">
            {file.name}
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleContextMenu(e as any);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity"
        >
          <MoreVertical size={14} className="text-text-muted-light dark:text-text-muted-dark" />
        </button>
      </div>

      {isFolder && isExpanded && file.children?.map((child) => (
        <FileItem key={child.id} file={child} level={level + 1} />
      ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={file}
          onClose={() => setContextMenu(null)}
          onRename={handleRename}
          onDelete={handleDelete}
          onExport={handleExport}
          onNewFile={isFolder ? handleNewFile : undefined}
          onNewFolder={isFolder ? handleNewFolder : undefined}
          onClearSelection={isActive ? handleClearSelection : undefined}
        />
      )}
    </>
  );
};

export const FileExplorer = () => {
  const { files, addFile } = useFileSystemStore();
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const handleImportFiles = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const files = customEvent.detail as File[];
      
      for (const file of files) {
        const fileType = getFileType(file.name);
        let content = '';

        if (fileType === 'docx') {
          const arrayBuffer = await readFileAsArrayBuffer(file);
          content = await extractTextFromDocx(arrayBuffer);
        } else if (fileType === 'pdf') {
          content = 'PDF viewing is supported in the editor';
        } else {
          content = await readFileAsText(file);
        }

        addFile(file.name, fileType, undefined, content);
      }
    };

    window.addEventListener('importFiles', handleImportFiles);
    return () => window.removeEventListener('importFiles', handleImportFiles);
  }, [addFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      for (const file of droppedFiles) {
        const fileType = getFileType(file.name);
        let content = '';

        if (fileType === 'docx') {
          const arrayBuffer = await readFileAsArrayBuffer(file);
          content = await extractTextFromDocx(arrayBuffer);
        } else if (fileType === 'pdf') {
          content = 'PDF viewing is supported in the editor';
        } else {
          content = await readFileAsText(file);
        }

        addFile(file.name, fileType, undefined, content);
      }
    }
  };

  return (
    <div
      className={`
        h-full bg-sidebar-light dark:bg-sidebar-dark overflow-y-auto
        ${dragOver ? 'border-2 border-primary border-dashed' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-3 border-b border-border-light dark:border-border-dark space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Documents
          </h2>
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to delete ALL documents and clear the index? This cannot be undone.')) {
                try {
                  const { clearAllDocuments } = await import('../services/api');
                  const result = await clearAllDocuments();
                  alert(`Successfully cleared ${result.deletedFiles} files and reset the index.`);
                  // Clear frontend file system
                  const { useFileSystemStore } = await import('../stores/fileSystemStore');
                  useFileSystemStore.getState().files = [{
                    id: 'welcome',
                    name: 'Welcome.md',
                    type: 'md',
                    content: '# Welcome to AI Document Workspace\n\nStart by creating or importing documents from the sidebar.\n\n## Features\n- 📁 File management with drag & drop\n- 📝 Document editing (Markdown, PDF, DOCX)\n- 💬 AI chat assistant with document context\n- 🎨 Beautiful, responsive interface\n\nSelect a document to edit or chat with the AI assistant!',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }];
                  useFileSystemStore.getState().setActiveFile('welcome');
                  window.location.reload(); // Reload to refresh everything
                } catch (err) {
                  alert(`Error clearing documents: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
              }
            }}
            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
            title="Clear all documents and index"
          >
            <Trash size={14} className="text-red-600 dark:text-red-400" />
          </button>
        </div>
        <FileUpload />
      </div>
      
      <div 
        className="py-2"
        onClick={(e) => {
          // Allow clicking empty space to deselect
          if (e.target === e.currentTarget) {
            const { setActiveFile, activeFileId } = useFileSystemStore.getState();
            if (activeFileId) {
              setActiveFile(null);
            }
          }
        }}
      >
        {files.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-muted-light dark:text-text-muted-dark text-sm">
            <p>No documents yet</p>
            <p className="mt-2">Drop files here or use the toolbar to add files</p>
          </div>
        ) : (
          files.map((file) => <FileItem key={file.id} file={file} level={0} />)
        )}
      </div>
    </div>
  );
};

