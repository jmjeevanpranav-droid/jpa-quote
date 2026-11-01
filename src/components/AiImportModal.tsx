'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, X, Sparkles, Loader2, ArrowRight, FileText, Trash2, FileSpreadsheet, KeyRound, Save } from 'lucide-react';
import { GlassSelect } from '@/components/GlassSelect';
import type { ExtractedItem } from '@/lib/ai/extractor';


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
  const detectCategoryFromFileName = (name: string): string | null => {
    const lower = name.toLowerCase();
    if (/stationer|stationar/i.test(lower)) return 'Stationery';
    if (/housekeep|house\s*keep|clean/i.test(lower)) return 'Housekeeping';
    if (/industr/i.test(lower)) return 'Industrial';
    if (/electr/i.test(lower)) return 'Electrical';
    return null;
  };

  const initialClean = (initialTargetSection && initialTargetSection.trim().toLowerCase() !== 'current section')
    ? initialTargetSection.trim()
    : (availableSections.find(s => s && s.trim().toLowerCase() !== 'current section') || 'Housekeeping');

  const [targetSection, setTargetSection] = useState<string>(initialClean);
  const [autoDetectedBadge, setAutoDetectedBadge] = useState<string | null>(null);
  const [userHasManuallyChangedSection, setUserHasManuallyChangedSection] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'upload' | 'text'>('upload');
  const [rawText, setRawText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeRequest = useRef<AbortController | null>(null);
  const cancelRequest = () => { activeRequest.current?.abort(); activeRequest.current = null; setIsProcessing(false); };
  const closeImport = () => { cancelRequest(); onClose(); };
  useEffect(() => {
    if (!isOpen) cancelRequest();
    return () => { activeRequest.current?.abort(); activeRequest.current = null; };
  }, [isOpen]);

  // AI Vision & Parseur Key State
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<'parseur' | 'gemini' | 'local-ocr'>('local-ocr');
  const [providerName, setProviderName] = useState<string>('');
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [savingKey, setSavingKey] = useState<boolean>(false);
  const [keyNotice, setKeyNotice] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/ai-key')
        .then((res) => res.json())
        .then((data) => {
          setHasKey(Boolean(data.hasKey));
          setMaskedKey(data.maskedKey || null);
          setAiProvider(data.provider || 'local-ocr');
          setProviderName(data.providerName || '');
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
      setHasKey(true);
      setMaskedKey(data.maskedKey);
      setAiProvider(data.provider || 'parseur');
      setProviderName(data.providerName || '');
      setKeyNotice('Key connected! ' + (data.message || 'AI is now active.'));
      setShowKeyConfig(false);
      setApiKeyInput('');
    } catch (err: any) {
      setKeyNotice(err.message || 'Key verification failed');
    } finally {
      setSavingKey(false);
    }
  };

  React.useEffect(() => {
    if (initialTargetSection && initialTargetSection.trim().toLowerCase() !== 'current section') {
      setTargetSection(initialTargetSection.trim());
    } else if (availableSections.length > 0 && (!targetSection || targetSection.trim().toLowerCase() === 'current section')) {
      const validSec = availableSections.find(
        (s) => s && s.trim().toLowerCase() !== 'current section' && s.trim().toLowerCase() !== 'imported section'
      );
      if (validSec) setTargetSection(validSec);
    }
  }, [initialTargetSection, isOpen, availableSections]);



  const handleFileSelect = (selectedFile: File) => {
    cancelRequest();
    setExtractedItems([]); setSelectedIds(new Set()); setExtractedMetadata(null); setProviderNotice('');
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFile(selectedFile);
    setErrorMessage('');
    const detected = detectCategoryFromFileName(selectedFile.name);
    if (detected) {
      setTargetSection(detected);
      setAutoDetectedBadge(detected);
    }
    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleTextAnalyze = async () => {
    const textToProcess = rawText.trim();
    if (!textToProcess) { setErrorMessage('Paste the text from your document first.'); return; }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/ai-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToProcess }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]),
      });

      const data = await res.json().catch(() => null);
      if (controller.signal.aborted) return;

      if (!res.ok || !data) {
        throw new Error(data?.error || `Text parsing failed (HTTP ${res.status}).`);
      }

      if (!data.items || data.items.length === 0) {
        throw new Error('No quotation item rows could be identified in this spreadsheet or document. Please check that the sheet contains item names and quantities.');
      }

      const parsedItems: ExtractedItem[] = (data.items || []).map((itm: any) => ({
        ...itm,
        description: itm.description?.trim() || 'Material',
        quantity: itm.quantity != null && itm.quantity > 0 ? itm.quantity : 1,
        unit: itm.unit?.trim() || 'Nos',
        gstRate: itm.gstRate != null ? itm.gstRate : 18,
      }));
      setExtractedItems(parsedItems);
      setExtractedMetadata(data.metadata || null);
      setProviderNotice(data.providerNotice || 'Intelligent Handwritten Analysis Complete');
      setSelectedIds(new Set(parsedItems.map((itm) => itm.id)));
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Unable to parse items.');
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setIsProcessing(false); }
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) return;

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsProcessing(true);
    setErrorMessage('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ai-import', {
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]),
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (controller.signal.aborted) return;

      if (!res.ok || !data) {
        throw new Error(data?.error || `Document processing failed (HTTP ${res.status}).`);
      }

      if (!data.items || data.items.length === 0) {
        throw new Error('No quotation item rows could be identified in this spreadsheet or document. Please check that the sheet contains item names and quantities.');
      }

      const parsedItems: ExtractedItem[] = (data.items || []).map((itm: any) => ({
        ...itm,
        description: itm.description?.trim() || 'Material',
        quantity: itm.quantity != null && itm.quantity > 0 ? itm.quantity : 1,
        unit: itm.unit?.trim() || 'Nos',
        gstRate: itm.gstRate != null ? itm.gstRate : 18,
      }));
      setExtractedItems(parsedItems);
      setExtractedMetadata(data.metadata || null);
      setProviderNotice(data.providerNotice || '');
      setSelectedIds(new Set(parsedItems.map((itm) => itm.id)));

      if (data.metadata?.hasMultipleSections && data.metadata.sections?.length > 1) {
        setTargetSection('Multi-Sheet Auto-Route');
        setAutoDetectedBadge(data.metadata.sections.join(' & '));
      } else if (data.metadata?.sectionGuess) {
        setTargetSection(data.metadata.sectionGuess);
        setAutoDetectedBadge(data.metadata.sectionGuess);
      } else if (data.items && data.items.length > 0) {
        const counts: Record<string, number> = {};
        for (const it of data.items) {
          if (it.suggestedCategory) {
            counts[it.suggestedCategory] = (counts[it.suggestedCategory] || 0) + 1;
          }
        }
        let topCat = '';
        let max = 0;
        for (const [cat, cnt] of Object.entries(counts)) {
          if (cnt > max) { max = cnt; topCat = cat; }
        }
        if (topCat && (!userHasManuallyChangedSection || targetSection.toLowerCase() === 'current section')) {
          setTargetSection(topCat);
          setAutoDetectedBadge(topCat);
        }
      }
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error('Import error:', err);
      setErrorMessage(err.name === 'TimeoutError' ? 'Reading took too long. No items were inserted. Retry or check your vision provider connection.' : err.message || 'Unable to process document.');
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setIsProcessing(false); }
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

    const sanitizedAccepted = accepted.map((item) => ({
      ...item,
      description: item.description?.trim() || 'Material',
      specification: item.specification || '',
      pack: item.pack || '',
      quantity: item.quantity != null && item.quantity > 0 ? item.quantity : 1,
      unit: item.unit?.trim() || 'Nos',
      rate: item.rate != null && item.rate > 0 ? item.rate : null,
      gstRate: item.gstRate != null ? item.gstRate : 18,
      sectionName: item.sectionName || targetSection,
    }));

    // Pass accepted items and metadata to quotation builder
    onAcceptItems(sanitizedAccepted, targetSection, extractedMetadata);
    onClose();
  };

  const standardSections = ['Stationery', 'Housekeeping', 'Industrial', 'Electrical'];
  const cleanedAvailable = availableSections
    .map((s) => s.split('|')[0].trim())
    .filter((s) => s && s.toLowerCase() !== 'current section' && s.toLowerCase() !== 'imported section');

  const multiOption = extractedMetadata?.hasMultipleSections ? ['Multi-Sheet Auto-Route'] : [];
  const currentClean = targetSection && targetSection.toLowerCase() !== 'current section' ? targetSection : 'Stationery';
  const allSectionNames = Array.from(
    new Set([
      ...multiOption,
      currentClean,
      ...cleanedAvailable,
      ...standardSections,
    ].filter(Boolean))
  );

  const sectionDropdownOptions = allSectionNames.map((name) => ({
    value: name,
    label: name === 'Multi-Sheet Auto-Route' ? `Multi-Sheet Auto-Route (${extractedMetadata?.sections?.join(' & ') || 'All Sheets'})` : name,
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900">
                  Quotation Document Import
                </h2>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 shadow-2xs">
                  <span className="text-[11px] font-medium text-slate-500">Destination Section:</span>
                  <select
                    value={targetSection && targetSection.toLowerCase() !== 'current section' ? targetSection : 'Stationery'}
                    onChange={(e) => {
                      setTargetSection(e.target.value);
                      setUserHasManuallyChangedSection(true);
                      setAutoDetectedBadge(null);
                    }}
                    className="bg-transparent font-bold text-xs text-blue-900 focus:outline-hidden cursor-pointer"
                  >
                    {sectionDropdownOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="text-slate-800">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {autoDetectedBadge && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 animate-in fade-in">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Auto-matched: {autoDetectedBadge}</span>
                  </span>
                )}
              </div>
              
            </div>
          </div>
          <button
            onClick={closeImport}
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
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                    }}
                    className="glass-dropzone-pure-white rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
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
                      {file ? file.name : 'Select or drop customer list (Excel XLSX, XLS, Image, or PDF)'}
                    </h3>
                    {file?.name.match(/\.(xlsx|xls|csv)$/i) && (
                      <div className="mb-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1.5 animate-in fade-in">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>High-Fidelity Excel Engine (.xls / .xlsx native parser) — Tabular Data & Rate Memory Active</span>
                      </div>
                    )}
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
                <div className="space-y-4 p-5 rounded-2xl glass-box-pure-white">
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
              

              {/* Document Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 glass-box-pure-white px-4 py-2.5 rounded-xl text-xs">
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
                    onClick={closeImport}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-slate-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Multi-Sheet Detection Banner */}
              {extractedMetadata?.hasMultipleSections && (
                <div className="p-3 rounded-2xl glass-box-pure-white flex flex-wrap items-center justify-between gap-2 border-emerald-300/80">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-800 text-xs">
                      Multi-Sheet Workbook Detected ({extractedMetadata.sections?.length || 2} Sheets)
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Sheets: <strong className="text-blue-700">{(extractedMetadata.sections || []).join(' & ')}</strong> — will automatically quote into separate sections!
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                    Multi-Section Active
                  </span>
                </div>
              )}

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
                      
                      <div className="flex items-center gap-1.5 min-w-[200px]">
                        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Section:</span>
                        <GlassSelect
                          value={targetSection && targetSection.toLowerCase() !== 'current section' ? targetSection : 'Stationery'}
                          onChange={(val) => {
                            setTargetSection(val);
                            setUserHasManuallyChangedSection(true);
                          }}
                          size="sm"
                          options={sectionDropdownOptions}
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

                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden max-h-80 overflow-y-auto bg-slate-50/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 backdrop-blur-md text-slate-700 sticky top-0 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200/70">
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
                          <th className="p-2 w-24">Section</th>
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
                                value={item.sectionName || item.suggestedCategory || targetSection}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'sectionName', e.target.value)
                                }
                                className="glass-section-box w-28 px-2 py-1 text-xs font-bold text-blue-900 rounded-xl text-center"
                                title="Section name (auto-detected from sheet or category)"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  handleItemFieldChange(item.id, 'description', e.target.value)
                                }
                                className="glass-input-pure-white w-full px-2.5 py-1 text-xs font-semibold rounded-xl text-slate-800"
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
                                className="glass-input-pure-white w-full px-2 py-1 text-xs rounded-xl text-slate-700"
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
                                className="glass-input-pure-white w-full px-2 py-1 text-xs rounded-xl text-slate-700 text-center"
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
                                className="glass-input-pure-white w-16 px-1.5 py-1 text-xs text-right rounded-xl text-slate-800 font-bold font-mono"
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
                                className="glass-input-pure-white w-16 px-1.5 py-1 text-xs text-center rounded-xl text-slate-800 font-semibold"
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
                                className="glass-input-pure-white w-20 px-1.5 py-1 text-xs text-right rounded-xl text-blue-700 font-bold font-mono"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                value={item.gstRate ?? 18}
                                placeholder="18"
                                onChange={(e) =>
                                  handleItemFieldChange(
                                    item.id,
                                    'gstRate',
                                    e.target.value ? Number(e.target.value) : null
                                  )
                                }
                                className="glass-input-pure-white w-14 px-1.5 py-1 text-xs text-center rounded-xl text-slate-700 font-semibold font-mono"
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

        {extractedItems.length > 0 && errorMessage && <p role="alert" className="px-6 py-2 text-sm text-rose-700">{errorMessage}</p>}
        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/90">
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
              onClick={closeImport}
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
