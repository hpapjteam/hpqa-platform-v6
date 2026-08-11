import React, { useState } from 'react';
import { CheckSquare, X, ChevronLeft, ChevronRight, CheckCircle2, MinusCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
export interface ChecklistItem { id: string; text: string; stage?: number; requiresInput?: boolean; inputPlaceholder?: string; }
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


interface MasterChecklistSidebarProps {
  checklists: ChecklistItem[];
  answers: Record<string, { status: string, text?: string }>;
}

export function MasterChecklistSidebar({ checklists, answers }: MasterChecklistSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Checked': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'N/A': return <MinusCircle className="w-4 h-4 text-slate-400" />;
      default: return <HelpCircle className="w-4 h-4 text-orange-400" />;
    }
  };

  const getStageName = (stage: number) => {
    if (stage === 0) return "Global";
    const stages = ["", "Campaign Info", "Visual QA", "Tag QA", "Link QA", "Grammar QA", "Rendering QA", "Final Review"];
    return stages[stage] || `Stage ${stage}`;
  };

  const grouped = checklists.reduce((acc, item) => {
    const s = item.stage || 0;
    if (!acc[s]) acc[s] = [];
    acc[s].push(item);
    return acc;
  }, {} as Record<number, ChecklistItem[]>);

  return (
    <>
      {/* Trigger Zone / Button */}
      <div 
        className={cn(
          "fixed top-1/2 right-0 -translate-y-1/2 z-[100] flex items-center transition-transform duration-300",
          isOpen ? "translate-x-full" : "translate-x-0"
        )}
        onMouseEnter={() => setIsOpen(true)}
      >
        <button className="bg-[#2b61d6] text-white p-2 rounded-l-md shadow-lg flex flex-col items-center gap-2 hover:bg-blue-700 transition-colors border border-r-0 border-blue-600">
          <ChevronLeft className="w-4 h-4" />
          <span style={{ writingMode: 'vertical-rl' }} className="font-semibold text-xs tracking-wider">MASTER CHECKLIST</span>
        </button>
      </div>

      {/* Sidebar Panel */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-full w-[400px] max-w-[90vw] bg-slate-50 shadow-2xl border-l border-slate-200 z-[101] transition-transform duration-300 flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#2b61d6]" />
            <h2 className="font-bold text-slate-800">Master Checklist</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([stageStr, items]) => {
            const stage = Number(stageStr);
            const total = items.length;
            const completed = items.filter(i => answers[i.id]?.status === 'Checked' || answers[i.id]?.status === 'N/A').length;
            
            return (
              <div key={stage} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h3 className="text-sm font-bold text-slate-700">{getStageName(stage)}</h3>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", completed === total ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700")}>
                    {completed}/{total}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map(item => {
                    const ans = answers[item.id];
                    return (
                      <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {getStatusIcon(ans?.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 break-words">{item.text}</p>
                          {ans?.text && (
                            <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded text-xs text-slate-600 italic">
                              "{ans.text}"
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
