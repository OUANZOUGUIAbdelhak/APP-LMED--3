import fs from 'fs/promises';
import path from 'path';

/**
 * List directory contents (workspace-aware)
 */
export async function listDir({ path: dirPath }, uploadsDir) {
  try {
    const fullPath = path.resolve(uploadsDir, dirPath === '.' ? '' : dirPath);
    
    // Security check: ensure path is within uploads directory
    if (!fullPath.startsWith(uploadsDir)) {
      throw new Error('Access denied: path outside workspace');
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    
    const files = entries
      .filter(e => e.isFile())
      .map(e => e.name);
    
    const directories = entries
      .filter(e => e.isDirectory())
      .map(e => e.name);

    return { files, directories, path: dirPath };
  } catch (error) {
    throw new Error(`Failed to list directory: ${error.message}`);
  }
}

