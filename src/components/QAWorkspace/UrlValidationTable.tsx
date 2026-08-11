import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, Clock, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractedLink } from './types';
import { cn } from '@/lib/utils';

interface UrlValidationTableProps {
  expectedCountry?: string;
  expectedVersion?: string;
  links: ExtractedLink[];
  onStatusUpdate?: (linkId: string, status: 'passed' | 'failed') => void;
  activeLinkId?: string;
  onLinkSelect?: (linkId: string) => void;
}

interface LinkCheckResult {
  status: number;
  finalUrl: string;
  responseTime: number;
  error?: string;
}

export function UrlValidationTable({ links, onStatusUpdate, activeLinkId, onLinkSelect, expectedCountry, expectedVersion }: UrlValidationTableProps) {
  const [results, setResults] = useState<Record<string, LinkCheckResult>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [isCheckingAll, setIsCheckingAll] = useState(false);

    const checkUrl = async (linkId: string, url: string) => {
    setLoadingIds(prev => new Set(prev).add(linkId));
    try {
      const response = await fetch('/api/check-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await response.json();
      
      let finalUrl = data.finalUrl || '';
      // Resolve sfmc if needed, but the backend fetch with redirect="follow" should already resolve the final URL
      // Let's add flag logic for country/version mismatch
      let urlError = data.error;
      
      if (!urlError && finalUrl) {
        const lowerUrl = finalUrl.toLowerCase();
        if (expectedCountry && !lowerUrl.includes(`/${expectedCountry.toLowerCase()}/`)) {
          // Warning: Country mismatch
          urlError = (urlError ? urlError + " | " : "") + `Country mismatch (${expectedCountry} not found in URL)`;
        }
        if (expectedVersion && !lowerUrl.includes(expectedVersion.toLowerCase())) {
          // Warning: Version mismatch
          urlError = (urlError ? urlError + " | " : "") + `Version mismatch (${expectedVersion} not found in URL)`;
        }
      }
      
      setResults(prev => ({
        ...prev,
        [linkId]: { 
          status: data.status || 0, 
          finalUrl: finalUrl, 
          responseTime: data.responseTime || 0, 
          error: urlError 
        }
      }));

      if (onStatusUpdate && !urlError) {
        if (data.status >= 200 && data.status < 400) {
          onStatusUpdate(linkId, 'passed');
        } else {
          onStatusUpdate(linkId, 'failed');
        }
      } else if (onStatusUpdate && urlError) {
        onStatusUpdate(linkId, 'failed');
      }
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [linkId]: { status: 0, finalUrl: '', responseTime: 0, error: 'Network Error' }
      }));
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }
  };

  const handleCheckAll = async () => {
    setIsCheckingAll(true);
    const batchSize = 3;
    for (let i = 0; i < links.length; i += batchSize) {
      const batch = links.slice(i, i + batchSize);
      await Promise.all(batch.map(link => checkUrl(link.id, link.href)));
    }
    setIsCheckingAll(false);
  };

  const uniqueLinks = Array.from(new Map(links.map(item => [item.href, item])).values());
  const passedCount = Object.values(results).filter((r: any) => r.status >= 200 && r.status < 400).length;
  const failedCount = Object.values(results).filter((r: any) => r.status >= 400 || r.error).length;

  return (
    <div className="flex-1 flex flex-col bg-white border-l border-slate-200 h-full">
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 bg-slate-50">
        <div>
          <h2 className="font-bold text-slate-800">URL Validation</h2>
          <p className="text-xs text-slate-500">Extracted from View Online, tags from Code</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-sm font-medium">
            <span className="text-slate-600">Total: {uniqueLinks.length}</span>
            <span className="text-emerald-600">Valid: {passedCount}</span>
            <span className="text-rose-600">Broken: {failedCount}</span>
          </div>
          <Button 
            size="sm" 
            onClick={handleCheckAll}
            disabled={isCheckingAll}
            className="bg-[#2b61d6] text-white hover:bg-blue-700 h-8"
          >
            {isCheckingAll ? (
              <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Validating...</>
            ) : (
              <><Play className="w-3.5 h-3.5 mr-2" /> Validate All</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-md border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="px-4 py-3 font-semibold">URL / Alias / Alt</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {uniqueLinks.map((link) => {
                const isLoading = loadingIds.has(link.id);
                const result = results[link.id];
                const isSuccess = result && result.status >= 200 && result.status < 300;
                const isRedirect = result && result.status >= 300 && result.status < 400;
                const isError = result && (result.status >= 400 || result.error);

                return (
                  <tr 
                    key={link.id} 
                    className={cn(
                      "hover:bg-slate-50 transition-colors cursor-pointer",
                      activeLinkId === link.id ? "bg-blue-50/50" : ""
                    )}
                    onClick={() => onLinkSelect?.(link.id)}
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                        {link.moduleName || 'Link'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-slate-800 font-medium break-all mb-1">{link.href}</div>
                      <div className="flex flex-col gap-0.5 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-semibold w-8">Alias:</span>
                          <span className={link.alias ? "text-blue-600 font-mono" : "text-slate-400 italic"}>
                            {link.alias || 'Missing'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-semibold w-8">Alt:</span>
                          <span className={link.alt ? "text-slate-600" : "text-slate-400 italic"}>
                            {link.alt || 'Missing'}
                          </span>
                        </div>
                      </div>
                      
                      {isRedirect && result.finalUrl && (
                        <div className="mt-2 text-xs flex items-start gap-1.5 p-2 bg-amber-50 rounded border border-amber-100 text-amber-800">
                          <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="break-all">{result.finalUrl}</span>
                        </div>
                      )}
                      
                      {isError && result.error && (
                        <div className="mt-2 text-xs flex items-center gap-1.5 p-2 bg-rose-50 rounded border border-rose-100 text-rose-800">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {result.error}
                        </div>
                      )}
                      
                      {result && result.finalUrl && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <div className="text-[10px] text-slate-500 font-semibold mb-1">FINAL URL</div>
                          <div className="text-xs text-blue-700 break-all bg-blue-50 p-2 rounded">{result.finalUrl}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {isLoading ? (
                        <span className="flex items-center gap-1.5 text-blue-600 text-xs font-medium">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking
                        </span>
                      ) : result ? (
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                            isSuccess ? "bg-emerald-100 text-emerald-700" : 
                            isRedirect ? "bg-amber-100 text-amber-700" : 
                            "bg-rose-100 text-rose-700"
                          )}>
                            {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                             isRedirect ? <ArrowRight className="w-3.5 h-3.5" /> : 
                             <XCircle className="w-3.5 h-3.5" />}
                            {result.status > 0 ? (
                              isSuccess ? "Valid (200)" : 
                              isRedirect ? `Redirecting (${result.status})` : 
                              `Broken (${result.status})`
                            ) : "Failed"}
                          </span>
                          {result.responseTime > 0 && (
                            <span className="text-[10px] text-slate-400 pl-1">
                              {result.responseTime}ms
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Not checked</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs"
                        disabled={isLoading}
                        onClick={(e) => {
                          e.stopPropagation();
                          checkUrl(link.id, link.href);
                        }}
                      >
                        Validate
                      </Button>
                    </td>
                  </tr>
                );
              })}
              
              {uniqueLinks.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No URLs extracted.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
