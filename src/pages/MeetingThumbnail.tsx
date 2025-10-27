import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import FathomPlayerV2 from '../components/FathomPlayerV2'

/**
 * Public page for generating meeting thumbnails via screenshot
 * This page is unauthenticated and optimized for Browserless/Playwright screenshots
 *
 * Ultra-minimal full-screen video embed - no chrome, no padding, no margins
 * The video iframe fills the entire viewport for clean screenshots
 *
 * Usage: /meetings/thumbnail/:meetingId?shareUrl=...&recordingId=...&t=30
 */
export default function MeetingThumbnail() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const [searchParams] = useSearchParams()

  const shareUrl = searchParams.get('shareUrl') || searchParams.get('share_url')
  const recordingId = searchParams.get('recordingId') || searchParams.get('recording_id')
  const timestamp = parseInt(searchParams.get('t') || '0', 10)

  // Set up full-screen layout and add marker for screenshot automation
  useEffect(() => {
    // Remove all body margins/padding for true full-screen
    document.body.style.margin = '0'
    document.body.style.padding = '0'
    document.body.style.overflow = 'hidden'
    document.body.style.backgroundColor = '#000'

    // Add marker that Playwright waits for
    document.body.setAttribute('data-thumbnail-ready', 'true')

    return () => {
      // Cleanup on unmount
      document.body.style.margin = ''
      document.body.style.padding = ''
      document.body.style.overflow = ''
      document.body.style.backgroundColor = ''
    }
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
    <div className="w-screen h-screen bg-black overflow-hidden m-0 p-0">
      {/* Ultra-minimal full-screen video player - fills entire viewport */}
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
  )
}
