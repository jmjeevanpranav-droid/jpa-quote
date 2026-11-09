'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  AlertTriangle,
  X,
  Sparkles,
  Loader2,
  ArrowRight,
  FileText,
  Trash2,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  HelpCircle,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  Check,
  Brain,
  Cpu,
  Search,
  FileScan,
  Zap,
} from 'lucide-react';
import { GlassSelect, type GlassSelectOption } from '@/components/GlassSelect';
import type { ExtractedItem, OcrEnginePreference } from '@/lib/ai/extractor';

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
  const [thinkingProcess, setThinkingProcess] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string | null>(null);
  const [tokenStats, setTokenStats] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedOriginalIds, setExpandedOriginalIds] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<'all' | 'ready' | 'review' | 'unreadable'>('all');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Interactive Document Preview Controls
  const [activePreviewTab, setActivePreviewTab] = useState<'image' | 'ocr'>('image');
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewRotation, setPreviewRotation] = useState<number>(0);
  const [isThinkingOpen, setIsThinkingOpen] = useState<boolean>(true);
  const [copiedOcrText, setCopiedOcrText] = useState<boolean>(false);
  const [ocrSearchQuery, setOcrSearchQuery] = useState<string>('');

  const detectCategoryFromFileName = (name: string): string | null => {
    const lower = name.toLowerCase();
    if (/stationer|stationar/i.test(lower)) return 'Stationery';
    if (/housekeep|house\s*keep|clean/i.test(lower)) return 'Housekeeping';
    if (/industr/i.test(lower)) return 'Industrial';
    if (/electr/i.test(lower)) return 'Electrical';
    return null;
  };

  const initialClean =
    initialTargetSection && initialTargetSection.trim().toLowerCase() !== 'current section'
      ? initialTargetSection.trim()
      : availableSections.find((s) => s && s.trim().toLowerCase() !== 'current section') || 'Housekeeping';

  const [targetSection, setTargetSection] = useState<string>(initialClean);
  const [autoDetectedBadge, setAutoDetectedBadge] = useState<string | null>(null);
  const [userHasManuallyChangedSection, setUserHasManuallyChangedSection] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'upload' | 'text'>('upload');
  const [rawText, setRawText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeRequest = useRef<AbortController | null>(null);
  const cancelRequest = () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setIsProcessing(false);
  };
  const closeImport = () => {
    cancelRequest();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) cancelRequest();
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [isOpen]);

  const [selectedModel, setSelectedModel] = useState<OcrEnginePreference>('gemini');
  const [hasCloudKey, setHasCloudKey] = useState<boolean>(false);
  const [hasQwenKey, setHasQwenKey] = useState<boolean>(false);
  const [qwenModel, setQwenModel] = useState<string>('Qwen/Qwen3.8-27B');
  const [shouldRender, setShouldRender] = useState<boolean>(isOpen);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    let raf1: number | null = null;
    let raf2: number | null = null;

    if (isOpen) {
      setShouldRender(true);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setIsModalVisible(true);
        });
      });
    } else {
      setIsModalVisible(false);
      closeTimer = setTimeout(() => {
        setShouldRender(false);
      }, 180);
    }

    return () => {
      if (closeTimer) clearTimeout(closeTimer);
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/ai-key', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          setHasCloudKey(Boolean(data.hasKey));
          setHasQwenKey(Boolean(data.hasQwenKey));
          if (data.qwenModel) setQwenModel(data.qwenModel);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialTargetSection && initialTargetSection.trim().toLowerCase() !== 'current section') {
      setTargetSection(initialTargetSection.trim());
    } else if (
      availableSections.length > 0 &&
      (!targetSection || targetSection.trim().toLowerCase() === 'current section')
    ) {
      const validSec = availableSections.find(
        (s) => s && s.trim().toLowerCase() !== 'current section' && s.trim().toLowerCase() !== 'imported section'
      );
      if (validSec) setTargetSection(validSec);
    }
  }, [initialTargetSection, isOpen, availableSections]);

  const handleFileSelect = (selectedFile: File) => {
    cancelRequest();
    setExtractedItems([]);
    setSelectedIds(new Set());
    setExtractedMetadata(null);
    setThinkingProcess(null);
    setRawOcrText(null);
    setTokenStats(null);
    setPreviewZoom(1);
    setPreviewRotation(0);
    setActivePreviewTab('image');
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
    if (!textToProcess) {
      setErrorMessage('Paste the text from your document first.');
      return;
    }

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
        throw new Error(
          'No quotation item rows could be identified in this spreadsheet or document. Please check that the sheet contains item names and quantities.'
        );
      }

      const parsedItems: ExtractedItem[] = (data.items || []).map((itm: any) => {
        const isUnread =
          itm.rowStatus === 'unreadable' || itm.matchType === 'unreadable' || !itm.description?.trim();
        const hasUnclear = Boolean(
          itm.needsReview ||
            isUnread ||
            itm.quantity == null ||
            Boolean(itm.question) ||
            (itm.unclearFields && itm.unclearFields.length > 0)
        );
        return {
          ...itm,
          description: isUnread ? '' : itm.description?.trim() || '',
          quantity: itm.quantity != null && !isNaN(itm.quantity) ? Number(itm.quantity) : null,
          unit: itm.unit?.trim() || null,
          rate: itm.rate != null && !isNaN(itm.rate) ? Number(itm.rate) : null,
          gstRate: itm.gstRate != null && !isNaN(itm.gstRate) && Number(itm.gstRate) > 0 ? Number(itm.gstRate) : 18,
          rowStatus: isUnread ? ('unreadable' as const) : hasUnclear ? ('needs_review' as const) : ('ready' as const),
          needsReview: hasUnclear,
        };
      });

      setExtractedItems(parsedItems);
      setExtractedMetadata(data.metadata || null);
      setThinkingProcess(data.thinkingProcess || null);
      setRawOcrText(data.rawOcrText || null);
      setTokenStats(data.tokenStats || null);

      const initialSelected = new Set(
        parsedItems
          .filter(
            (itm) =>
              !itm.needsReview &&
              itm.rowStatus !== 'unreadable' &&
              itm.matchType !== 'unreadable' &&
              Boolean(itm.description?.trim()) &&
              itm.quantity != null &&
              itm.quantity > 0
          )
          .map((itm) => itm.id)
      );
      setSelectedIds(initialSelected);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Unable to parse items.');
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsProcessing(false);
      }
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
    formData.append('engine', selectedModel);

    try {
      const res = await fetch('/api/ai-import', {
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (controller.signal.aborted) return;

      if (!res.ok || !data) {
        throw new Error(data?.error || `Document processing failed (HTTP ${res.status}).`);
      }

      if (!data.items || data.items.length === 0) {
        throw new Error(
          'No quotation item rows could be identified in this spreadsheet or document. Please check that the sheet contains item names and quantities.'
        );
      }

      const parsedItems: ExtractedItem[] = (data.items || []).map((itm: any) => {
        const isUnread =
          itm.rowStatus === 'unreadable' || itm.matchType === 'unreadable' || !itm.description?.trim();
        const hasUnclear = Boolean(
          itm.needsReview ||
            isUnread ||
            itm.quantity == null ||
            Boolean(itm.question) ||
            (itm.unclearFields && itm.unclearFields.length > 0)
        );
        return {
          ...itm,
          description: isUnread ? '' : itm.description?.trim() || '',
          quantity: itm.quantity != null && !isNaN(itm.quantity) ? Number(itm.quantity) : null,
          unit: itm.unit?.trim() || null,
          rate: itm.rate != null && !isNaN(itm.rate) ? Number(itm.rate) : null,
          gstRate: itm.gstRate != null && !isNaN(itm.gstRate) && Number(itm.gstRate) > 0 ? Number(itm.gstRate) : 18,
          rowStatus: isUnread ? ('unreadable' as const) : hasUnclear ? ('needs_review' as const) : ('ready' as const),
          needsReview: hasUnclear,
        };
      });

      setExtractedItems(parsedItems);
      setExtractedMetadata(data.metadata || null);
      setThinkingProcess(data.thinkingProcess || null);
      setRawOcrText(data.rawOcrText || null);
      setTokenStats(data.tokenStats || null);

      const initialSelected = new Set(
        parsedItems
          .filter(
            (itm) =>
              !itm.needsReview &&
              itm.rowStatus !== 'unreadable' &&
              itm.matchType !== 'unreadable' &&
              Boolean(itm.description?.trim()) &&
              itm.quantity != null &&
              itm.quantity > 0
          )
          .map((itm) => itm.id)
      );
      setSelectedIds(initialSelected);

      if (!userHasManuallyChangedSection) {
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
          const topCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
          if (topCategory && topCategory !== 'Other') {
            setTargetSection(topCategory);
            setAutoDetectedBadge(topCategory);
          }
        }
      }
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Processing failed. Please retry.');
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsProcessing(false);
      }
    }
  };

  const handleCopyRawOcr = async () => {
    if (!rawOcrText) return;
    try {
      await navigator.clipboard.writeText(rawOcrText);
      setCopiedOcrText(true);
      setTimeout(() => setCopiedOcrText(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleItemFieldChange = (id: string, field: string, value: any) => {
    setExtractedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'description') {
          const trimmed = String(value || '').trim();
          if (trimmed.length > 0) {
            if (updated.rowStatus === 'unreadable' || updated.matchType === 'unreadable') {
              updated.rowStatus = updated.quantity != null && updated.quantity > 0 ? 'ready' : 'needs_review';
              updated.matchType = 'custom';
              updated.warnings = (updated.warnings || []).filter(
                (w) => !w.toLowerCase().includes('unclear') && !w.toLowerCase().includes('unreadable')
              );
            }
          }
        }
        if (field === 'quantity') {
          if (value != null && Number(value) > 0) {
            updated.unclearFields = (updated.unclearFields || []).filter((f) => f !== 'quantity');
          }
        }
        const hasUnclear = Boolean(
          !updated.description?.trim() ||
            updated.rowStatus === 'unreadable' ||
            updated.matchType === 'unreadable' ||
            updated.quantity == null ||
            updated.quantity <= 0 ||
            Boolean(updated.question) ||
            (updated.unclearFields && updated.unclearFields.length > 0)
        );
        updated.needsReview = hasUnclear;
        if (!hasUnclear && updated.rowStatus !== 'ready') {
          updated.rowStatus = 'ready';
          setSelectedIds((s) => new Set([...s, item.id]));
        }
        return updated;
      })
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

  const toggleExpandOriginal = (id: string) => {
    setExpandedOriginalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleResolveColumnMapping = (choice: 'rate' | 'total') => {
    setExtractedItems((prev) =>
      prev.map((itm) => {
        if (itm.ambiguousRateTotal == null) return itm;
        const val = Number(itm.ambiguousRateTotal);
        if (isNaN(val) || val <= 0) return itm;
        let newRate = itm.rate;
        const newWarnings = (itm.warnings || []).filter(
          (w) => !w.toLowerCase().includes('unit rate') && !w.toLowerCase().includes('line total')
        );
        const newUnclear = (itm.unclearFields || []).filter((f) => f !== 'rate');
        if (choice === 'rate') {
          newRate = val;
        } else {
          const q = itm.quantity != null && itm.quantity > 0 ? itm.quantity : 1;
          newRate = Math.round((val / q) * 100) / 100;
        }
        const hasUnclearRemaining = newUnclear.length > 0 || !itm.description?.trim() || itm.quantity == null;
        return {
          ...itm,
          rate: newRate,
          question: undefined,
          warnings: newWarnings,
          unclearFields: newUnclear,
          needsReview: hasUnclearRemaining,
          rowStatus: hasUnclearRemaining ? ('needs_review' as const) : ('ready' as const),
          ambiguousRateTotal: undefined,
        };
      })
    );
    setExtractedMetadata((prev: any) => (prev ? { ...prev, columnMappingQuestion: undefined } : null));
  };

  const resolveCandidate = (id: string, cand: any) => {
    setExtractedItems((prev) =>
      prev.map((itm) => {
        if (itm.id !== id) return itm;
        const updatedDesc = cand.description || itm.description;
        const updatedQty = itm.quantity;
        const isReadyNow = Boolean(updatedDesc?.trim()) && updatedQty != null && updatedQty > 0;
        return {
          ...itm,
          description: updatedDesc,
          specification: cand.specification || itm.specification,
          pack: cand.pack || itm.pack,
          unit: cand.unit || itm.unit,
          rate: cand.rate != null ? cand.rate : itm.rate,
          gstRate: cand.gstRate != null && Number(cand.gstRate) > 0 ? cand.gstRate : (itm.gstRate != null && Number(itm.gstRate) > 0 ? itm.gstRate : 18),
          needsReview: !isReadyNow,
          rowStatus: isReadyNow ? ('ready' as const) : ('needs_review' as const),
          question: undefined,
          candidates: [],
          matchType: 'fuzzy' as const,
        };
      })
    );
    setSelectedIds((prev) => new Set([...prev, id]));
  };

  const { candidateItems, readyCount, reviewCount, unreadableCount, dynamicSummaryText } = useMemo(() => {
    const candidates = extractedItems.filter(
      (i) => i.rowStatus !== 'unreadable' && i.matchType !== 'unreadable' && Boolean(i.description?.trim())
    );
    const ready = candidates.filter((i) => !i.needsReview && i.quantity != null && i.quantity > 0 && !i.question);
    const review = candidates.length - ready.length;
    const unreadable = extractedItems.length - candidates.length;

    let summary = '';
    if (extractedItems.length === 0) {
      summary = '';
    } else if (candidates.length === 0) {
      summary = `No readable items found. ${unreadable} unreadable region${unreadable > 1 ? 's' : ''} flagged for inspection.`;
    } else {
      summary = `Found ${candidates.length} readable line item${candidates.length > 1 ? 's' : ''}.`;
      const unclearQtyCount = candidates.filter(
        (i) => (i.unclearFields?.includes('quantity') || i.quantity == null) && i.needsReview
      ).length;
      if (review > 0) {
        if (unclearQtyCount > 0 && unclearQtyCount === review) {
          summary += ` ${unclearQtyCount === 1 ? 'One quantity needs' : `${unclearQtyCount} quantities need`} review.`;
        } else {
          summary += ` ${review === 1 ? 'One item needs' : `${review} items need`} review.`;
        }
      } else {
        summary += ' All items are ready to auto-fill.';
      }
      if (unreadable > 0) {
        summary += ` (${unreadable} unreadable region${unreadable > 1 ? 's' : ''} separated for inspection)`;
      }
    }

    return {
      candidateItems: candidates,
      readyCount: ready.length,
      reviewCount: review,
      unreadableCount: unreadable,
      dynamicSummaryText: summary,
    };
  }, [extractedItems]);

  const handleAccept = async () => {
    const accepted = extractedItems.filter(
      (itm) =>
        selectedIds.has(itm.id) &&
        !itm.needsReview &&
        itm.rowStatus !== 'unreadable' &&
        itm.matchType !== 'unreadable' &&
        Boolean(itm.description?.trim()) &&
        itm.quantity != null &&
        itm.quantity > 0
    );
    if (accepted.length === 0) {
      setErrorMessage('Please resolve or select at least one valid item to import.');
      return;
    }

    const sanitizedAccepted = accepted.map((item) => ({
      ...item,
      description: item.description?.trim() || 'Item',
      specification: item.specification || '',
      pack: item.pack || '',
      quantity: item.quantity != null ? item.quantity : 0,
      unit: item.unit?.trim() || '',
      rate: item.rate != null && item.rate > 0 ? item.rate : null,
      gstRate: item.gstRate != null && !isNaN(item.gstRate) && Number(item.gstRate) > 0 ? Number(item.gstRate) : 18,
      sectionName: item.sectionName || targetSection,
    }));

    onAcceptItems(sanitizedAccepted, targetSection, extractedMetadata);
    onClose();
  };

  const standardSections = ['Stationery', 'Housekeeping', 'Industrial', 'Electrical'];
  const cleanedAvailable = availableSections
    .map((s) => s.split('|')[0].trim())
    .filter((s) => s && s.toLowerCase() !== 'current section' && s.toLowerCase() !== 'imported section');

  const multiOption = extractedMetadata?.hasMultipleSections ? ['Multi-Sheet Auto-Route'] : [];
  const currentClean =
    targetSection && targetSection.toLowerCase() !== 'current section' ? targetSection : 'Stationery';
  const allSectionNames = Array.from(
    new Set([...multiOption, currentClean, ...cleanedAvailable, ...standardSections].filter(Boolean))
  );

  const sectionDropdownOptions: GlassSelectOption[] = allSectionNames.map((name) => ({
    value: name,
    label:
      name === 'Multi-Sheet Auto-Route'
        ? `Multi-Sheet Auto-Route (${extractedMetadata?.sections?.join(' & ') || 'All Sheets'})`
        : name,
  }));

  const modelDropdownOptions: GlassSelectOption[] = [
    {
      value: 'gemini',
      label: 'JPA Vision AI',
    },
    {
      value: 'qwen',
      label: 'JPA Qwen',
    },
  ];

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-5 bg-slate-900/50 backdrop-blur-md transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isModalVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`glass-modal-pure-white rounded-3xl w-full max-w-6xl max-h-[94dvh] flex flex-col overflow-hidden transition-all duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isModalVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.96] translate-y-3'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-start sm:items-center justify-between gap-2.5 px-4 sm:px-7 py-3 sm:py-3.5 border-b border-white/80 bg-white/70 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-2xl bg-linear-to-br from-indigo-500/20 via-violet-500/20 to-blue-500/20 border border-indigo-200/90 text-indigo-700 flex items-center justify-center shadow-2xs shrink-0">
              <Brain className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
              <h2 className="text-[15px] sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>AI Vision & Quotation Import</span>
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  <Zap className="w-3 h-3 text-indigo-600" />
                  JPA Vision AI &bull; Rate Library Match
                </span>
              </h2>

              <GlassSelect
                variant="pill"
                size="sm"
                prefixLabel="Section:"
                ariaLabel="Destination Section"
                value={targetSection && targetSection.toLowerCase() !== 'current section' ? targetSection : 'Stationery'}
                onChange={(val) => {
                  setTargetSection(String(val));
                  setUserHasManuallyChangedSection(true);
                  setAutoDetectedBadge(null);
                }}
                options={sectionDropdownOptions}
              />
              {autoDetectedBadge && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50/90 text-emerald-800 border border-emerald-200/90 backdrop-blur-md shadow-2xs animate-in fade-in">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>Auto-matched: {autoDetectedBadge}</span>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={closeImport}
            aria-label="Close Quotation Document Import"
            className="w-8.5 h-8.5 rounded-full text-slate-500 hover:text-slate-800 bg-white/75 hover:bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* File Upload or Text Paste Zone */}
          {extractedItems.length === 0 ? (
            <div className="space-y-4">
              {/* Responsive Glassmorphic Toolbar: True Sliding Mode Switcher + Model Selector */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200/70 pb-3.5">
                <div className="relative grid grid-cols-2 items-center p-1 rounded-2xl bg-slate-200/60 backdrop-blur-md border border-white/90 shadow-inner w-full lg:w-auto lg:min-w-[440px]">
                  <div
                    aria-hidden="true"
                    style={{
                      transform: importMode === 'upload' ? 'translate3d(0%, 0, 0)' : 'translate3d(100%, 0, 0)',
                    }}
                    className="glass-segmented-thumb pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-600/25"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('upload');
                      setErrorMessage('');
                    }}
                    className={`relative z-10 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer select-none ${
                      importMode === 'upload' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UploadCloud className="w-4 h-4 shrink-0" />
                    <span className="sm:hidden">Upload File</span>
                    <span className="hidden sm:inline">Upload Image, Memo, PDF or Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('text');
                      setErrorMessage('');
                    }}
                    className={`relative z-10 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer select-none ${
                      importMode === 'text' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="sm:hidden">Paste Text / Note</span>
                    <span className="hidden sm:inline">Paste Text / Handwritten Note</span>
                  </button>
                </div>

                {importMode === 'upload' && (
                  <div className="w-full lg:w-auto flex items-center justify-start lg:justify-end">
                    <GlassSelect
                      variant="pill"
                      size="sm"
                      icon={<Brain className="w-3.5 h-3.5 text-indigo-600" />}
                      prefixLabel="Reasoning AI:"
                      ariaLabel="Select Reasoning Model"
                      value={selectedModel}
                      onChange={(val) => setSelectedModel(val as OcrEnginePreference)}
                      options={modelDropdownOptions}
                      className="w-full sm:w-auto"
                    />
                  </div>
                )}
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
                    className="glass-dropzone-pure-white rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    />
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${
                        file?.name.match(/\.(xlsx|xls|csv)$/i)
                          ? 'bg-emerald-100 text-emerald-600'
                          : file?.name.match(/\.docx$/i)
                          ? 'bg-indigo-100 text-indigo-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {file?.name.match(/\.(xlsx|xls|csv)$/i) ? (
                        <FileSpreadsheet className="w-7 h-7" />
                      ) : filePreviewUrl ? (
                        <FileScan className="w-7 h-7" />
                      ) : (
                        <UploadCloud className="w-7 h-7" />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">
                      {file ? file.name : 'Select or drop customer document (Handwritten Memo, Image, PDF, Excel or Word)'}
                    </h3>

                    {filePreviewUrl && (
                      <div className="my-2 p-2 rounded-xl border border-indigo-200 bg-white shadow-xs max-h-40 overflow-hidden">
                        <img src={filePreviewUrl} alt="Quick thumbnail" className="max-h-36 object-contain mx-auto rounded" />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-semibold inline-flex items-center gap-1">
                        <Brain className="w-3.5 h-3.5 text-indigo-600" />
                        <span>JPA Vision AI &amp; JPA Qwen</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold inline-flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Rate Library Auto-Population &bull; 18% GST</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 max-w-md mb-4">
                      Reads handwritten memos, RFQs, printed invoices, store lists, and multi-sheet workbooks. Thinks deeply, extracts customer particulars, and auto-fills quotation fields.
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
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI Thinking & Deciphering Document...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Start AI Vision & Field Extraction</span>
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
                          <span>Thinking & Parsing Items...</span>
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
              {/* Top Document Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 glass-box-pure-white px-4 py-2.5 rounded-xl text-xs">
                <div className="flex flex-wrap items-center gap-2 text-slate-700 font-medium min-w-0">
                  <Brain className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate max-w-xs font-bold text-slate-800">
                    {file?.name || 'Document'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setExtractedItems([]);
                      setSelectedIds(new Set());
                      setExtractedMetadata(null);
                      setThinkingProcess(null);
                      setRawOcrText(null);
                      setTokenStats(null);
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

              {/* AI Deep Thinking Cockpit */}
              {thinkingProcess && (
                <div className="p-3.5 rounded-2xl bg-linear-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white border border-indigo-500/40 shadow-md">
                  <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setIsThinkingOpen(!isThinkingOpen)}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/30 flex items-center justify-center text-indigo-300">
                        <Brain className="w-4 h-4 animate-pulse" />
                      </div>
                      <span className="text-xs font-bold tracking-wide text-indigo-200">
                        AI Reasoning & Thought Process ({selectedModel === 'qwen' ? 'JPA Qwen' : 'JPA Vision AI'})
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-indigo-300 hover:text-white font-medium underline cursor-pointer"
                    >
                      {isThinkingOpen ? 'Collapse' : 'Expand Thoughts'}
                    </button>
                  </div>
                  {isThinkingOpen && (
                    <div className="mt-2.5 pt-2 border-t border-indigo-800/60 font-mono text-[11px] text-indigo-100 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                      {thinkingProcess}
                    </div>
                  )}
                </div>
              )}

              {/* Detected Particulars & Header Auto-Fill Card */}
              {extractedMetadata && (extractedMetadata.customerGuess || extractedMetadata.storeGuess || extractedMetadata.referenceNumber) && (
                <div className="p-3 rounded-2xl bg-linear-to-r from-blue-50/90 via-indigo-50/80 to-slate-50 border border-blue-200 text-xs flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Detected Quotation Fields:
                    </span>
                    {extractedMetadata.customerGuess && (
                      <span className="px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-950 font-bold shadow-2xs">
                        Customer: {extractedMetadata.customerGuess}
                      </span>
                    )}
                    {extractedMetadata.storeGuess && (
                      <span className="px-2.5 py-1 rounded-full bg-white border border-blue-200 text-slate-800 font-semibold shadow-2xs">
                        Store: {extractedMetadata.storeGuess}
                      </span>
                    )}
                    {extractedMetadata.referenceNumber && (
                      <span className="px-2.5 py-1 rounded-full bg-white border border-blue-200 text-slate-800 font-semibold shadow-2xs">
                        PO/Ref: {extractedMetadata.referenceNumber}
                      </span>
                    )}
                    {extractedMetadata.documentDate && (
                      <span className="px-2.5 py-1 rounded-full bg-white border border-blue-200 text-slate-800 font-semibold shadow-2xs">
                        Date: {extractedMetadata.documentDate}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-indigo-700 font-semibold">
                    &rarr; Automatically fills Quotation Header on acceptance
                  </span>
                </div>
              )}

              {/* Dynamic Human-Friendly Summary Banner & View Mode Filter */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{dynamicSummaryText}</p>
                    <p className="text-[11px] text-slate-500">
                      Unresolved items and unreadable fragments are flagged for inspection.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      viewFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    All Items ({extractedItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewFilter('ready')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      viewFilter === 'ready'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    Ready ({readyCount})
                  </button>
                  {reviewCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewFilter('review')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        viewFilter === 'review'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                      }`}
                    >
                      Needs Review ({reviewCount})
                    </button>
                  )}
                  {unreadableCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewFilter('unreadable')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        viewFilter === 'unreadable'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                      }`}
                    >
                      Unreadable ({unreadableCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Section-Level Column Mapping Question Banner */}
              {(extractedMetadata?.columnMappingQuestion || extractedItems.some((i) => i.ambiguousRateTotal != null)) && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/95 border border-indigo-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                  <div className="flex items-center gap-2 text-indigo-950 font-medium">
                    <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      {extractedMetadata?.columnMappingQuestion ||
                        'Uncertain column mapping: Are values like ₹25 intended as unit rates or line totals?'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleResolveColumnMapping('rate')}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer"
                    >
                      Apply as Unit Rate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveColumnMapping('total')}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-300 font-semibold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer"
                    >
                      Apply as Line Total
                    </button>
                  </div>
                </div>
              )}

              {/* Split Screen: Left Document/OCR Preview & Right Extracted Items Table */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Preview Pane (Document or Quick OCR) */}
                {(filePreviewUrl || rawOcrText) && (
                  <div className="lg:col-span-5 border border-slate-200 rounded-2xl p-3 bg-slate-50/70 flex flex-col gap-2">
                    {/* Preview Controls Bar */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                      <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-bold">
                        {filePreviewUrl && (
                          <button
                            type="button"
                            onClick={() => setActivePreviewTab('image')}
                            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                              activePreviewTab === 'image'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Image Preview
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActivePreviewTab('ocr')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                            activePreviewTab === 'ocr' || !filePreviewUrl
                              ? 'bg-white text-blue-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <FileScan className="w-3 h-3" />
                          <span>Quick OCR</span>
                        </button>
                      </div>

                      {activePreviewTab === 'image' && filePreviewUrl && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewZoom((z) => Math.max(0.5, z - 0.2))}
                            title="Zoom out"
                            className="p-1 rounded hover:bg-white text-slate-600 cursor-pointer"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-mono font-bold text-slate-500 w-9 text-center">
                            {Math.round(previewZoom * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewZoom((z) => Math.min(3, z + 0.2))}
                            title="Zoom in"
                            className="p-1 rounded hover:bg-white text-slate-600 cursor-pointer"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewRotation((r) => (r + 90) % 360)}
                            title="Rotate 90 degrees"
                            className="p-1 rounded hover:bg-white text-slate-600 cursor-pointer ml-1"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {activePreviewTab === 'ocr' && rawOcrText && (
                        <button
                          type="button"
                          onClick={handleCopyRawOcr}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer shadow-2xs transition-all active:scale-95"
                        >
                          {copiedOcrText ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-500" />
                              <span>Copy OCR Text</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Preview Content */}
                    {activePreviewTab === 'image' && filePreviewUrl ? (
                      <div className="flex-1 flex items-center justify-center overflow-auto rounded-xl bg-white border border-slate-200 min-h-[300px] max-h-[460px] p-2 relative">
                        <img
                          src={filePreviewUrl}
                          alt="Document Preview"
                          style={{
                            transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`,
                            transformOrigin: 'center center',
                            transition: 'transform 0.15s ease-out',
                          }}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col rounded-xl bg-white border border-slate-200 min-h-[300px] max-h-[460px] overflow-hidden">
                        <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            placeholder="Find in OCR text..."
                            value={ocrSearchQuery}
                            onChange={(e) => setOcrSearchQuery(e.target.value)}
                            className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400"
                          />
                        </div>
                        <div className="p-3 overflow-y-auto font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed select-text flex-1">
                          {rawOcrText || 'No OCR transcript available for this file.'}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Right Extracted Items Table */}
                <div className={filePreviewUrl || rawOcrText ? 'lg:col-span-7' : 'lg:col-span-12'}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Extracted Items ({candidateItems.length} candidate product{candidateItems.length !== 1 ? 's' : ''}
                      {unreadableCount > 0 ? `, ${unreadableCount} unreadable region${unreadableCount !== 1 ? 's' : ''}` : ''})
                    </span>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-1.5 min-w-[190px]">
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
                        onClick={() => {
                          const resolvable = extractedItems.filter(
                            (i) =>
                              !i.needsReview &&
                              i.rowStatus !== 'unreadable' &&
                              i.matchType !== 'unreadable' &&
                              Boolean(i.description?.trim()) &&
                              i.quantity != null &&
                              i.quantity > 0
                          );
                          setSelectedIds(new Set(resolvable.map((i) => i.id)));
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                        title="Select all resolved items"
                      >
                        Select All
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden max-h-[460px] overflow-y-auto overflow-x-auto bg-slate-50/40">
                    <table className="w-full min-w-[650px] text-left text-xs">
                      <thead className="bg-slate-100/90 backdrop-blur-md text-slate-700 sticky top-0 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200/70 z-10">
                        <tr>
                          <th className="p-2 w-8 text-center">
                            {(() => {
                              const resolvable = extractedItems.filter(
                                (i) =>
                                  !i.needsReview &&
                                  i.rowStatus !== 'unreadable' &&
                                  i.matchType !== 'unreadable' &&
                                  Boolean(i.description?.trim()) &&
                                  i.quantity != null &&
                                  i.quantity > 0
                              );
                              const allResolvableSelected =
                                resolvable.length > 0 && resolvable.every((i) => selectedIds.has(i.id));
                              return (
                                <input
                                  type="checkbox"
                                  checked={allResolvableSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedIds(new Set(resolvable.map((i) => i.id)));
                                    } else {
                                      setSelectedIds(new Set());
                                    }
                                  }}
                                  title="Select all resolved candidate items"
                                />
                              );
                            })()}
                          </th>
                          <th className="p-2 w-20">Section</th>
                          <th className="p-2">Particulars</th>
                          <th className="p-2 w-20">Spec</th>
                          <th className="p-2 w-16">Pack</th>
                          <th className="p-2 w-14 text-right">Qty</th>
                          <th className="p-2 w-14 text-center">Unit</th>
                          <th className="p-2 w-20 text-right">Rate (₹)</th>
                          <th className="p-2 w-12 text-center">GST %</th>
                          <th className="p-2 w-8 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {extractedItems
                          .filter((item) => {
                            const isUnread =
                              item.rowStatus === 'unreadable' ||
                              item.matchType === 'unreadable' ||
                              !item.description?.trim();
                            const isNeedsRev =
                              !isUnread &&
                              (item.needsReview ||
                                item.rowStatus === 'needs_review' ||
                                item.quantity == null ||
                                Boolean(item.question) ||
                                (item.unclearFields && item.unclearFields.length > 0));
                            const isReady =
                              !isUnread && !isNeedsRev && item.quantity != null && item.quantity > 0 && Boolean(item.description?.trim());

                            if (viewFilter === 'ready') return isReady;
                            if (viewFilter === 'review') return isNeedsRev;
                            if (viewFilter === 'unreadable') return isUnread;
                            return true;
                          })
                          .map((item) => {
                            const isUnread =
                              item.rowStatus === 'unreadable' ||
                              item.matchType === 'unreadable' ||
                              !item.description?.trim();
                            const isNeedsRev =
                              !isUnread &&
                              (item.needsReview ||
                                item.rowStatus === 'needs_review' ||
                                item.quantity == null ||
                                Boolean(item.question) ||
                                (item.unclearFields && item.unclearFields.length > 0));
                            const isReady =
                              !isUnread && !isNeedsRev && item.quantity != null && item.quantity > 0 && Boolean(item.description?.trim());

                            return (
                              <tr
                                key={item.id}
                                className={`hover:bg-slate-50 transition-colors ${
                                  selectedIds.has(item.id)
                                    ? 'bg-blue-50/25'
                                    : isUnread
                                    ? 'bg-rose-50/15'
                                    : isNeedsRev
                                    ? 'bg-amber-50/15'
                                    : ''
                                }`}
                              >
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(item.id)}
                                    disabled={isUnread || !item.description?.trim()}
                                    onChange={() => toggleSelect(item.id)}
                                    title={
                                      isUnread
                                        ? 'Enter a valid description to enable this item'
                                        : 'Toggle item selection'
                                    }
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={
                                      item.sectionName ||
                                      (targetSection === 'Multi-Sheet Auto-Route'
                                        ? item.suggestedCategory || 'Housekeeping'
                                        : targetSection)
                                    }
                                    onChange={(e) =>
                                      handleItemFieldChange(item.id, 'sectionName', e.target.value)
                                    }
                                    className="glass-section-box w-20 px-1.5 py-1 text-[11px] font-bold text-blue-900 rounded-lg text-center"
                                    title="Section name"
                                  />
                                </td>
                                <td className="p-2">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      {isReady && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                      <input
                                        type="text"
                                        value={item.description}
                                        placeholder={
                                          isUnread ? 'Item name unclear — review original' : 'Product Particulars'
                                        }
                                        onChange={(e) =>
                                          handleItemFieldChange(item.id, 'description', e.target.value)
                                        }
                                        className={`w-full px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                                          isUnread
                                            ? 'bg-rose-50/50 border border-rose-300 text-rose-950 placeholder:text-rose-400 placeholder:italic'
                                            : isNeedsRev
                                            ? 'glass-input-pure-white border border-amber-300 text-slate-800'
                                            : 'glass-input-pure-white text-slate-800'
                                        }`}
                                      />
                                      {isUnread ? (
                                        <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                                          Unreadable
                                        </span>
                                      ) : isNeedsRev ? (
                                        <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                          Needs review
                                        </span>
                                      ) : null}
                                    </div>

                                    {/* Warnings if any */}
                                    {item.warnings && item.warnings.length > 0 && (
                                      <div className="text-[10px] text-amber-700 font-medium px-1">
                                        {item.warnings.join(' • ')}
                                      </div>
                                    )}

                                    {/* Candidate Variant Resolution Question Banner */}
                                    {item.question && item.candidates && item.candidates.length > 0 && (
                                      <div className="p-2.5 rounded-xl bg-amber-50/95 border border-amber-300/80 text-xs space-y-1.5 animate-in fade-in">
                                        <div className="flex items-center gap-1.5 font-bold text-amber-950 text-[11px]">
                                          <HelpCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                          <span>{item.question}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                          {item.candidates.map((cand, cIdx) => (
                                            <button
                                              key={cIdx}
                                              type="button"
                                              onClick={() => resolveCandidate(item.id, cand)}
                                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100/90 text-amber-950 border border-amber-300 font-semibold text-[11px] shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                                            >
                                              <span>{cand.description}</span>
                                              {cand.specification && (
                                                <span className="text-slate-500 font-mono">({cand.specification})</span>
                                              )}
                                              {cand.rate != null && (
                                                <span className="font-bold text-blue-700">₹{cand.rate}</span>
                                              )}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* View Original & Crop Section */}
                                    {(item.originalText || item.cropDataUrl || item.cropUrl) && (
                                      <div className="pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => toggleExpandOriginal(item.id)}
                                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-700 transition-colors cursor-pointer select-none"
                                        >
                                          {expandedOriginalIds.has(item.id) ? (
                                            <EyeOff className="w-3 h-3 text-slate-400" />
                                          ) : (
                                            <Eye className="w-3 h-3 text-slate-400" />
                                          )}
                                          <span>
                                            {expandedOriginalIds.has(item.id) ? 'Hide original' : 'View original'}
                                          </span>
                                        </button>

                                        {expandedOriginalIds.has(item.id) && (
                                          <div className="mt-1.5 p-2 rounded-xl bg-slate-100/90 border border-slate-200 text-xs space-y-1.5 animate-in fade-in">
                                            {item.originalText && (
                                              <div className="text-[11px] text-slate-700 font-mono">
                                                <strong className="text-slate-500">Source text:</strong> &ldquo;{item.originalText}&rdquo;
                                              </div>
                                            )}
                                            {(item.cropDataUrl || item.cropUrl) && (
                                              <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                                  Source Crop Evidence
                                                </span>
                                                <img
                                                  src={item.cropDataUrl || item.cropUrl}
                                                  alt="Source snippet crop"
                                                  className="max-h-24 max-w-full rounded-lg border border-slate-300 bg-white p-1 shadow-2xs object-contain"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={item.specification || ''}
                                    placeholder="Spec"
                                    onChange={(e) => handleItemFieldChange(item.id, 'specification', e.target.value)}
                                    className="glass-input-pure-white w-full px-1.5 py-1 text-xs rounded-lg text-slate-700"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={item.pack || ''}
                                    placeholder="Pack"
                                    onChange={(e) => handleItemFieldChange(item.id, 'pack', e.target.value)}
                                    className="glass-input-pure-white w-full px-1.5 py-1 text-xs rounded-lg text-slate-700 text-center"
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
                                    className={`w-14 px-1 py-1 text-xs text-right rounded-lg font-bold font-mono transition-all ${
                                      item.unclearFields?.includes('quantity') || (item.needsReview && item.quantity == null)
                                        ? 'border-2 border-amber-400 bg-amber-50/80 text-amber-950 ring-2 ring-amber-300/40'
                                        : 'glass-input-pure-white text-slate-800'
                                    }`}
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <input
                                    type="text"
                                    value={item.unit || ''}
                                    placeholder="Unit"
                                    onChange={(e) => handleItemFieldChange(item.id, 'unit', e.target.value)}
                                    className={`w-14 px-1 py-1 text-xs text-center rounded-lg font-semibold transition-all ${
                                      item.unclearFields?.includes('unit')
                                        ? 'border-2 border-amber-400 bg-amber-50/80 text-amber-950'
                                        : 'glass-input-pure-white text-slate-800'
                                    }`}
                                  />
                                </td>
                                <td className="p-2 text-right">
                                  <div className="space-y-0.5">
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
                                      className={`w-18 px-1.5 py-1 text-xs text-right rounded-lg font-bold font-mono transition-all ${
                                        item.unclearFields?.includes('rate')
                                          ? 'border-2 border-amber-400 bg-amber-50/80 text-amber-950 ring-2 ring-amber-300/40'
                                          : 'glass-input-pure-white text-blue-700'
                                      }`}
                                    />
                                    {item.rateSource === 'catalog' && (
                                      <div className="text-[9px] text-blue-600 font-semibold text-right pr-1">
                                        Library
                                      </div>
                                    )}
                                    {(item.rateSource === 'source' || item.rateSource === 'document') && (
                                      <div className="text-[9px] text-slate-500 font-medium text-right pr-1">
                                        Source
                                      </div>
                                    )}
                                  </div>
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
                                        e.target.value !== '' ? Number(e.target.value) : 18
                                      )
                                    }
                                    className="glass-input-pure-white w-12 px-1 py-1 text-xs text-center rounded-lg text-slate-700 font-semibold font-mono"
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
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Delete line"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {extractedItems.length > 0 && errorMessage && (
          <p role="alert" className="px-6 py-2 text-sm text-rose-700 font-medium animate-in fade-in">
            {errorMessage}
          </p>
        )}

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-7 py-3 sm:py-3.5 border-t border-white/80 bg-white/70 backdrop-blur-xl">
          <div className="text-xs font-medium text-slate-500">
            {extractedItems.length > 0 && (
              <span>
                <strong className="text-slate-800">{selectedIds.size}</strong> of {candidateItems.length} candidate items selected
                {reviewCount > 0 && (
                  <span className="ml-2 font-semibold text-amber-700">({reviewCount} need review)</span>
                )}
                {unreadableCount > 0 && (
                  <span className="ml-2 font-semibold text-rose-600">({unreadableCount} unreadable excluded)</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
            <button
              type="button"
              onClick={closeImport}
              className="px-4 py-2 rounded-full bg-white/85 hover:bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              Cancel
            </button>
            {extractedItems.length > 0 && (
              <button
                type="button"
                onClick={handleAccept}
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-full bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <span>Accept & Auto-Fill into Quotation</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
