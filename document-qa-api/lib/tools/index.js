import { readFile } from './readFile.js';
import { listDir } from './listDir.js';
import { grepFiles } from './grepFiles.js';
import { extractDocument } from './extractDocument.js';

/**
 * Get tool handlers with workspace context
 */
export function getToolHandlers(uploadsDir) {
  return {
    read_file: (args) => readFile(args, uploadsDir),
    list_dir: (args) => listDir(args, uploadsDir),
    grep_files: (args) => grepFiles(args, uploadsDir),
    extract_document: (args) => extractDocument(args, uploadsDir)
  };
}

/**
 * Get tool specifications for Groq function calling
 */
export function getToolSpecs() {
  return [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the contents of a file. Returns the file content as text.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read (relative to uploads directory)'
            }
          },
          required: ['path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description: 'List files and directories in a given path.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory to list (relative to uploads directory, use "." for root)'
            }
          },
          required: ['path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'grep_files',
        description: 'Search for a pattern in files within a directory.',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'The text pattern to search for'
            },
            path: {
              type: 'string',
              description: 'Directory to search in (relative to uploads directory, use "." for all files)'
            }
          },
          required: ['pattern', 'path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'extract_document',
        description: 'Extract full text content from a document (PDF, DOCX, TXT).',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the document file (relative to uploads directory)'
            }
          },
          required: ['path']
        }
      }
    }
  ];
}

