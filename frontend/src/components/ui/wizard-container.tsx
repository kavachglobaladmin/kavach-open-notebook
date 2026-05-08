"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface WizardStep {
  number: number
  title: string
  description: string
}

interface WizardContainerProps {
  children: ReactNode
  currentStep: number
  steps: readonly WizardStep[]
  onStepClick?: (step: number) => void
  className?: string
}

function StepIndicator({ currentStep, steps, onStepClick }: {
  currentStep: number
  steps: readonly WizardStep[]
  onStepClick?: (step: number) => void
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white dark:bg-card">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.number
        const isCurrent = currentStep === step.number
        const isClickable = step.number <= currentStep && onStepClick
        
        return (
          <div key={step.number} className="flex items-center flex-1">
            <div 
              className={cn('flex items-center', isClickable && 'cursor-pointer')}
              onClick={isClickable ? () => onStepClick(step.number) : undefined}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all',
                  isCompleted || isCurrent
                    ? 'text-white shadow-md'
                    : 'border-2 border-gray-200 text-gray-400 bg-white dark:bg-card dark:border-gray-600 dark:text-gray-500'
                )}
                style={
                  isCompleted || isCurrent
                    ? { background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)' }
                    : undefined
                }
              >
                {isCompleted ? "✓" : step.number}
              </div>
              <div className="ml-3 min-w-0">
                <p className={cn(
                  'text-sm font-semibold',
                  isCurrent ? 'text-gray-900 dark:text-foreground' : 'text-gray-400 dark:text-muted-foreground'
                )}>
                  {step.title}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div 
                className={cn(
                  'flex-1 border-t-2 mx-4 transition-colors',
                  isCompleted ? 'border-violet-500' : 'border-gray-200 dark:border-border/60'
                )} 
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function WizardContainer({
  children,
  currentStep,
  steps,
  onStepClick,
  className
}: WizardContainerProps) {
  return (
    <div className={cn('flex flex-col h-[500px] min-w-0 overflow-hidden bg-white dark:bg-card rounded-lg border border-border', className)}>
      <StepIndicator
        currentStep={currentStep}
        steps={steps}
        onStepClick={onStepClick}
      />

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="h-full min-w-0 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export type { WizardStep }
