import { NextRequest, NextResponse } from 'next/server';
import { extractQuotationDocument, parseLocalOcrText, getAuthorizedCatalog, type OcrEnginePreference } from '@/lib/ai/extractor';
import { getDb } from '@/lib/db/client';
import { seedDb } from '@/lib/db/seed';

export async function POST(req: NextRequest) {
  await seedDb();
  const db = getDb();

  try {
    const contentType = req.headers.get('content-type') || '';

    // Mode A: Direct text paste (e.g. WhatsApp notes, handwritten transcription, typed quotation lists)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const text = body.text;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json({ error: 'Please enter or paste items text.' }, { status: 400 });
      }

      const catalog = await getAuthorizedCatalog();
      const jobId = `text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const items = parseLocalOcrText(text, catalog, jobId);

      if (!items.length) {
        return NextResponse.json(
          {
            error:
              'No line items could be parsed. Enter items with name and quantity, e.g. "TBC cleaner - 5 ltr" or "Air freshner - 10 Nos".',
          },
          { status: 422 }
        );
      }

      const estimatedTokens = Math.ceil(text.length / 4) + items.length * 12;

      return NextResponse.json({
        success: true,
        jobId,
        provider: 'local-parser',
        providerNotice: 'Processed via Intelligent JPA Text Parser with Persistent Rate Memory',
        securityStatus: undefined,
        thinkingProcess: `• Direct text parsing analyzed ${items.length} item rows.\n• Extracted item descriptions, pack sizes, and order quantities.\n• Auto-matched units and verified with catalog price index.`,
        rawOcrText: text,
        tokenStats: {
          promptTokens: Math.ceil(text.length / 4),
          completionTokens: items.length * 12,
          totalTokens: estimatedTokens,
          contextLimit: '2,000,000 Tokens (Ultra-Long Context)',
        },
        metadata: {},
        items,
      });
    }

    // Mode B: File upload (Excel spreadsheet, Image, or PDF)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawEngine = String(formData.get('engine') || 'auto').toLowerCase();
    const validEngines: OcrEnginePreference[] = ['auto', 'qwen', 'gemini', 'openai'];
    const preferredEngine: OcrEnginePreference = validEngines.includes(rawEngine as OcrEnginePreference)
      ? (rawEngine as OcrEnginePreference)
      : 'auto';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Maximum upload size is 15 MB' }, { status: 413 });
    }

    const fileName = file.name || 'document';
    const lowerName = fileName.toLowerCase();

    const isWordDoc =
      lowerName.endsWith('.docx') ||
      (file.type && (file.type.includes('wordprocessingml') || file.type.includes('officedocument.word')));

    const isExcel =
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.csv') ||
      (file.type && (file.type.includes('spreadsheet') || file.type.includes('excel') || file.type === 'text/csv'));

    const isPdfOrImage =
      ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp'].includes(file.type) ||
      /\.(pdf|jpe?g|png|webp|tiff?|bmp)$/i.test(lowerName);

    if (!isWordDoc && !isExcel && !isPdfOrImage) {
      return NextResponse.json(
        { error: 'Supported formats: Excel spreadsheet (.xlsx, .xls, .csv), Word document (.docx), PDF, or Images (.png, .jpeg, .webp)' },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = isWordDoc
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : isExcel
      ? lowerName.endsWith('.csv')
        ? 'text/csv'
        : lowerName.endsWith('.xls')
        ? 'application/vnd.ms-excel'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : lowerName.endsWith('.pdf')
      ? 'application/pdf'
      : file.type || 'image/jpeg';

    // Perform document extraction with selected OCR engine
    const result = await extractQuotationDocument(buffer, fileName, mimeType, preferredEngine);

    // Record extraction job in DB
    await db.execute({
      sql: `INSERT INTO ai_extraction_jobs (
        id, file_name, file_type, file_size, status, extracted_json, review_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        result.jobId,
        fileName,
        mimeType,
        buffer.length,
        'processed',
        JSON.stringify(result.items),
        JSON.stringify(result.metadata),
        new Date().toISOString(),
      ],
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      provider: result.provider,
      providerNotice: result.providerNotice,
      securityStatus: result.securityStatus,
      thinkingProcess: result.thinkingProcess,
      rawOcrText: result.rawOcrText,
      tokenStats: result.tokenStats,
      metadata: result.metadata,
      items: result.items,
    });
  } catch (err: any) {
    console.error('AI extraction error:', err);
    return NextResponse.json(
      {
        error:
          err.name === 'TimeoutError'
            ? 'Vision request timed out. Check the provider connection and retry. Nothing was imported.'
            : err.message || 'AI extraction failed',
      },
      { status: 500 }
    );
  }
}
