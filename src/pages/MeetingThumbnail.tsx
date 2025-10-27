import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import FathomPlayerV2 from '../components/FathomPlayerV2'

/**
 * Public page for generating meeting thumbnails via screenshot
 * This page is unauthenticated and optimized for Browserless/Playwright screenshots
 *
 * Usage: /meetings/thumbnail/:meetingId?shareUrl=...&recordingId=...&t=30
 */
export default function MeetingThumbnail() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const [searchParams] = useSearchParams()

  const shareUrl = searchParams.get('shareUrl') || searchParams.get('share_url')
  const recordingId = searchParams.get('recordingId') || searchParams.get('recording_id')
  const timestamp = parseInt(searchParams.get('t') || '0', 10)

  // Add a marker for screenshot automation
  useEffect(() => {
    document.body.setAttribute('data-thumbnail-ready', 'true')
  }, [])

  if (!shareUrl && !recordingId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl mb-4">Missing Parameters</h1>
          <p className="text-gray-400">
            Required: shareUrl or recordingId
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-0">
      {/* Full-screen video player with no chrome */}
      <div className="w-full h-screen">
        <FathomPlayerV2
          shareUrl={shareUrl || undefined}
          recordingId={recordingId || undefined}
          startSeconds={timestamp}
          autoplay={false}
          className="w-full h-full"
          title={`Meeting ${meetingId || recordingId}`}
          timeoutMs={15000}
          aspectRatio="16 / 9"
        />
      </div>
    </div>
  )
}
