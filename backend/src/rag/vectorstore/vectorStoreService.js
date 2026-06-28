const { Chroma } = require("@langchain/community/vectorstores/chroma");
const embeddingService = require("../embeddings/embeddingService");

class VectorStoreService {
  constructor() {
    this.collectionName = "eduagent_rag";
    this.chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
    this.vectorStore = null;
  }

  /**
   * Get or initialize the Chroma vector store
   * @returns {Promise<Chroma>}
   */
  async getStore() {
    if (!this.vectorStore) {
      console.log(`[VectorStoreService] Connecting to ChromaDB at ${this.chromaUrl}, collection: ${this.collectionName}`);
      this.vectorStore = new Chroma(embeddingService.embeddings, {
        collectionName: this.collectionName,
        url: this.chromaUrl,
      });
    }
    return this.vectorStore;
  }

  /**
   * Add parsed chunks to ChromaDB
   * @param {Object[]} documents - Array of Langchain Document objects { pageContent, metadata }
   */
  async addChunks(documents) {
    try {
      const store = await this.getStore();
      await store.addDocuments(documents);
      console.log(`[VectorStoreService] Successfully added ${documents.length} chunks to ChromaDB.`);
    } catch (error) {
      console.error("[VectorStoreService Error - addChunks]:", error);
      throw error;
    }
  }

  /**
   * Perform similarity search on ChromaDB
   * @param {string} query - User question
   * @param {number} limit - Number of chunks to return (default 5)
   * @param {Object} filter - Chroma metadata filter (e.g. { course: "DBMS", studentId: "..." })
   * @returns {Promise<Object[]>} - Array of matched documents
   */
  async similaritySearch(query, limit = 5, filter = {}) {
    try {
      const store = await this.getStore();
      // Ensure the filter structure is compatible with ChromaDB
      // If filter keys have empty values, clean them up
      const activeFilter = {};
      Object.keys(filter).forEach(key => {
        if (filter[key] !== undefined && filter[key] !== null && filter[key] !== '') {
          activeFilter[key] = filter[key];
        }
      });

      const keys = Object.keys(activeFilter);
      let queryFilter = undefined;
      if (keys.length === 1) {
        queryFilter = activeFilter;
      } else if (keys.length > 1) {
        queryFilter = {
          "$and": keys.map(k => ({ [k]: activeFilter[k] }))
        };
      }

      console.log(`[VectorStoreService] Searching vector store with query: "${query}", filter:`, queryFilter);
      return await store.similaritySearch(query, limit, queryFilter);
    } catch (error) {
      console.error("[VectorStoreService Error - similaritySearch]:", error);
      throw error;
    }
  }

  /**
   * Delete document chunks from ChromaDB
   * @param {string} filename 
   * @param {string} studentId 
   * @param {string} courseId 
   */
  async deleteChunks(filename, studentId, courseId) {
    try {
      const store = await this.getStore();
      const collection = store.collection;
      if (collection && typeof collection.delete === 'function') {
        const filter = {
          "$and": [
            { "filename": filename },
            { "studentId": studentId }
          ]
        };
        console.log(`[VectorStoreService] Deleting Chroma chunks for: ${filename}, student: ${studentId}`);
        await collection.delete({ where: filter });
      }
    } catch (error) {
      console.error("[VectorStoreService Error - deleteChunks]:", error);
    }
  }
}

module.exports = new VectorStoreService();
