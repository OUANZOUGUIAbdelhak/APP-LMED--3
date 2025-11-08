/**
 * Simple in-memory chat history store
 * For production, use Redis or a database
 */
export class MemoryStore {
  constructor(maxMessages = 20) {
    this.sessions = new Map(); // sessionId -> messages[]
    this.maxMessages = maxMessages;
  }

  /**
   * Get chat history for a session
   */
  get(sessionId) {
    return this.sessions.get(sessionId) || [];
  }

  /**
   * Add a message to session history
   */
  add(sessionId, message) {
    const history = this.get(sessionId);
    history.push(message);

    // Keep only last N messages
    if (history.length > this.maxMessages) {
      history.shift();
    }

    this.sessions.set(sessionId, history);
  }

  /**
   * Clear session history
   */
  clear(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions
   */
  clearAll() {
    this.sessions.clear();
  }
}

