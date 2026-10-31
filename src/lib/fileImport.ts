// Reads text from files the student chooses. Everything happens inside this browser:
// files are never uploaded to a server or shared.
export const SUPPORTED_FILES = {
  accept: '.pdf,.txt,.md,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  description: 'PDF with selectable text, Word (.docx), or plain text (.txt, .md). Up to 15 MB.',
};
const MAX_BYTES = 15 * 1024 * 1024;

export class ImportError extends Error {}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new ImportError('This file is larger than 15 MB. Try a smaller file or paste the relevant pages instead.');
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type === 'text/plain') {
    return file.text();
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return pdfText(file);
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    if (!value.trim()) throw new ImportError('No text was found in this Word document.');
    return value;
  }
  if (name.endsWith('.doc')) throw new ImportError('Older Word files (.doc) are not supported. Save the file as .docx or PDF, or copy and paste the text.');
  if (/\.(png|jpe?g|heic|gif|webp)$/.test(name)) throw new ImportError('Images and photos are not supported yet because reading text from pictures is unreliable. Paste the text instead.');
  throw new ImportError('This file type is not supported. Use a PDF, .docx, .txt, or .md file — or paste the text.');
}

async function pdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // The PDF reader runs in a background worker that is bundled with the app (no outside requests).
  const { default: PdfWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline');
  if (!pdfjs.GlobalWorkerOptions.workerPort) pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (/password/i.test(msg)) throw new ImportError('This PDF is password-protected. Remove the password or paste the text instead.');
    throw new ImportError('This PDF could not be opened. It may be damaged. Try pasting the text instead.');
  }
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild lines using the vertical position of each text piece.
    let lastY: number | null = null;
    let line = '';
    const lines: string[] = [];
    for (const item of content.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
      const y = item.transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = '';
      }
      line += (line && !line.endsWith(' ') ? ' ' : '') + item.str;
      lastY = y;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
        lastY = null;
      }
    }
    if (line) lines.push(line);
    pages.push(lines.map((l) => l.replace(/\s{2,}/g, ' ').trim()).filter(Boolean).join('\n'));
  }
  const text = pages.join('\n\n');
  if (text.replace(/\s/g, '').length < 20) {
    throw new ImportError('No selectable text was found. This PDF may be a scanned image. Paste the text instead, or use a text-based PDF.');
  }
  return text;
}
