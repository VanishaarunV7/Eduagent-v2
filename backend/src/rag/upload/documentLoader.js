const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { Document } = require("langchain");

/**
 * Load PDF document, extract text and split into chunks
 * @param {string} filePath - Path to the PDF file
 * @param {Object} metadataBase - Metadata like studentId, course, filename, uploadDate
 * @returns {Promise<{ documents: Document[], pages: number, chunksCount: number }>}
 */
async function loadAndSplitPDF(filePath, metadataBase = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    
    // Parse the PDF using PDFParse class API
    const parser = new PDFParse({ data: dataBuffer });
    const textResult = await parser.getText();
    const text = textResult.text;
    const pages = textResult.pages ? textResult.pages.length : 1;

    if (!text || !text.trim()) {
      throw new Error("No text content could be extracted from the PDF.");
    }

    // Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitText(text);

    // Create Document objects with metadata
    const documents = chunks.map((chunk, index) => {
      return new Document({
        pageContent: chunk,
        metadata: {
          ...metadataBase,
          chunkIndex: index,
        }
      });
    });

    return {
      documents,
      pages,
      chunksCount: documents.length
    };
  } catch (error) {
    console.error("[DocumentLoader Error]:", error);
    throw error;
  }
}

module.exports = {
  loadAndSplitPDF
};
