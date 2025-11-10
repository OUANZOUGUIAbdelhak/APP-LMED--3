import { useRef, useState } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { uploadDocument } from '../services/api';
import { useFileSystemStore } from '../stores/fileSystemStore';

interface UploadStatus {
  loading: boolean;
  success: boolean;
  error: string | null;
  filename: string | null;
}

export function FileUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    loading: false,
    success: false,
    error: null,
    filename: null,
  });

  const addFile = useFileSystemStore(state => state.addFile);
  const setFileMeta = useFileSystemStore(state => state.setFileMeta);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus({
      loading: true,
      success: false,
      error: null,
      filename: file.name,
    });

    try {
      console.log(`📤 Uploading: ${file.name}`);
      
      // Upload to backend for RAG indexing
      const result = await uploadDocument(file);
      
      console.log(`✅ Upload successful:`, result);
      
      // Add to file system (for display purposes)
      // Store the actual saved filename from backend (with timestamp)
      const savedFilename = result?.filename || file.name;
      const newId = addFile(file.name, getFileType(file.name), undefined, `[Uploaded file: ${file.name}]`);
      if (result?.id) {
        setFileMeta(newId, { docId: result.id, savedFilename });
      }
      
      // Show warning if parsing failed but upload succeeded
      const warningMessage = (result as any)?.warning;
      
      setUploadStatus({
        loading: false,
        success: true,
        error: warningMessage || null,
        filename: file.name,
      });

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadStatus({
          loading: false,
          success: false,
          error: null,
          filename: null,
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);
      
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus({
        loading: false,
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        filename: file.name,
      });
      
      // Reset error after 5 seconds
      setTimeout(() => {
        setUploadStatus({
          loading: false,
          success: false,
          error: null,
          filename: null,
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 5000);
    }
  };

  const getFileType = (filename: string): 'txt' | 'md' | 'pdf' | 'docx' | 'xlsx' | 'tex' | 'folder' => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx' || ext === 'doc') return 'docx';
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'md') return 'md';
    if (ext === 'tex') return 'tex';
    return 'txt';
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.pptx,.ppt,.csv,.json,.tex"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <button
        onClick={handleButtonClick}
        disabled={uploadStatus.loading}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg
                   bg-blue-500 hover:bg-blue-600 text-white
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors duration-200"
        title="Upload PDF, DOCX, Excel, PowerPoint, or text files"
      >
        {uploadStatus.loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Uploading...
          </>
        ) : uploadStatus.success ? (
          <>
            <CheckCircle2 size={16} />
            Uploaded!
          </>
        ) : uploadStatus.error ? (
          <>
            <XCircle size={16} />
            Failed
          </>
        ) : (
          <>
            <Upload size={16} />
            Upload File
          </>
        )}
      </button>

      {/* Status message */}
      {(uploadStatus.loading || uploadStatus.success || uploadStatus.error) && (
        <div className="absolute top-full mt-2 left-0 right-0 z-10">
          <div
            className={`text-xs px-3 py-2 rounded-lg ${
              uploadStatus.success
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700'
                : uploadStatus.error
                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
            }`}
          >
            {uploadStatus.loading && (
              <p>Uploading {uploadStatus.filename}...</p>
            )}
            {uploadStatus.success && !uploadStatus.error && (
              <p>✅ {uploadStatus.filename} uploaded and indexed!</p>
            )}
            {uploadStatus.success && uploadStatus.error && (
              <p>⚠️ {uploadStatus.filename} uploaded but: {uploadStatus.error}</p>
            )}
            {!uploadStatus.success && uploadStatus.error && (
              <p>❌ {uploadStatus.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

