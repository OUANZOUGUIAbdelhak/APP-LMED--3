export class MemoryStore {
  constructor() {
    this.map = new Map();
    this.maxTurns = 10;
  }

  getHistory(sessionId) {
    return this.map.get(sessionId) || [];
  }

  append(sessionId, userMsg, assistantMsg) {
    const arr = this.getHistory(sessionId).slice();
    arr.push({ role: 'user', content: userMsg.content });
    arr.push({ role: 'assistant', content: assistantMsg.content });
    // cap
    while (arr.length > this.maxTurns * 2) arr.shift();
    this.map.set(sessionId, arr);
  }

  clear(sessionId) {
    this.map.delete(sessionId);
  }
}


