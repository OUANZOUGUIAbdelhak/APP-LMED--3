import { FileType } from '../types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import mammoth from 'mammoth';

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export const getFileType = (filename: string): FileType => {
  const ext = getFileExtension(filename);
  
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'md':
    case 'markdown':
      return 'md';
    case 'txt':
      return 'txt';
    default:
      return 'txt';
  }
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const extractTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting DOCX text:', error);
    return 'Error reading DOCX file';
  }
};

export const exportToZip = async (files: any[], zipName: string = 'documents.zip') => {
  const zip = new JSZip();

  const addFilesToZip = (fileList: any[], folder: JSZip | null = null) => {
    fileList.forEach(file => {
      if (file.type === 'folder' && file.children) {
        const newFolder = folder ? folder.folder(file.name)! : zip.folder(file.name)!;
        addFilesToZip(file.children, newFolder);
      } else if (file.content) {
        const target = folder || zip;
        target.file(file.name, file.content);
      }
    });
  };

  addFilesToZip(files);
  
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, zipName);
};

export const downloadFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);
};

export const getFileIcon = (type: FileType): string => {
  switch (type) {
    case 'folder':
      return 'Folder';
    case 'pdf':
      return 'FileText';
    case 'docx':
      return 'FileText';
    case 'md':
      return 'FileCode';
    case 'txt':
      return 'File';
    default:
      return 'File';
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

