const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/huggingface_transformers");

class EmbeddingService {
  constructor() {
    console.log("[EmbeddingService] Initializing HuggingFaceTransformersEmbeddings with Xenova/all-MiniLM-L6-v2...");
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: "Xenova/all-MiniLM-L6-v2",
    });
  }

  /**
   * Generate embeddings for an array of documents/texts
   * @param {string[]} texts 
   * @returns {Promise<number[][]>}
   */
  async embedDocuments(texts) {
    try {
      return await this.embeddings.embedDocuments(texts);
    } catch (error) {
      console.error("[EmbeddingService Error - embedDocuments]:", error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single query string
   * @param {string} text 
   * @returns {Promise<number[]>}
   */
  async embedQuery(text) {
    try {
      return await this.embeddings.embedQuery(text);
    } catch (error) {
      console.error("[EmbeddingService Error - embedQuery]:", error);
      throw error;
    }
  }
}

module.exports = new EmbeddingService();
