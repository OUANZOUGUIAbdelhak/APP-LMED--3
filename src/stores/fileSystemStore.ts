import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { FileNode, FileType, FileVersion } from '../types';
// RAG disabled: no auto-indexing

interface FileSystemState {
  files: FileNode[];
  activeFileId: string | null;
  expandedFolders: Set<string>;
  
  // Actions
  addFile: (name: string, type: FileType, parentId?: string, content?: string) => string;
  deleteFile: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
  updateFileContent: (id: string, content: string) => void;
  setFileMeta: (id: string, updates: Partial<FileNode>) => void;
  setActiveFile: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  moveFile: (fileId: string, newParentId?: string) => void;
  getFileById: (id: string) => FileNode | null;
  findFileBySavedFilename: (savedFilename: string) => FileNode | null;
  findFileByDocId: (docId: string) => FileNode | null;
  getFilePath: (id: string) => string;
}

const findFileById = (files: FileNode[], id: string): FileNode | null => {
  for (const file of files) {
    if (file.id === id) return file;
    if (file.children) {
      const found = findFileById(file.children, id);
      if (found) return found;
    }
  }
  return null;
};

const findFileByPredicate = (files: FileNode[], predicate: (file: FileNode) => boolean): FileNode | null => {
  for (const file of files) {
    if (predicate(file)) {
      return file;
    }
    if (file.children) {
      const found = findFileByPredicate(file.children, predicate);
      if (found) return found;
    }
  }
  return null;
};

const removeFileById = (files: FileNode[], id: string): FileNode[] => {
  return files.filter(file => {
    if (file.id === id) return false;
    if (file.children) {
      file.children = removeFileById(file.children, id);
    }
    return true;
  });
};

const updateFileById = (files: FileNode[], id: string, updates: Partial<FileNode>): FileNode[] => {
  return files.map(file => {
    if (file.id === id) {
      return { ...file, ...updates, updatedAt: new Date() };
    }
    if (file.children) {
      return { ...file, children: updateFileById(file.children, id, updates) };
    }
    return file;
  });
};

export const useFileSystemStore = create<FileSystemState>()(
  persist(
    (set, get) => ({
      files: [
        {
          id: 'welcome',
          name: 'Welcome.md',
          type: 'md',
          content: '# Welcome to AI Document Workspace\n\nStart by creating or importing documents from the sidebar.\n\n## Features\n- 📁 File management with drag & drop\n- 📝 Document editing (Markdown, PDF, DOCX)\n- 💬 AI chat assistant with document context\n- 🎨 Beautiful, responsive interface\n\nSelect a document to edit or chat with the AI assistant!',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ],
      activeFileId: 'welcome',
      expandedFolders: new Set<string>(),

      addFile: (name, type, parentId, content = '') => {
        const id = nanoid();
        const newFile: FileNode = {
          id,
          name,
          type,
          content: type !== 'folder' ? content : undefined,
          children: type === 'folder' ? [] : undefined,
          parentId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set(state => {
          if (!parentId) {
            return { files: [...state.files, newFile] };
          }

          const addToParent = (files: FileNode[]): FileNode[] => {
            return files.map(file => {
              if (file.id === parentId && file.type === 'folder') {
                return {
                  ...file,
                  children: [...(file.children || []), newFile],
                };
              }
              if (file.children) {
                return { ...file, children: addToParent(file.children) };
              }
              return file;
            });
          };

          return { files: addToParent(state.files) };
        });

        // RAG indexing is disabled in agent-only mode.

        return id;
      },

      deleteFile: async (id) => {
        const file = findFileById(get().files, id);
        
        // Delete from backend vector store if it has docId or savedFilename
        if (file) {
          try {
            const { deleteDocument } = await import('../services/api');
            if (file.docId) {
              await deleteDocument(file.docId).catch(err => console.warn('Failed to delete from backend:', err));
            } else if (file.savedFilename) {
              await deleteDocument(file.savedFilename).catch(err => console.warn('Failed to delete from backend:', err));
            }
          } catch (err) {
            console.warn('Error importing deleteDocument:', err);
          }
        }
        
        set(state => ({
          files: removeFileById(state.files, id),
          activeFileId: state.activeFileId === id ? null : state.activeFileId,
        }));
      },

      renameFile: (id, newName) => {
        set(state => ({
          files: updateFileById(state.files, id, { name: newName }),
        }));
      },

      updateFileContent: (id, content, reason?: string) => {
        set(state => {
          const file = findFileById(state.files, id);
          if (!file) return state;

          // Create version history (keep last 10 versions)
          const versions = file.versions || [];
          const newVersion: FileVersion = {
            content: file.content || '',
            timestamp: new Date(),
            reason: reason || 'User edit',
          };
          
          const updatedVersions = [newVersion, ...versions].slice(0, 10);

          return {
            files: updateFileById(state.files, id, { 
              content,
              versions: updatedVersions,
            }),
          };
        });
      },

      setFileMeta: (id, updates) => {
        set(state => ({
          files: updateFileById(state.files, id, updates),
        }));
      },

      setActiveFile: (id) => {
        set({ activeFileId: id });
      },

      toggleFolder: (id) => {
        set(state => {
          const newExpanded = new Set(state.expandedFolders);
          if (newExpanded.has(id)) {
            newExpanded.delete(id);
          } else {
            newExpanded.add(id);
          }
          return { expandedFolders: newExpanded };
        });
      },

      moveFile: (fileId, newParentId) => {
        set(state => {
          const file = findFileById(state.files, fileId);
          if (!file) return state;

          let filesWithoutMoved = removeFileById(state.files, fileId);

          if (!newParentId) {
            return { files: [...filesWithoutMoved, { ...file, parentId: undefined }] };
          }

          const addToParent = (files: FileNode[]): FileNode[] => {
            return files.map(f => {
              if (f.id === newParentId && f.type === 'folder') {
                return {
                  ...f,
                  children: [...(f.children || []), { ...file, parentId: newParentId }],
                };
              }
              if (f.children) {
                return { ...f, children: addToParent(f.children) };
              }
              return f;
            });
          };

          return { files: addToParent(filesWithoutMoved) };
        });
      },

      getFileById: (id) => {
        return findFileById(get().files, id);
      },

      findFileBySavedFilename: (savedFilename) => {
        if (!savedFilename) return null;
        return findFileByPredicate(get().files, file => file.savedFilename === savedFilename);
      },

      findFileByDocId: (docId) => {
        if (!docId) return null;
        return findFileByPredicate(get().files, file => file.docId === docId);
      },

      getFilePath: (id) => {
        const buildPath = (files: FileNode[], targetId: string, currentPath: string[] = []): string[] | null => {
          for (const file of files) {
            if (file.id === targetId) {
              return [...currentPath, file.name];
            }
            if (file.children) {
              const found = buildPath(file.children, targetId, [...currentPath, file.name]);
              if (found) return found;
            }
          }
          return null;
        };

        const path = buildPath(get().files, id);
        return path ? path.join(' / ') : '';
      },
    }),
    {
      name: 'file-system-storage',
      partialize: (state) => ({
        files: state.files,
        activeFileId: state.activeFileId,
      }),
    }
  )
);

