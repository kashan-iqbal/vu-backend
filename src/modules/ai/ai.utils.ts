// ============================================
// AI Utility Functions
// ============================================

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { openai } from "../../config/openai";
import { ProcessingError, ValidationError } from "./ai.types";

/**
 * Chunk text with configurable size and overlap
 */
export async function chunkText(
  text: string,
  chunkSize = 800,
  overlap = 100
): Promise<string[]> {
  if (!text || !text.trim()) {
    throw new ValidationError("Cannot chunk empty text");
  }

  if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new ValidationError("Invalid chunk size or overlap parameters");
  }

  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize);

    // Only add non-empty chunks
    if (chunk.trim()) {
      chunks.push(chunk);
    }

    i += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Extract text from PDF buffer with error handling
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    if (!buffer || buffer.length === 0) {
      throw new ValidationError("PDF buffer is empty");
    }

    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    if (!pdf || pdf.numPages === 0) {
      throw new ProcessingError("PDF has no pages");
    }

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str || "");
        text += strings.join(" ") + "\n";
      } catch (pageError) {
        console.error(`Error processing page ${i}:`, pageError);
        // Continue with other pages
      }
    }

    const cleanedText = text.trim();

    if (!cleanedText) {
      throw new ProcessingError("PDF contains no extractable text");
    }

    return cleanedText;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(`Failed to extract text from PDF: ${error}`);
  }
}

/**
 * Summarize text using OpenAI
 */
export async function summarizeText(text: string): Promise<string> {
  try {
    if (!text || !text.trim()) {
      throw new ValidationError("Cannot summarize empty text");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "Summarize the following text in concise bullet points.",
        },
        { role: "user", content: text },
      ],
    });

    const summary = response.choices[0].message?.content;

    if (!summary) {
      throw new ProcessingError("OpenAI returned empty summary");
    }

    return summary;
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(`Failed to summarize text: ${error.message}`);
  }
}

/**
 * Generate embedding vector for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || !text.trim()) {
      throw new ValidationError("Cannot generate embedding for empty text");
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    const embedding = response.data[0]?.embedding;

    if (!embedding || embedding.length === 0) {
      throw new ProcessingError("OpenAI returned empty embedding");
    }

    return embedding;
  } catch (error: any) {
    if (error instanceof ValidationError || error instanceof ProcessingError) {
      throw error;
    }
    throw new ProcessingError(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Batch process items with progress tracking
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  batchSize = 5,
  onProgress?: (processed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, index) => processor(item, i + index))
    );
    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length);
    }
  }

  return results;
}

/**
 * Validate and sanitize user input
 */
export function sanitizeInput(input: string): string {
  if (!input) return "";

  // Remove excessive whitespace
  return input.trim().replace(/\s+/g, " ");
}

/**
 * Check if text is likely meaningful (not just symbols/numbers)
 */
export function isValidText(text: string, minLength = 10): boolean {
  if (!text || text.length < minLength) return false;

  // Check if at least 50% of characters are letters
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
  return letterCount >= text.length * 0.5;
}



//  Ai Responser Send to Client





export async function streamOpenAIResponse(
  messages: any[],
  onToken: any,
  temperature = 0.2
) {
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    temperature,
    messages,
  })

  let hasContent = false

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content
    if (token) {
      hasContent = true
      onToken(token)
    }
  }

  if (!hasContent) {
    onToken("No response generated. Please try again.")
  }
}
