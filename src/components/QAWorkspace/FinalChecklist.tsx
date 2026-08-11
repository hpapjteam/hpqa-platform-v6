import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, MinusCircle, ListChecks, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportQAVerificationReceiptPDF } from "@/src/lib/export-qa-pdf";
import { exportQAChecklistToExcel } from "@/src/lib/export-qa-excel";

interface FinalChecklistProps {
  checklists: any[];
  answers: Record<string, any>;
  campaignMeta?: {
    campaignName?: string;
    team?: string;
    country?: string;
    versionName?: string;
    userEmail?: string;
    campaignStatus?: string;
  };
}

export function FinalChecklist({ checklists, answers, campaignMeta }: FinalChecklistProps) {
  if (checklists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <ListChecks className="w-12 h-12 mb-3 text-slate-300" />
        <p>No checkpoints were defined for this campaign.</p>
      </div>
    );
  }

  // Group checklists by stage (1-7 and 0 for global)
  const stages = [1, 2, 3, 4, 5, 6, 7, 0];
  const stageNames: Record<number, string> = {
    1: "Details & Source",
    2: "Visual Comparison",
    3: "Alt & Alias Tags",
    4: "Link Validation",
    5: "Grammar & Spell Check",
    6: "Review & Decision",
    7: "Final Checklist",
    0: "Global Checkpoints (All Stages)"
  };

  const handleExportPDF = () => {
    exportQAVerificationReceiptPDF({
      campaignName: campaignMeta?.campaignName || "Campaign Verification Summary",
      team: campaignMeta?.team || "QA Team",
      country: campaignMeta?.country || "Global",
      versionName: campaignMeta?.versionName || "v1",
      userEmail: campaignMeta?.userEmail || "qa@hp.com",
      campaignStatus: campaignMeta?.campaignStatus || "In Progress",
      checklists,
      answers
    });
  };

  const handleExportExcel = () => {
    exportQAChecklistToExcel({
      campaignName: campaignMeta?.campaignName || "Campaign Verification Summary",
      team: campaignMeta?.team || "QA Team",
      country: campaignMeta?.country || "Global",
      versionName: campaignMeta?.versionName || "v1",
      userEmail: campaignMeta?.userEmail || "qa@hp.com",
      campaignStatus: campaignMeta?.campaignStatus || "In Progress",
      checklists,
      answers
    });
  };
  
  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full pb-10 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <ListChecks className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Campaign Checklist Summary</h2>
            <p className="text-sm text-slate-500">Review all checkpoints and their statuses across all stages.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={handleExportPDF}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF Receipt</span>
          </Button>

          <Button
            type="button"
            onClick={handleExportExcel}
            className="bg-[#107c41] hover:bg-[#0b5c30] text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.csv/.xlsx)</span>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {stages.map(stageNum => {
          const items = checklists.filter(c => c.stage === stageNum);
          if (items.length === 0) return null;
          
          return (
            <Card key={stageNum} className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-4">
                <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shadow-xs">
                    {stageNum === 0 ? '*' : stageNum}
                  </div>
                  {stageNum === 0 ? "Global Checkpoints (All Stages)" : `Stage ${stageNum}: ${stageNames[stageNum] || `Stage ${stageNum}`}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {items.map(item => {
                    const ans = answers[item.id] || { status: null, text: "" };
                    const isChecked = ans.status === "Checked";
                    const isNA = ans.status === "N/A";
                    const isMissing = !ans.status;

                    return (
                      <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 font-medium">{item.text}</p>
                          {item.requiresInput && isChecked && ans.text && (
                            <div className="mt-1.5 p-2 bg-indigo-50/50 border border-indigo-100 rounded text-sm text-indigo-900">
                              <span className="font-semibold text-indigo-700 mr-2">Input / Note:</span> 
                              {ans.text}
                            </div>
                          )}
                        </div>
                        
                        <div className="shrink-0 flex items-center">
                          {isChecked && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Checked
                            </span>
                          )}
                          {isNA && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              <MinusCircle className="w-3.5 h-3.5" /> N/A
                            </span>
                          )}
                          {isMissing && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                              <XCircle className="w-3.5 h-3.5" /> Missed
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
