import React, { useEffect, useRef, useState } from 'react'

interface FathomPlayerProps {
  shareUrl?: string
  id?: string
  autoplay?: boolean
  startSeconds?: number
  aspectRatio?: string | number
  className?: string
  title?: string
}

function extractId(input?: string): string | null {
  if (!input) return null
  
  try {
    if (/^https?:\/\//i.test(input)) {
      const u = new URL(input)
      const parts = u.pathname.split('/').filter(Boolean)
      return parts.pop() || null
    }
    return input.trim()
  } catch {
    return null
  }
}

function toEmbedSrc(id: string, opts?: { autoplay?: boolean; timestamp?: number }) {
  const url = new URL(`https://fathom.video/embed/${id}`)
  
  if (opts && typeof opts.autoplay === 'boolean') {
    url.searchParams.set('autoplay', opts.autoplay ? '1' : '0')
  }
  
  if (opts && typeof opts.timestamp === 'number' && !Number.isNaN(opts.timestamp) && opts.timestamp > 0) {
    url.searchParams.set('timestamp', String(Math.floor(opts.timestamp)))
  }
  
  return url.toString()
}

const FathomPlayer: React.FC<FathomPlayerProps> = ({
  shareUrl,
  id,
  autoplay = false,
  startSeconds = 0,
  aspectRatio = '16 / 9',
  className = '',
  title = 'Fathom video'
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [currentSrc, setCurrentSrc] = useState<string>('')
  
  const resolvedId = id ?? extractId(shareUrl)
  
  useEffect(() => {
    if (resolvedId) {
      const src = toEmbedSrc(resolvedId, { autoplay, timestamp: startSeconds })
      setCurrentSrc(src)
    }
  }, [resolvedId, autoplay, startSeconds])
  
  // Method to update timestamp programmatically
  const seekToTimestamp = (seconds: number) => {
    if (resolvedId) {
      const src = toEmbedSrc(resolvedId, { autoplay: true, timestamp: seconds })
      setCurrentSrc(src)
    }
  }
  
  // Expose seekToTimestamp method via ref
  React.useImperativeHandle(
    React.forwardRef((props, ref) => ref),
    () => ({ seekToTimestamp }),
    [resolvedId]
  )
  
  if (!resolvedId) return null
  
  return (
    <div 
      className={`relative w-full bg-black rounded-2xl overflow-hidden ${className}`}
      style={{ 
        aspectRatio: typeof aspectRatio === 'number' 
          ? String(aspectRatio) 
          : aspectRatio 
      }}
    >
      <iframe
        ref={iframeRef}
        src={currentSrc}
        title={title}
        className="absolute inset-0 w-full h-full border-0"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  )
}

export default FathomPlayer