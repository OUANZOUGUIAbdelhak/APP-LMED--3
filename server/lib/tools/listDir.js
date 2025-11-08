import fs from 'fs/promises';
import path from 'path';

/**
 * Codex-style list_dir tool (workspace-aware)
 * @param {string} target_directory - Directory to list (relative to workspace or absolute)
 * @param {boolean} recursive - Whether to list recursively (default false)
 * @param {object} context - Tool context with uploadsDir
 * @returns {Promise<string>}
 */
export async function listDir({ target_directory = '.', recursive = false }, { uploadsDir }) {
  // If relative path or '.', resolve within workspace
  let resolvedPath = target_directory;
  if (!path.isAbsolute(target_directory)) {
    resolvedPath = path.join(uploadsDir, target_directory);
  }

  const stats = await fs.stat(resolvedPath);
  if (!stats.isDirectory()) {
    throw new Error('target_directory must be a directory');
  }

  const entries = [];

  async function walk(dir, prefix = '') {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.')) continue; // skip dot files
      const fullPath = path.join(dir, item.name);
      const displayPath = prefix ? `${prefix}/${item.name}` : item.name;

      if (item.isDirectory()) {
        entries.push(`${displayPath}/`);
        if (recursive) {
          await walk(fullPath, displayPath);
        }
      } else {
        entries.push(displayPath);
      }
    }
  }

  await walk(resolvedPath);
  return entries.length > 0 ? entries.join('\n') : '(empty directory)';
}

export const listDirToolSpec = {
  type: 'function',
  function: {
    name: 'list_dir',
    description: 'List files and directories in the workspace (uploaded documents). Returns one entry per line, directories end with /. Use "." to list the root workspace.',
    parameters: {
      type: 'object',
      properties: {
        target_directory: {
          type: 'string',
          description: 'Relative path within workspace (default "." for root).',
          default: '.'
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list recursively (default false).',
          default: false
        }
      },
      required: []
    }
  }
};

