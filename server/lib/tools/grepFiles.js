import { spawn } from 'child_process';
import path from 'path';

/**
 * Codex-style grep_files tool using ripgrep (workspace-aware)
 * @param {string} pattern - Regex pattern to search
 * @param {string} search_path - Directory or file to search (default workspace root)
 * @param {string} include - Optional glob pattern to filter files
 * @param {number} limit - Max results to return (default 100)
 * @param {object} context - Tool context with uploadsDir
 * @returns {Promise<string>}
 */
export async function grepFiles({ pattern, search_path = '.', include, limit = 100 }, { uploadsDir }) {
  if (!pattern || pattern.trim() === '') {
    throw new Error('pattern must not be empty');
  }
  if (limit < 1) {
    throw new Error('limit must be greater than zero');
  }

  // Resolve search path within workspace
  let resolvedPath = search_path;
  if (!path.isAbsolute(search_path)) {
    resolvedPath = path.join(uploadsDir, search_path);
  }

  const args = [
    '--files-with-matches',
    '--sortr=modified',
    '--regexp', pattern,
    '--no-messages'
  ];

  if (include) {
    args.push('--glob', include);
  }

  args.push('--', resolvedPath);

  return new Promise((resolve, reject) => {
    const proc = spawn('rg', args, { timeout: 30000 });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      if (code === 0) {
        const lines = stdout.trim().split('\n').filter(Boolean).slice(0, limit);
        resolve(lines.length > 0 ? lines.join('\n') : 'No matches found.');
      } else if (code === 1) {
        resolve('No matches found.');
      } else {
        reject(new Error(`rg failed: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to launch rg: ${err.message}. Ensure ripgrep is installed.`));
    });
  });
}

export const grepFilesToolSpec = {
  type: 'function',
  function: {
    name: 'grep_files',
    description: 'Search for files in the workspace that match a regex pattern. Returns file paths with matches.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern to search for in file contents.'
        },
        search_path: {
          type: 'string',
          description: 'Relative path within workspace to search (default "." for root).',
          default: '.'
        },
        include: {
          type: 'string',
          description: 'Optional glob pattern to filter files (e.g. "*.js").'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of file paths to return (default 100).',
          default: 100
        }
      },
      required: ['pattern']
    }
  }
};

