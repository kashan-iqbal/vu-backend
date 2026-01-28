import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { openai } from "../../config/openai";

export async function chunk(text: string, chunkSize = 800, overlap = 100) {
  const chunks: string[] = [];

  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));

    i += chunkSize - overlap;
  }

  return chunks;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;

  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    text += strings.join(" ") + "\n";
  }

  return text;
}

export async function summarizeText(text: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Summarize the following text in short bullet points.",
      },
      { role: "user", content: text },
    ],
  });

  return response.choices[0].message?.content || "";
}
