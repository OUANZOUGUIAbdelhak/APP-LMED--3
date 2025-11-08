import { Moon, Sun, Download, Upload, Save, FolderPlus, FilePlus } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { exportToZip } from '../lib/fileUtils';

export const Toolbar = () => {
  const { theme, toggleTheme } = useAppStore();
  const { files, activeFileId, getFileById, updateFileContent, addFile } = useFileSystemStore();
  const activeFile = activeFileId ? getFileById(activeFileId) : null;

  const handleSave = () => {
    if (activeFile && activeFile.content) {
      updateFileContent(activeFile.id, activeFile.content);
    }
  };

  const handleExportAll = async () => {
    await exportToZip(files, 'workspace-export.zip');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.docx,.doc,.md,.txt';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // Import logic handled in FileExplorer
          const event = new CustomEvent('importFiles', { detail: [file] });
          window.dispatchEvent(event);
        }
      }
    };
    input.click();
  };

  const handleNewFile = () => {
    addFile('Untitled.md', 'md', undefined, '# New Document\n\nStart writing...');
  };

  const handleNewFolder = () => {
    addFile('New Folder', 'folder');
  };

  return (
    <div className="h-toolbar border-b border-border-light dark:border-border-dark bg-toolbar-light dark:bg-toolbar-dark flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          AI Document Workspace
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleNewFile}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="New File"
        >
          <FilePlus size={18} className="text-text-muted-light dark:text-text-muted-dark" />
        </button>
        
        <button
          onClick={handleNewFolder}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="New Folder"
        >
          <FolderPlus size={18} className="text-text-muted-light dark:text-text-muted-dark" />
        </button>

        <div className="w-px h-6 bg-border-light dark:bg-border-dark mx-2" />

        <button
          onClick={handleImport}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Import Files"
        >
          <Upload size={18} className="text-text-muted-light dark:text-text-muted-dark" />
        </button>

        <button
          onClick={handleExportAll}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Export All"
        >
          <Download size={18} className="text-text-muted-light dark:text-text-muted-dark" />
        </button>

        {activeFile && (
          <button
            onClick={handleSave}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Save"
          >
            <Save size={18} className="text-primary" />
          </button>
        )}

        <div className="w-px h-6 bg-border-light dark:bg-border-dark mx-2" />

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <Moon size={18} className="text-text-muted-light dark:text-text-muted-dark" />
          ) : (
            <Sun size={18} className="text-text-muted-light dark:text-text-muted-dark" />
          )}
        </button>
      </div>
    </div>
  );
};

