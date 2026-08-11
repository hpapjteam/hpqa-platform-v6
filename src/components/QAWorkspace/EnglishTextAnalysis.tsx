import React, { useState, useEffect, useCallback } from 'react';
import { analyzeEnglishText, TextAnalysisResult, TextIssue } from '@/lib/text-analyzer';
import { 
  CheckCircle2, AlertTriangle, Sparkles, 
  Copy, Check, RefreshCw, Type, ExternalLink, Globe, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EnglishTextAnalysisProps {
  htmlSource: string;
  webViewUrl?: string;
  onFixApplied?: (updatedHtml: string) => void;
}

export function EnglishTextAnalysis({ htmlSource, webViewUrl, onFixApplied }: EnglishTextAnalysisProps) {
  const [analysis, setAnalysis] = useState<TextAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'spelling' | 'grammar' | 'widow' | 'brand'>('all');
  const [copiedIssueId, setCopiedIssueId] = useState<string | null>(null);
  const [loadedFromViewOnline, setLoadedFromViewOnline] = useState(false);

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    let targetHtml = htmlSource;

    // If webViewUrl is provided, attempt to fetch content from View Online URL first
    if (webViewUrl && webViewUrl.startsWith('http')) {
      try {
        const response = await fetch(webViewUrl, { mode: 'cors' });
        if (response.ok) {
          const fetchedHtml = await response.text();
          if (fetchedHtml && fetchedHtml.length > 50) {
            targetHtml = fetchedHtml;
            setLoadedFromViewOnline(true);
          }
        }
      } catch (e) {
        console.log("Could not fetch webViewUrl directly due to CORS or network; falling back to template HTML source.");
      }
    }

    try {
      const res = await analyzeEnglishText(targetHtml || htmlSource || "");
      setAnalysis(res);
    } catch (err) {
      console.error('Failed to run English text analysis:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [htmlSource, webViewUrl]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const handleCopySuggestion = (issue: TextIssue) => {
    if (issue.suggestions && issue.suggestions.length > 0) {
      navigator.clipboard.writeText(issue.suggestions[0]);
      setCopiedIssueId(issue.id);
      setTimeout(() => setCopiedIssueId(null), 2000);
    }
  };

  const handleFixWidows = () => {
    if (!htmlSource) return;
    let updated = htmlSource;
    if (analysis) {
      analysis.issues.filter(i => i.type === 'widow').forEach(i => {
        const regex = new RegExp(`\\s+(${i.word})([<\\s\\.,!\\?]|$)`, 'g');
        updated = updated.replace(regex, `&nbsp;$1$2`);
      });
      onFixApplied?.(updated);
      runAnalysis();
    }
  };

  const filteredIssues = analysis ? analysis.issues.filter(i => {
    if (filter === 'all') return true;
    return i.type === filter;
  }) : [];

  const grammarCount = analysis ? analysis.issues.filter(i => i.type === 'grammar').length : 0;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs p-4 md:p-6 space-y-5">
      {/* Header with CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Type className="w-5 h-5 text-[#2b61d6]" />
            <h2 className="text-base font-bold text-slate-900">Grammar &amp; Spell Check Audit</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Loads View Online template and scans entire content using free spellcheck &amp; grammar APIs (LanguageTool API + Marketing Dictionary).
          </p>
        </div>

        <Button
          type="button"
          onClick={runAnalysis}
          disabled={isAnalyzing}
          size="sm"
          className="bg-[#2b61d6] hover:bg-blue-700 text-white font-bold text-xs gap-2 px-4 py-2 shadow-sm cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Scanning View Online &amp; Template...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Check Spell and Grammar Checks</span>
            </>
          )}
        </Button>
      </div>

      {/* View Online Status Banner */}
      {webViewUrl && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-[#2b61d6] shrink-0" />
            <span className="font-semibold text-slate-700 shrink-0">View Online Target:</span>
            <span className="font-mono text-slate-900 truncate max-w-md">{webViewUrl}</span>
            {loadedFromViewOnline && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                Loaded Live HTML
              </span>
            )}
          </div>
          <a
            href={webViewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[#2b61d6] font-bold hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Open Link</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Stats Cards */}
      {analysis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Words</div>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{analysis.totalWords}</div>
          </div>

          <div className={cn(
            "border rounded-lg p-3",
            analysis.spellingErrorsCount > 0 ? "bg-rose-50/80 border-rose-200" : "bg-slate-50 border-slate-200/80"
          )}>
            <div className="text-[11px] font-semibold text-rose-800 uppercase">Spelling Typos</div>
            <div className="text-xl font-bold text-rose-900 mt-0.5">{analysis.spellingErrorsCount}</div>
          </div>

          <div className={cn(
            "border rounded-lg p-3",
            grammarCount > 0 ? "bg-purple-50/80 border-purple-200" : "bg-slate-50 border-slate-200/80"
          )}>
            <div className="text-[11px] font-semibold text-purple-800 uppercase">Grammar Issues</div>
            <div className="text-xl font-bold text-purple-900 mt-0.5">{grammarCount}</div>
          </div>

          <div className={cn(
            "border rounded-lg p-3",
            analysis.widowWordsCount > 0 ? "bg-amber-50/80 border-amber-200" : "bg-slate-50 border-slate-200/80"
          )}>
            <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
              <span>Widow Words</span>
              {analysis.widowWordsCount > 0 && (
                <Button 
                  type="button" 
                  onClick={handleFixWidows} 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 px-1.5 text-[10px] bg-amber-200/60 hover:bg-amber-300 text-amber-900 font-bold rounded"
                >
                  Fix All &amp;nbsp;
                </Button>
              )}
            </div>
            <div className="text-xl font-bold text-amber-900 mt-0.5">{analysis.widowWordsCount}</div>
          </div>

          <div className={cn(
            "border rounded-lg p-3",
            analysis.brandInconsistenciesCount > 0 ? "bg-blue-50/80 border-blue-200" : "bg-slate-50 border-slate-200/80"
          )}>
            <div className="text-[11px] font-semibold text-blue-800 uppercase">Brand Rules</div>
            <div className="text-xl font-bold text-blue-900 mt-0.5">{analysis.brandInconsistenciesCount}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <span className="text-xs font-bold text-slate-500 uppercase mr-1">Filter Results:</span>
        {(['all', 'spelling', 'grammar', 'widow', 'brand'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize cursor-pointer",
              filter === f 
                ? "bg-slate-800 text-white shadow-2xs" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {f} {analysis ? `(${f === 'all' ? analysis.issues.length : analysis.issues.filter(i => i.type === f).length})` : ''}
          </button>
        ))}
      </div>

      {/* Issues List at Bottom */}
      <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[420px]">
        {isAnalyzing ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span>Scanning View Online template for wrong spelling and grammar suggestions...</span>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="p-10 text-center bg-emerald-50/50 border border-emerald-200/60 rounded-xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h3 className="font-bold text-emerald-900 text-sm">No Grammar or Spelling Issues Detected!</h3>
            <p className="text-xs text-emerald-700 max-w-md mx-auto">
              All body text, headings, and brand names passed dictionary spellcheck, LanguageTool grammar API, and widow word scans.
            </p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className={cn(
                "p-3.5 rounded-lg border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all",
                issue.type === 'spelling' ? "bg-rose-50/50 border-rose-200/80" :
                issue.type === 'grammar' ? "bg-purple-50/50 border-purple-200/80" :
                issue.type === 'widow' ? "bg-amber-50/50 border-amber-200/80" :
                "bg-blue-50/50 border-blue-200/80"
              )}
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    issue.type === 'spelling' ? "bg-rose-600 text-white" :
                    issue.type === 'grammar' ? "bg-purple-600 text-white" :
                    issue.type === 'widow' ? "bg-amber-600 text-white" :
                    "bg-blue-600 text-white"
                  )}>
                    {issue.type}
                  </span>
                  <span className="font-bold text-slate-900">{issue.message}</span>
                </div>

                <div className="text-slate-600 font-mono text-[11px] bg-white/80 p-2 rounded border border-slate-200/60 mt-1">
                  Context: <span className="text-slate-900 font-bold">{issue.context}</span>
                </div>
              </div>

              {issue.suggestions && issue.suggestions.length > 0 && (
                <div className="flex items-center gap-2 shrink-0 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[11px] text-slate-500 font-semibold">Suggested Fix:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopySuggestion(issue)}
                    className="h-7 px-2.5 text-xs bg-slate-50 text-slate-900 border-slate-300 hover:bg-slate-100 font-mono font-bold cursor-pointer"
                  >
                    {copiedIssueId === issue.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500 mr-1" />
                    )}
                    {issue.suggestions[0]}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
