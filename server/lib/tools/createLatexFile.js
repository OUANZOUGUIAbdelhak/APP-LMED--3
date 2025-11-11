import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { parseTextDirect } from '../parser.js';

/**
 * Create a new LaTeX file with article content
 * @param {object} args - { filename: string, topic: string, title?: string, author?: string }
 * @param {object} context - { uploadsDir: string, vectorStore?: VectorStore }
 * @returns {Promise<string>}
 */
export async function createLatexFile({ filename, topic, title, author }, { uploadsDir, vectorStore }) {
  if (!filename) {
    throw new Error('filename is required');
  }
  if (!topic) {
    throw new Error('topic is required');
  }

  // Ensure filename ends with .tex
  const safeName = path.basename(filename);
  const texFilename = safeName.endsWith('.tex') ? safeName : `${safeName}.tex`;
  const filePath = path.join(uploadsDir, texFilename);

  // Check if file already exists
  if (fs.existsSync(filePath)) {
    throw new Error(`File already exists: ${texFilename}. Please choose a different filename.`);
  }

  // Generate LaTeX content
  const articleTitle = title || `${topic.charAt(0).toUpperCase() + topic.slice(1)}: An Overview`;
  const articleAuthor = author || 'Author';
  
  const latexContent = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{geometry}
\\geometry{margin=1in}

\\title{${articleTitle}}
\\author{${articleAuthor}}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
This article provides an overview of ${topic}. It explores the fundamental concepts, key principles, and current developments in this field.
\\end{abstract}

\\section{Introduction}

${topic} represents a fascinating and rapidly evolving field that has significant implications for various domains. This article aims to provide a comprehensive overview of the key aspects, principles, and applications of ${topic}.

\\section{Background and Fundamentals}

Understanding ${topic} requires a solid grasp of its foundational concepts. The field encompasses several important principles that form the basis for more advanced topics and applications.

\\section{Key Concepts and Principles}

In this section, we explore the main concepts and principles that define ${topic}. These include:

\\begin{itemize}
\\item Fundamental principles and theories
\\item Core methodologies and approaches
\\item Important frameworks and models
\\end{itemize}

\\section{Applications and Use Cases}

${topic} finds applications across numerous domains. Some notable examples include:

\\begin{itemize}
\\item Practical applications in industry
\\item Research and academic applications
\\item Emerging use cases and innovations
\\end{itemize}

\\section{Current Developments and Future Directions}

The field of ${topic} continues to evolve, with new developments emerging regularly. Current research focuses on advancing our understanding and expanding the practical applications of these concepts.

\\section{Conclusion}

This article has provided an overview of ${topic}, covering its fundamental concepts, key principles, and various applications. As the field continues to develop, we can expect to see further innovations and expanded applications in the future.

\\begin{thebibliography}{9}
\\bibitem{ref1}
Example reference. \\textit{Journal Name}, Volume, Pages, Year.
\\end{thebibliography}

\\end{document}
`;

  try {
    // Write the LaTeX file
    fs.writeFileSync(filePath, latexContent, 'utf8');
    
    // Index the file in vector store if available
    let docId = null;
    if (vectorStore) {
      try {
        const parsed = await parseTextDirect(latexContent, texFilename);
        docId = uuidv4();
        await vectorStore.indexDocument({
          id: docId,
          filename: texFilename,
          segments: parsed.segments.map(seg => ({ ...seg, filename: texFilename }))
        });
        console.log(`✅ Indexed created LaTeX file: ${texFilename} (${docId})`);
      } catch (indexErr) {
        console.error('Failed to index created file:', indexErr);
        // Continue even if indexing fails
      }
    }
    
    // Return structured response with metadata
    const response = {
      success: true,
      message: `Successfully created LaTeX file: ${texFilename}\n\nI've created an article template about "${topic}" with the following structure:\n- Title: ${articleTitle}\n- Author: ${articleAuthor}\n- Sections: Introduction, Background, Key Concepts, Applications, Current Developments, and Conclusion\n- Includes abstract and bibliography template\n\nThe file is ready for you to edit and customize. You can compile it with a LaTeX compiler like pdflatex or use an online LaTeX editor.`,
      filename: texFilename,
      docId: docId,
      topic: topic,
      title: articleTitle
    };
    
    // Return as JSON string so agent can parse it
    return JSON.stringify(response);
  } catch (err) {
    throw new Error(`Failed to create LaTeX file: ${err.message}`);
  }
}

export const createLatexFileToolSpec = {
  type: 'function',
  function: {
    name: 'create_latex_file',
    description: 'Create a new LaTeX (.tex) file with article content about a specified topic. Use this when the user asks to create an article, paper, or document about a topic. The tool will generate a complete LaTeX article structure with sections, abstract, and bibliography template.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename for the LaTeX file (e.g., "machine_learning_article.tex" or "ml_paper"). If no .tex extension is provided, it will be added automatically.',
        },
        topic: {
          type: 'string',
          description: 'The topic or subject of the article (e.g., "machine learning", "quantum computing", "climate change")',
        },
        title: {
          type: 'string',
          description: 'Optional custom title for the article. If not provided, a title will be generated based on the topic.',
        },
        author: {
          type: 'string',
          description: 'Optional author name. If not provided, defaults to "Author".',
        },
      },
      required: ['filename', 'topic'],
    },
  },
};

