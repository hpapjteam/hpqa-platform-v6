import React from "react";
import { CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface WizardStep {
  id: number | string;
  name: string;
  description?: string;
}

export interface QAWizardProps {
  steps: WizardStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onCancel?: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  canProceed?: boolean;
  children: React.ReactNode;
}

export function QAWizard({
  steps,
  currentStep,
  onNext,
  onPrev,
  onCancel,
  onSubmit,
  isSubmitting = false,
  canProceed = true,
  children
}: QAWizardProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === steps.length;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 flex flex-col">
      <div className="w-full mx-auto py-4 px-4 sm:px-8 flex flex-col flex-1">
        {/* Progress Bar */}
        <div className="mb-8 relative">
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-200">
            <div 
              style={{ width: `${(currentStep / steps.length) * 100}%` }} 
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#2b61d6] transition-all duration-300"
            ></div>
          </div>
          <div className="flex justify-between">
            {steps.map((step, idx) => {
              const stepNumber = idx + 1;
              const isActive = stepNumber === currentStep;
              const isCompleted = stepNumber < currentStep;
              
              return (
                <div key={step.id} className={cn(
                  "text-xs font-semibold flex flex-col items-center",
                  isActive ? "text-[#2b61d6]" : isCompleted ? "text-slate-700" : "text-slate-400"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center mb-1 border-2 bg-white transition-colors",
                    isActive ? "border-[#2b61d6] text-[#2b61d6]" : 
                    isCompleted ? "border-emerald-500 text-emerald-500" : "border-slate-200 text-slate-400"
                  )}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : stepNumber}
                  </div>
                  <span className="hidden sm:block">{step.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="mb-8 flex-1 flex flex-col">
          {children}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
          <Button 
            variant="outline" 
            type="button" 
            onClick={isFirstStep ? onCancel : onPrev} 
            className="border-slate-300"
          >
            {isFirstStep ? "Cancel" : (
              <>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </>
            )}
          </Button>
          
          {!isLastStep ? (
            <Button 
              type="button" 
              onClick={onNext} 
              disabled={!canProceed}
              className="gap-2 bg-[#2b61d6] hover:bg-blue-700 text-white"
            >
              Next Step
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              type="button" 
              onClick={onSubmit} 
              disabled={isSubmitting || !canProceed} 
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? "Saving..." : "Save Data"}
              {!isSubmitting && <CheckCircle2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
