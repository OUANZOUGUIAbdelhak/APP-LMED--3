import fs from 'fs';
import path from 'path';
import { pipeline } from '@xenova/transformers';

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export class VectorStore {
  constructor(indexPath) {
    this.indexPath = indexPath;
    this.index = { documents: {}, chunks: [] };
    this.embedder = null;
    this._load();
  }

  async _getEmbedder() {
    if (!this.embedder) {
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return this.embedder;
  }

  _load() {
    try {
      if (fs.existsSync(this.indexPath)) {
        const raw = fs.readFileSync(this.indexPath, 'utf8');
        this.index = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to load index, starting fresh');
      this.index = { documents: {}, chunks: [] };
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.indexPath), { recursive: true });
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf8');
  }

  countDocuments() {
    return Object.keys(this.index.documents).length;
  }

  async _embed(text) {
    const extractor = await this._getEmbedder();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array
    return Array.from(output.data);
  }

  async indexDocument({ id, filename, segments }) {
    this.index.documents[id] = { id, filename, createdAt: Date.now() };
    for (const seg of segments) {
      const embedding = await this._embed(seg.text);
      this.index.chunks.push({
        docId: id,
        filename,
        text: seg.text,
        page: seg.page || null,
        sheet: seg.sheet || null,
        sheetIndex: typeof seg.sheetIndex === 'number' ? seg.sheetIndex : null,
        lineStart: seg.lineStart,
        lineEnd: seg.lineEnd,
        embedding
      });
    }
    this._save();
  }

  async search(query, topK = 5, restrictDocIds = undefined) {
    const q = await this._embed(query);
    const scores = [];
    for (const ch of this.index.chunks) {
      if (Array.isArray(restrictDocIds) && restrictDocIds.length > 0 && !restrictDocIds.includes(ch.docId)) {
        continue;
      }
      const score = cosineSimilarity(q, ch.embedding);
      scores.push({ ...ch, score });
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}


