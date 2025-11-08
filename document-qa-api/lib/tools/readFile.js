import fs from 'fs/promises';
import path from 'path';

/**
 * Read file contents (workspace-aware)
 */
export async function readFile({ path: filePath }, uploadsDir) {
  try {
    const fullPath = path.resolve(uploadsDir, filePath);
    
    // Security check: ensure path is within uploads directory
    if (!fullPath.startsWith(uploadsDir)) {
      throw new Error('Access denied: path outside workspace');
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    return { content, path: filePath };
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

