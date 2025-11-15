import React, { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import FathomPlayer from '@/components/FathomPlayer'
import FathomPlayerV2, { FathomPlayerV2Handle } from '@/components/FathomPlayerV2'
import { Info, ExternalLink } from 'lucide-react'

// Test recordings - replace with your own share URLs
const TEST_RECORDINGS = [
  {
    id: 'hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg',
    title: '60 Seconds Meeting',
    shareUrl: 'https://fathom.video/share/hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg',
    description: 'Real Fathom recording - Test 1'
  },
  {
    id: 'U1Yz5xseWpJ868zhtdsBypnN75jxiKVS',
    title: 'Mike Stedman Meeting',
    shareUrl: 'https://fathom.video/share/U1Yz5xseWpJ868zhtdsBypnN75jxiKVS',
    description: 'Real Fathom recording - Test 2'
  }
]

export function FathomComparison() {
  const [selectedRecording, setSelectedRecording] = useState(TEST_RECORDINGS[0])
  const [v1LoadTime, setV1LoadTime] = useState<number | null>(null)
  const [v2LoadTime, setV2LoadTime] = useState<number | null>(null)
  const [v1Loaded, setV1Loaded] = useState(false)
  const [v2Loaded, setV2Loaded] = useState(false)
  const [v2Failed, setV2Failed] = useState(false)
  const [startTime] = useState(Date.now())

  const v2Ref = useRef<FathomPlayerV2Handle>(null)

  const handleV1Load = () => {
    const loadTime = Date.now() - startTime
    setV1LoadTime(loadTime)
    setV1Loaded(true)
  }

  const handleV2Load = () => {
    const loadTime = Date.now() - startTime
    setV2LoadTime(loadTime)
    setV2Loaded(true)
    setV2Failed(false)
  }

  const handleV2Error = () => {
    setV2Failed(true)
  }

  const resetTest = () => {
    setV1LoadTime(null)
    setV2LoadTime(null)
    setV1Loaded(false)
    setV2Loaded(false)
    setV2Failed(false)
  }

  const handleRecordingChange = (recording: typeof TEST_RECORDINGS[0]) => {
    resetTest()
    setSelectedRecording(recording)
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Fathom Player Comparison</h1>
        <p className="text-muted-foreground">
          Compare the original FathomPlayer vs. the improved FathomPlayerV2 with timeout handling
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1">
            <p className="font-semibold">Testing Features:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>V1 (Original): Basic iframe embedding without timeout handling</li>
              <li>V2 (Improved): 6-second timeout, loading states, fallback UI, error recovery</li>
              <li>Both versions use the same share URL format</li>
              <li>Check browser console for detailed debug logs</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Recording Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Test Recording</CardTitle>
          <CardDescription>Choose a recording to test both player versions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TEST_RECORDINGS.map((recording) => (
              <Button
                key={recording.id}
                variant={selectedRecording.id === recording.id ? 'default' : 'outline'}
                onClick={() => handleRecordingChange(recording)}
              >
                {recording.title}
              </Button>
            ))}
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium">{selectedRecording.title}</div>
            <div className="text-xs text-muted-foreground">{selectedRecording.description}</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono break-all">
              {selectedRecording.shareUrl}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original FathomPlayer */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  FathomPlayer (V1)
                  <Badge variant="secondary">Original</Badge>
                </CardTitle>
                <CardDescription>Current implementation</CardDescription>
              </div>
              {v1Loaded && v1LoadTime && (
                <Badge variant="outline" className="text-green-600">
                  Loaded in {v1LoadTime}ms
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video">
              <FathomPlayer
                shareUrl={selectedRecording.shareUrl}
                title={selectedRecording.title}
              />
            </div>

            <div className="space-y-2 text-sm">
              <div className="font-semibold">Features:</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Basic iframe embedding</li>
                <li>No timeout handling</li>
                <li>No loading state</li>
                <li>No fallback UI</li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <div className="text-xs text-muted-foreground">
                Status: {v1Loaded ? '✅ Loaded' : '⏳ Loading...'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Improved FathomPlayerV2 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  FathomPlayerV2
                  <Badge>Improved</Badge>
                </CardTitle>
                <CardDescription>Enhanced with timeout & fallback</CardDescription>
              </div>
              {v2Loaded && v2LoadTime && (
                <Badge variant="outline" className="text-green-600">
                  Loaded in {v2LoadTime}ms
                </Badge>
              )}
              {v2Failed && (
                <Badge variant="destructive">
                  Load Failed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video">
              <FathomPlayerV2
                ref={v2Ref}
                shareUrl={selectedRecording.shareUrl}
                title={selectedRecording.title}
                timeoutMs={6000}
                onLoad={handleV2Load}
                onError={handleV2Error}
              />
            </div>

            <div className="space-y-2 text-sm">
              <div className="font-semibold">Features:</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>6-second timeout detection</li>
                <li>Loading state indicator</li>
                <li>Fallback UI on failure</li>
                <li>"Open in Fathom" button</li>
                <li>onLoad/onError callbacks</li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <div className="text-xs text-muted-foreground">
                Status: {v2Failed ? '❌ Failed (showing fallback)' : v2Loaded ? '✅ Loaded' : '⏳ Loading...'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Comparison */}
      {(v1LoadTime || v2LoadTime) && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Comparison</CardTitle>
            <CardDescription>Load time metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">V1 Load Time</div>
                <div className="text-2xl font-bold">
                  {v1LoadTime ? `${v1LoadTime}ms` : '—'}
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">V2 Load Time</div>
                <div className="text-2xl font-bold">
                  {v2LoadTime ? `${v2LoadTime}ms` : v2Failed ? 'Failed' : '—'}
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Difference</div>
                <div className="text-2xl font-bold">
                  {v1LoadTime && v2LoadTime
                    ? `${Math.abs(v1LoadTime - v2LoadTime)}ms`
                    : '—'}
                </div>
                {v1LoadTime && v2LoadTime && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {v2LoadTime < v1LoadTime ? 'V2 faster' : 'V1 faster'}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
          <CardDescription>Technical details and troubleshooting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-muted rounded-lg font-mono text-xs">
              <div className="font-semibold mb-1">Recording ID:</div>
              {selectedRecording.id}
            </div>
            <div className="p-3 bg-muted rounded-lg font-mono text-xs">
              <div className="font-semibold mb-1">Embed URL:</div>
              https://fathom.video/embed/{selectedRecording.id}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={resetTest}>
              Reset Test
            </Button>
            <Button variant="outline" asChild>
              <a href={selectedRecording.shareUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Fathom
              </a>
            </Button>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Troubleshooting:</strong> If both players fail to load, check browser console for errors.
              Common issues include CSP restrictions, ad blockers, or network firewalls blocking third-party iframes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Implementation Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <h4 className="font-semibold">Key Differences:</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong>Timeout Detection:</strong> V2 implements a 6-second timeout to detect when iframes fail to load.
              This prevents users from staring at a blank screen indefinitely.
            </li>
            <li>
              <strong>Loading State:</strong> V2 shows a loading spinner and message while the iframe is loading,
              providing better user feedback.
            </li>
            <li>
              <strong>Fallback UI:</strong> When the iframe fails to load (timeout or error), V2 displays a helpful
              message with a button to open the recording directly in Fathom.
            </li>
            <li>
              <strong>Debug Callbacks:</strong> V2 provides onLoad and onError callbacks for debugging and analytics.
            </li>
            <li>
              <strong>Backward Compatible:</strong> V2 maintains the same API as V1, making it a drop-in replacement.
            </li>
          </ul>

          <h4 className="font-semibold mt-4">When to Use V2:</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>When users may have strict CSP policies or ad blockers</li>
            <li>When you need better error handling and user feedback</li>
            <li>When you want to track loading success/failure rates</li>
            <li>For production environments where UX is critical</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
