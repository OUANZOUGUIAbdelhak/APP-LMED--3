import Groq from 'groq-sdk';
import { v4 as uuidv4 } from 'uuid';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Simple in-memory vector store with cosine similarity search
 * For production, replace with Pinecone, Weaviate, or Qdrant
 */
export class VectorStore {
  constructor() {
    this.documents = new Map(); // docId -> { segments: [...], embeddings: [...] }
  }

  /**
   * Generate embeddings using a simple hash-based approach
   * For production, use proper embedding models (OpenAI, Cohere, etc.)
   */
  async generateEmbedding(text) {
    // Simple TF-IDF-like embedding for demo purposes
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const embedding = new Array(384).fill(0);
    
    words.forEach((word, idx) => {
      const hash = this.hashCode(word);
      embedding[Math.abs(hash) % 384] += 1;
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  /**
   * Cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  /**
   * Index a document with its segments
   */
  async indexDocument(docId, segments) {
    console.log(`[VectorStore] Indexing document: ${docId} with ${segments.length} segments`);
    
    const embeddings = await Promise.all(
      segments.map(seg => this.generateEmbedding(seg.content))
    );

    this.documents.set(docId, { segments, embeddings });
    return docId;
  }

  /**
   * Search for similar segments across documents
   */
  async search(query, topK = 5, documentIds = null) {
    const queryEmbedding = await this.generateEmbedding(query);
    const results = [];

    // Filter documents if specific IDs provided
    const docsToSearch = documentIds 
      ? Array.from(this.documents.entries()).filter(([id]) => documentIds.includes(id))
      : Array.from(this.documents.entries());

    for (const [docId, { segments, embeddings }] of docsToSearch) {
      for (let i = 0; i < segments.length; i++) {
        const score = this.cosineSimilarity(queryEmbedding, embeddings[i]);
        results.push({
          docId,
          content: segments[i].content,
          score,
          metadata: segments[i].metadata
        });
      }
    }

    // Sort by score and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Get all indexed documents
   */
  getDocuments() {
    return Array.from(this.documents.entries()).map(([docId, data]) => ({
      docId,
      segmentCount: data.segments.length
    }));
  }

  /**
   * Delete a document from the store
   */
  async deleteDocument(docId) {
    this.documents.delete(docId);
    console.log(`[VectorStore] Deleted document: ${docId}`);
  }

  /**
   * Clear all documents
   */
  clear() {
    this.documents.clear();
  }
}

