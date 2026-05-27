'use client'

import React, { useState } from 'react'
import { useInfographic, useGenerateInfographic } from '@/lib/hooks/use-infographic'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { InfographicInsightViewer } from './InfographicInsightViewer'

interface InfographicViewerProps {
  sourceId: string
  autoGenerate?: boolean
}

export function InfographicViewer({ sourceId, autoGenerate = true }: InfographicViewerProps) {
  const [shouldGenerate, setShouldGenerate] = useState(autoGenerate)
  
  // Fetch infographic data
  const { data: infographic, isLoading, error, refetch } = useInfographic(sourceId, {
    enabled: shouldGenerate,
  })

  // Mutation for generating infographic
  const generateMutation = useGenerateInfographic()

  const handleGenerate = async () => {
    setShouldGenerate(true)
    await generateMutation.mutateAsync(sourceId)
    refetch()
  }

  // Show loading state
  if (isLoading || generateMutation.isPending) {
    return (
      <Card className="p-8 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {generateMutation.isPending ? 'Generating infographic...' : 'Loading infographic...'}
        </p>
      </Card>
    )
  }

  // Show error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="ml-2">
          <div className="flex flex-col gap-2">
            <p>Failed to load infographic: {error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              className="w-fit"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Show empty state with generate button
  if (!infographic) {
    return (
      <Card className="p-8 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">No infographic generated yet</p>
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="gap-2"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Generate Infographic
            </>
          )}
        </Button>
      </Card>
    )
  }

  // Show infographic
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Infographic Analysis</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="gap-2"
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </Button>
      </div>
      
      <div className="overflow-auto max-h-[70vh] rounded-lg border">
        <InfographicInsightViewer 
          content={JSON.stringify(infographic)} 
        />
      </div>
    </div>
  )
}
