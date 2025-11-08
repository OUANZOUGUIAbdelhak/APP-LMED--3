import fs from 'fs/promises';
import path from 'path';

/**
 * Search for pattern in files (workspace-aware)
 */
export async function grepFiles({ pattern, path: searchPath }, uploadsDir) {
  try {
    const fullPath = path.resolve(uploadsDir, searchPath === '.' ? '' : searchPath);
    
    // Security check: ensure path is within uploads directory
    if (!fullPath.startsWith(uploadsDir)) {
      throw new Error('Access denied: path outside workspace');
    }

    const results = [];
    
    async function searchDir(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await searchDir(entryPath);
        } else if (entry.isFile()) {
          try {
            const content = await fs.readFile(entryPath, 'utf-8');
            const lines = content.split('\n');
            
            lines.forEach((line, idx) => {
              if (line.toLowerCase().includes(pattern.toLowerCase())) {
                results.push({
                  file: path.relative(uploadsDir, entryPath),
                  line: idx + 1,
                  content: line.trim()
                });
              }
            });
          } catch (err) {
            // Skip files that can't be read as text
          }
        }
      }
    }

    await searchDir(fullPath);
    
    return { matches: results, pattern, searchPath };
  } catch (error) {
    throw new Error(`Failed to search files: ${error.message}`);
  }
}

