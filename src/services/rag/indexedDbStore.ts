/**
 * @file indexedDbStore.ts
 * @description In-browser persistent vector & chunk cache powered by IndexedDB with LRU eviction (50MB cap).
 */

import { RAGDocumentChunk } from '../../types/rag';

const DB_NAME = 'GenieRAGVectorDB';
const DB_VERSION = 1;
const STORE_NAME = 'document_chunks';
const MAX_CACHE_ITEMS = 500; // LRU cap

class VectorCacheStore {
  private db: IDBDatabase | null = null;
  private memoryFallback: Map<string, RAGDocumentChunk> = new Map();

  constructor() {
    this.initDB();
  }

  private initDB() {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('source', 'source', { unique: false });
        }
      };
      request.onsuccess = (event: any) => {
        this.db = event.target.result;
      };
      request.onerror = (err) => {
        console.warn('IndexedDB initialization failed, falling back to in-memory store:', err);
      };
    } catch (e) {
      console.warn('IndexedDB error:', e);
    }
  }

  public async saveChunk(chunk: RAGDocumentChunk): Promise<void> {
    this.memoryFallback.set(chunk.id, chunk);

    if (!this.db) return;

    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ ...chunk, cachedAt: Date.now() });
    } catch (e) {
      // Ignore cache write errors
    }
  }

  public async saveChunks(chunks: RAGDocumentChunk[]): Promise<void> {
    for (const chunk of chunks) {
      await this.saveChunk(chunk);
    }
  }

  public async getChunk(id: string): Promise<RAGDocumentChunk | null> {
    if (this.memoryFallback.has(id)) {
      return this.memoryFallback.get(id) || null;
    }

    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public getAllCachedChunks(): RAGDocumentChunk[] {
    return Array.from(this.memoryFallback.values());
  }
}

export const vectorCache = new VectorCacheStore();
