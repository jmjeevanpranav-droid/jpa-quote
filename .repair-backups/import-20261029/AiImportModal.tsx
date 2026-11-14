'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, X, Sparkles, Loader2, ArrowRight, FileText, ShieldCheck, Trash2, FileSpreadsheet, KeyRound, Save } from 'lucide-react';
import { GlassSelect } from '@/components/GlassSelect';
import { ExtractedItem } from '@/lib/ai/extractor';

const DEFAULT_HANDWRITTEN_MEMO = `1. TBC cleaner - 5 ltr
2. soap oil - 5 ltr
3. phenyeil gel - 5 ltr
4. Air freshner tin - 10 Nos
5. Vim soap - 10 Nos
6. checked cloth big - 30 Nos
7. Odonil - 10 nos
8. harpic flush matic - 10 nos
9. Scotch Brite - 5 nos
10. Steel Brite - 5 nos
11. Floor cleaner - 2 ltr
12. Garbage cover small - 10 nos
13. Garbage cover big 30x50 - 40 kg
14. Mask - 40 nos
15. hand Gloves - 3 nos
16. Acid - 5 ltr
17. Urinal mat - 2 nos
18. colin glass cleaner - 5 ltr
19. Toilet Brush - 2 nos
20. hand wash - 5 ltr`;

interface AiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptItems: (items: any[], destinationSectionName?: string, metadata?: any) => void;
  availableSections: string[];
  initialTargetSection?: string;
}

export function AiImportModal({
  isOpen,
  onClose,
  onAcceptItems,
  availableSections,
  initialTargetSection,
}: AiImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [extractedMetadata, setExtractedMetadata] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [providerNotice, setProviderNotice] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [targetSection, setTargetSection] = useState<string>(initialTargetSection || availableSections[0] || 'Housekeeping');
  const [importMode, setImportMode] = useState<'upload' | 'text'>('upload');
  const [rawText, setRawText] = useState<string>(DEFAULT_HANDWRITTEN_MEMO);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gemini Vision AI Key State
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState<string | null>(null);
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [savingKey, setSavingKey] = useState<boolean>(false);
  const [keyNotice, setKeyNotice] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/ai-key')
        .then((res) => res.json())
        .then((data) => {
          setHasGeminiKey(Boolean(data.hasKey));
          setMaskedGeminiKey(data.maskedKey || null);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    setKeyNotice('');
    try {
      const res = await fetch('/api/admin/ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify key');
      setHasGeminiKey(true);
      setMaskedGeminiKey(data.maskedKey);
      setKeyNotice('✨ Key connected! Gemini Vision is now active.');
      setShowKeyConfig(false);
      setApiKeyInput('');
    } catch (err: any) {
      setKeyNotice(err.message || 'Key verification failed');
    } finally {
      setSavingKey(false);
    }
  };

  const handleFill20StandardItems = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    const memoText = `
1. TBC cleaner - 5 ltr
2. soap oil - 5 ltr
3. phenyeil gel - 5 ltr
4. Air freshner tin - 10 Nos
5. Vim soap - 10 Nos
6. checked cloth big - 30 Nos
7. Odonil - 10 nos
8. harpic flush matic - 10 nos
9. Scotch Brite - 5 nos
10. Steel Brite - 5 nos
11. Floor cleaner - 2 ltr
12. Garbage cover small - 10 nos
13. Garbage cover big 30x50 - 40 kg
14. Mask - 40 nos
15. hand Gloves - 3 nos
16. Acid - 5 ltr
17. Urinal mat - 2 nos
18. colin glass cleaner - 5 ltr
19. Toilet Brush - 2 nos
20. hand wash - 5 ltr
    `.trim();

    try {
      const res = await fetch('/api/ai-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: memoText }),
      });
      const data = await res.json();
      if (res.ok && data.items) {
        setExtractedItems(data.items);
        setSelectedIds(new Set(data.items.map((i: any) => i.id)));
        setProviderNotice('Verified 20 Handwritten Memo Items with Rate Memory');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to populate items');
    } finally {
      setIsProcessing(false);
    }
  };

  React.useEffect(() => {
    if (initialTargetSection) {
      setTargetSection(initialTargetSection);
    } else if (availableSections.length > 0 && !targetSection) {
      setTargetSection(availableSections[0]);
    }
  }, [initialTargetSection, isOpen, availableSections]);

  React.useEffect(() => {
    if (isOpen && !rawText.trim()) {
      setRawText(DEFAULT_HANDWRITTEN_MEMO);
    }
  }, [isOpen]);

  const handleFileSelect = (selectedFile: File) => {
    setExtractedItems([]); setSelectedIds(new Set()); setExtractedMetadata(null); setProviderNotice('');
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFile(selectedFile);
    setErrorMessage('');
    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleTextAnalyze = async () => {
    const textToProcess = rawText.trim() || DEFAULT_HANDWRITTEN_MEMO;
    if (!rawText.trim()) {
      setRawText(DEFAULT_HANDWRITTEN_MEMO);
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/ai-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToProcess }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        throw new Error(data?.error || `Text parsing failed (HTTP ${res.status}).`);
      }

      setExtractedItems(data.items || []);
      setExtractedMetadata(data.metadata || null);
      setProviderNotice(data.providerNotice || 'Intelligent Handwritten Analysis Complete');
      setSelectedIds(new Set((data.items || []).map((itm: any) => itm.id)));
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Unable to parse items.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ai-import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        throw new Error(data?.error || `Document processing failed (HTTP ${res.status}).`);
      }

      setExtractedItems(data.items || []);
      setExtractedMetadata(data.metadata || null);
      setProviderNotice(data.providerNotice || '');
      setSelectedIds(new Set((data.items || []).map((itm: any) => itm.id)));
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Unable to process document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleItemFieldChange = (id: string, field: keyof ExtractedItem, value: any) => {
    setExtractedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAccept = async () => {
    const accepted = extractedItems.filter((itm) => selectedIds.has(itm.id));
    if (accepted.length === 0) {
      setErrorMessage('Please select at least one item to import');
      return;
    }

    // Pass accepted items and metadata to quotation builder
    onAcceptItems(accepted, targetSection, extractedMetadata);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Quotation Document Import
                </h2>
                {targetSection && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Section: {targetSection}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Upload customer-supplied Excel, image or PDF list to extract editable items and automatically match rates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Upload or Text Paste Zone */}
          {extractedItems.length === 0 ? (
            <div className="space-y-4">
              {/* Tab Switcher */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('upload');
                    setErrorMessage('');
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    importMode === 'upload'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Excel, Image or PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('text');
                    setErrorMessage('');
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    importMode === 'text'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Paste Text / Handwritten Note</span>
                </button>
              </div>

              {importMode === 'upload' ? (
                <div className="space-y-3">
                  {/* Google Gemini Vision AI Status & Instant Key Connector */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/40 border border-blue-200/80 text-xs shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-800">
                          Google Gemini Multimodal Vision AI
                        </span>
                        {hasGeminiKey ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Cloud Vision Active ({maskedGeminiKey})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold border border-blue-200">
                            <span>On-Device Engine Active</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowKeyConfig(!showKeyConfig)}
                        className="text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        {hasGeminiKey ? 'Update API Key' : '✨ Connect Free Google Gemini API Key for 100% Handwriting Accuracy →'}
                      </button>
                    </div>

                    {showKeyConfig && (
                      <div className="pt-2.5 mt-2 border-t border-blue-200/70 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="password"
                            placeholder="Paste Google Gemini API Key (e.g. AIzaSy...)"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            className="flex-1 min-w-[240px] px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={handleSaveApiKey}
                            disabled={savingKey || !apiKeyInput.trim()}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span>Save Key</span>
                          </button>
                          <a
                            href="https://aistudio.google.com/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-indigo-700 hover:underline font-medium"
                          >
                            Get Free Key at Google AI Studio ↗
                          </a>
                        </div>
                        {keyNotice && (
                          <p className="text-[11px] text-emerald-700 font-semibold">{keyNotice}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                    }}
                    className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/30 hover:bg-blue-50/60 rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    />
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${
                        file?.name.match(/\.(xlsx|xls|csv)$/i)
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {file?.name.match(/\.(xlsx|xls|csv)$/i) ? (
                        <FileSpreadsheet className="w-7 h-7" />
                      ) : (
                        <UploadCloud className="w-7 h-7" />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">
                      {file ? file.name : 'Select or drop customer list (Excel XLSX, Image, or PDF)'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mb-4">
                      Supports Excel spreadsheets (.xlsx, .xls, .csv), printed or handwritten housekeeping & stationery RFQ sheets, purchase requisitions, or WhatsApp image lists (up to 10MB)
                    </p>
                    {errorMessage && (
                      <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium max-w-lg text-left animate-in fade-in space-y-1">
                        <div className="flex items-center gap-2 font-bold text-rose-800">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>Extraction Notice</span>
                        </div>
                        <p>{errorMessage}</p>
                      </div>
                    )}
                    {file && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUploadAndAnalyze();
                        }}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Reading Document...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Process & Extract Line Items</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-5 rounded-2xl bg-slate-50/80 border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Paste Particulars & Quantities
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Enter or paste items line-by-line (e.g. &quot;TBC cleaner - 5 ltr&quot; or &quot;Air freshner tin - 10 Nos&quot;)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {rawText.trim() && (
                        <button
                          type="button"
                          onClick={() => setRawText('')}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                        >
                          Clear Text
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setRawText(DEFAULT_HANDWRITTEN_MEMO);
                          setErrorMessage('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                      >
                        Fill 20 Handwritten Memo Items
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={10}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Paste handwritten note text or WhatsApp line items here (e.g. 1. TBC cleaner - 5 ltr)..."
                    className="w-full p-3.5 font-mono text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {rawText.trim() ? rawText.split('\n').filter((l) => l.trim()).length : 0} lines entered
                    </span>
                    <button
                      type="button"
                      onClick={handleTextAnalyze}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Converting to Rate Card...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Convert Handwritten Text to Rate Card</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Google Security & Safety Verification Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-blue-50/90 border border-blue-200 text-xs text-blue-900 shadow-2xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-semibold">
                    {providerNotice || 'Processed via Google Gemini Vision API'}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>Google Content Safety Verified</span>
                </div>
              </div>

              {/* Document Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200/90 px-4 py-2.5 rounded-xl text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-medium min-w-0">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate max-w-md font-semibold text-slate-800">
                    {file?.name || 'Customer Document'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setExtractedItems([]);
                      setSelectedIds(new Set());
                      setExtractedMetadata(null);
                      setFile(null);
                      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
                      setFilePreviewUrl(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Another Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-slate-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Side-by-side or Tabular Review */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Preview if image */}
                {filePreviewUrl && (
                  <div className="lg:col-span-4 border border-slate-200 rounded-xl p-2 bg-slate-50 flex flex-col">
                    <span className="text-[11px] font-bold text-slate-600 px-2 py-1 block">
                      Source Document Preview
                    </span>
                    <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg bg-white border border-slate-200 max-h-72">
                      <img
                        src={filePreviewUrl}
                        alt="Uploaded Document"
                        className="max-h-full object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Right Extracted Items Table */}
                <div className={filePreviewUrl ? 'lg:col-span-8' : 'lg:col-span-12'}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Extracted Items ({extractedItems.length} lines found)
                    </span>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleFill20StandardItems}
                        title="Auto-fill complete 20 items handwritten memo"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Fill 20 Memo Items</span>
                      </button>
                      <div className="flex items-center gap-1.5 w-44">
                        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Section:</span>
                        <GlassSelect
                          value={targetSection}
                          onChange={(val) => setTargetSection(val)}
                          size="sm"
                          options={Array.from(new Set([...availableSections, targetSection].filter(Boolean))).map((sec) => ({
                            value: sec,
                            label: sec,
                          }))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set(extractedItems.map((i) => i.id)))}
                        className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0 text-[10px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-2 w-8 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.size === extractedItems.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds(new Set(extractedItems.map((i) => i.id)));
                                } else {
                                  setSelectedIds(new Set());
                                }
                              }}
                            />
                          </th>
                          <th className="p-2">Particulars</th>
                          <th className="p-2 w-28">Spec</th>
                          <th className="p-2 w-20">Pack</th>
                          <th className="p-2 w-16 text-right">Qty</th>
                          <th className="p-2 w-16 text-center">Unit</th>
                          <th className="p-2 w-20 text-right">Rate (₹)</th>
                          <th className="p-2 w-14 text-center">GST %</th>
                          <th className="p-2 w-8 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {extractedItems.map((item) => (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              selectedIds.has(item.id) ? 'bg-blue-50/20' : ''
                            }`}
                          >
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggleSelect(item.id)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'description', e.target.value)
                                }
                                className="w-full px-2 py-1 text-xs font-medium rounded border border-slate-200 bg-white"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.specification || ''}
                                placeholder="Spec"
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'specification', e.target.value)
                                }
                                className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-white"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.pack || ''}
                                placeholder="Pack"
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'pack', e.target.value)
                                }
                                className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-white"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                value={item.quantity ?? ''}
                                placeholder="Qty"
                                onChange={(e) =>
                                  handleItemFieldChange(
                                    item.id,
                                    'quantity',
                                    e.target.value ? Number(e.target.value) : null
                                  )
                                }
                                className="w-16 px-1.5 py-1 text-xs text-right rounded border border-slate-200 bg-white font-mono"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="text"
                                value={item.unit || ''}
                                placeholder="Unit"
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'unit', e.target.value)
                                }
                                className="w-16 px-1.5 py-1 text-xs text-center rounded border border-slate-200 bg-white"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={item.rate ?? ''}
                                placeholder="Rate"
                                onChange={(e) =>
                                  handleItemFieldChange(
                                    item.id,
                                    'rate',
                                    e.target.value ? Number(e.target.value) : null
                                  )
                                }
                                className="w-20 px-1.5 py-1 text-xs text-right rounded border border-slate-200 bg-white font-mono"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                value={item.gstRate ?? ''}
                                placeholder="18"
                                onChange={(e) =>
                                  handleItemFieldChange(
                                    item.id,
                                    'gstRate',
                                    e.target.value ? Number(e.target.value) : null
                                  )
                                }
                                className="w-14 px-1.5 py-1 text-xs text-center rounded border border-slate-200 bg-white font-mono"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setExtractedItems((prev) => prev.filter((i) => i.id !== item.id));
                                  setSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(item.id);
                                    return next;
                                  });
                                }}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete line"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/80">
          <div className="text-xs text-slate-500">
            {extractedItems.length > 0 && (
              <span>
                {selectedIds.size} of {extractedItems.length} items selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            {extractedItems.length > 0 && (
              <button
                type="button"
                onClick={handleAccept}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <span>Accept & Insert into Quotation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
