import React, { useState, useEffect, useMemo } from 'react';
import { ExtractedLink } from './types';
import { extractLinksFromHtml, extractLinksMerged } from './linkParser';
import { 
  CheckCircle2, XCircle, Search, Filter, HelpCircle,
  ArrowRight, ExternalLink, RefreshCw, ChevronLeft, ChevronRight,
  Maximize2, Monitor, Smartphone, MessageSquare, Copy, Link as LinkIcon, Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BulkLinkQA } from './BulkLinkQA';
import { UrlValidationTable } from './UrlValidationTable';

interface QAWorkspaceProps {
  country?: string;
  versionName?: string;
  htmlSource: string;
  webViewUrl: string;
}

export function BrowserQAWorkspace({ htmlSource, webViewUrl, country, versionName }: QAWorkspaceProps) {
  const [links, setLinks] = useState<ExtractedLink[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchAndExtract = async () => {
      let viewHtml = htmlSource;
      if (webViewUrl && webViewUrl !== 'about:blank') {
        try {
          const res = await fetch(`/api/proxy?url=${encodeURIComponent(webViewUrl)}`);
          if (res.ok) {
            viewHtml = await res.text();
          }
        } catch (e) {
          console.error("Failed to fetch webViewUrl for extraction", e);
        }
      }
      
      if (viewHtml || htmlSource) {
        const extracted = extractLinksMerged(htmlSource, viewHtml);
        setLinks(extracted);
        if (extracted.length > 0 && !selectedLinkId) {
          setSelectedLinkId(extracted[0].id);
        }
      }
    };
    
    fetchAndExtract();
  }, [htmlSource, webViewUrl]);

  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      const matchesSearch = 
        link.moduleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.linkText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.href.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.alias.toLowerCase().includes(searchQuery.toLowerCase());
        
      if (!matchesSearch) return false;
      
      if (filter === 'failed') return link.status === 'failed';
      if (filter === 'passed') return link.status === 'passed';
      if (filter === 'unchecked') return link.status === 'unchecked';
      if (filter === "hero") return link.moduleName.toLowerCase().includes("hero");
      if (filter === "product") return link.moduleName.toLowerCase().includes("product");
      if (filter === "footer") return link.moduleName.toLowerCase().includes("footer");
      if (filter === "social") return link.moduleName.toLowerCase().includes("social");
      if (filter === "button") return link.moduleName.toLowerCase().includes("cta");
      
      return true;
    });
  }, [links, searchQuery, filter]);

  const selectedLink = useMemo(() => {
    return links.find(l => l.id === selectedLinkId) || null;
  }, [links, selectedLinkId]);

  const updateLinkStatus = (id: string, status: "passed" | "failed" | "unchecked") => {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const handleNext = () => {
    const currentIndex = filteredLinks.findIndex(l => l.id === selectedLinkId);
    if (currentIndex < filteredLinks.length - 1) {
      setSelectedLinkId(filteredLinks[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    const currentIndex = filteredLinks.findIndex(l => l.id === selectedLinkId);
    if (currentIndex > 0) {
      setSelectedLinkId(filteredLinks[currentIndex - 1].id);
    }
  };

  const stats = {
    total: links.length,
    checked: links.filter(l => l.status !== 'unchecked').length,
    passed: links.filter(l => l.status === 'passed').length,
    failed: links.filter(l => l.status === 'failed').length,
  };

  const getStatusIcon = (status: string) => {
    if (status === 'passed') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-rose-500" />;
    return <HelpCircle className="w-4 h-4 text-slate-300" />;
  };

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden text-sm">
      {/* LEFT SIDEBAR: Link List */}
      <div className="w-80 flex flex-col bg-white border-r border-slate-200 shrink-0 h-full">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-800 mb-2">QA Workspace</h2>
          
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-md border border-slate-200">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search links..." 
                className="bg-transparent border-none focus:outline-none text-xs w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {['all', 'unchecked', 'passed', 'failed'].map(f => (
                <button type="button"
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded-full border whitespace-nowrap capitalize font-medium",
                    filter === f 
                      ? "bg-[#2b61d6] text-white border-[#2b61d6]" 
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{stats.checked} / {stats.total} checked</span>
              <span>{Math.round((stats.checked / (stats.total || 1)) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${(stats.passed / (stats.total || 1)) * 100}%` }} />
              <div className="bg-rose-500 h-full" style={{ width: `${(stats.failed / (stats.total || 1)) * 100}%` }} />
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredLinks.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No links found.
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredLinks.map((link) => (
                <button type="button"
                  key={link.id}
                  onClick={() => setSelectedLinkId(link.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 border-b border-slate-100 text-left transition-colors",
                    selectedLinkId === link.id ? "bg-blue-50 border-l-4 border-l-[#2b61d6]" : "hover:bg-slate-50 border-l-4 border-l-transparent"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {getStatusIcon(link.status)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-semibold text-slate-800 text-xs truncate">
                        {link.moduleName}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mb-1">
                      {link.visibleText || "Image Link"}
                    </div>
                    <div className="text-[10px] text-[#2b61d6] truncate">
                      {link.href.replace(/^https?:\/\/(www\.)?hp\.com/, '')}
                    </div>
                  </div>
                  {link.imageUrl && (
                    <div className="w-10 h-10 shrink-0 bg-slate-100 rounded border border-slate-200 overflow-hidden flex items-center justify-center">
                      <img src={link.imageUrl} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MIDDLE PANEL: Link Details & Comparison */}
      <div className="w-[400px] flex flex-col bg-white border-r border-slate-200 shrink-0 h-full">
        {selectedLink ? (
          <div className="flex-1 flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-800">Compare Attributes</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200" onClick={() => updateLinkStatus(selectedLink.id, 'failed')}>
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Fail
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs bg-white text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200" onClick={() => updateLinkStatus(selectedLink.id, 'passed')}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pass
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              

              <div className="space-y-2">
              <div className="flex flex-wrap gap-2 mb-2">
                <Button size="sm" variant="outline" className="h-7 text-[10px] bg-slate-50 text-slate-600 hover:text-slate-900">Check HTTP Status</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] bg-slate-50 text-slate-600 hover:text-slate-900">Check Tracking</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] bg-slate-50 text-slate-600 hover:text-slate-900">Check Country</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] bg-[#2b61d6] text-white hover:bg-blue-700">Run All Checks</Button>
              </div>

                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">URL Comparison</h4>
                
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 break-all space-y-1">
                  <div className="text-[10px] font-semibold text-slate-500">Expected (Brief)</div>
                  <div className="text-xs font-medium text-slate-800 flex items-start gap-2">
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    {selectedLink.expectedUrl || "Not mapped from brief yet"}
                  </div>
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="w-4 h-4 text-slate-300 transform rotate-90" />
                </div>
                
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 break-all space-y-1">
                  <div className="text-[10px] font-semibold text-blue-600">Extracted from HTML</div>
                  <div className="text-xs font-medium text-slate-800 flex items-start gap-2">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    {selectedLink.href}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-semibold text-slate-500 mb-1">HTTP Status</div>
                  <div className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 200 OK
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-semibold text-slate-500 mb-1">Redirects</div>
                  <div className="text-sm font-bold text-slate-700">0</div>
                </div>
              </div>


              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attributes</h4>
                <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-100">
                  <div className="p-3">
                    <div className="text-[10px] font-semibold text-slate-500 mb-0.5">Alt Text</div>
                    <div className="text-xs text-slate-800">{selectedLink.alt || <span className="text-slate-400 italic">None</span>}</div>
                  </div>
                  <div className="p-3">
                    <div className="text-[10px] font-semibold text-slate-500 mb-0.5">Alias</div>
                    <div className="text-xs text-slate-800">{selectedLink.alias || <span className="text-slate-400 italic">None</span>}</div>
                  </div>
                  <div className="p-3">
                    <div className="text-[10px] font-semibold text-slate-500 mb-0.5">Visible Text</div>
                    <div className="text-xs text-slate-800">{selectedLink.linkText || <span className="text-slate-400 italic">None</span>}</div>
                  </div>
                </div>
              </div>
              

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tracking Params</h4>
                {Object.keys(selectedLink.tracking).length > 0 ? (
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 space-y-2">
                    {Object.entries(selectedLink.tracking).map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-xs">
                        <span className="font-semibold text-slate-600 w-24 shrink-0 truncate" title={key}>{key}</span>
                        <span className="text-slate-800 break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                    No tracking parameters found.
                  </div>
                )}
              </div>
              
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
               <Button size="sm" variant="outline" className="w-1/2 h-8 text-xs" onClick={handlePrev} disabled={filteredLinks.findIndex(l => l.id === selectedLinkId) <= 0}>
                 <ChevronLeft className="w-4 h-4 mr-1" /> Previous
               </Button>
               <Button size="sm" variant="outline" className="w-1/2 h-8 text-xs bg-slate-50" onClick={handleNext} disabled={filteredLinks.findIndex(l => l.id === selectedLinkId) >= filteredLinks.length - 1}>
                 Next <ChevronRight className="w-4 h-4 ml-1" />
               </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <LinkIcon className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-sm font-medium text-slate-700">Select a link to compare</p>
            <p className="text-xs mt-1">Choose a link from the left sidebar to view details and perform browser QA.</p>
          </div>
        )}
      </div>

      <UrlValidationTable 
        links={filteredLinks} 
        activeLinkId={selectedLinkId || undefined} 
        onLinkSelect={setSelectedLinkId}
        onStatusUpdate={updateLinkStatus}
        expectedCountry={country}
        expectedVersion={versionName}
      />
    </div>
  );
}
