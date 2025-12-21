import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Copy,
  Check,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface MermaidRendererProps {
  code: string;
  title?: string;
  description?: string;
  className?: string;
  showControls?: boolean;
  showCode?: boolean;
}

/**
 * MermaidRenderer component that renders Mermaid diagrams client-side.
 * Uses dynamic import to load mermaid library only when needed.
 */
export const MermaidRenderer = memo(function MermaidRenderer({
  code,
  title,
  description,
  className,
  showControls = true,
  showCode = false,
}: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showCodePanel, setShowCodePanel] = useState(showCode);

  // Initialize and render mermaid diagram
  const renderDiagram = useCallback(async () => {
    if (!code) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Dynamic import of mermaid
      const mermaid = await import('mermaid');

      // Initialize mermaid with dark mode support
      mermaid.default.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        securityLevel: 'strict',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        flowchart: {
          htmlLabels: true,
          curve: 'basis',
          padding: 20,
        },
        themeVariables: {
          primaryColor: '#10b981',
          primaryTextColor: '#fff',
          primaryBorderColor: '#059669',
          lineColor: '#6b7280',
          secondaryColor: '#3b82f6',
          tertiaryColor: '#f3f4f6',
        },
      });

      // Generate unique ID for this diagram
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Render the diagram
      const { svg } = await mermaid.default.render(id, code);
      setSvgContent(svg);
    } catch (err) {
      console.error('Mermaid render error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
    } finally {
      setLoading(false);
    }
  }, [code]);

  // Re-render on code change
  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  // Re-render on theme change
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          renderDiagram();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [renderDiagram]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Mermaid code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  }, [code]);

  const handleDownloadSvg = useCallback(() => {
    if (!svgContent) return;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title?.replace(/\s+/g, '-').toLowerCase() || 'process-map'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('SVG downloaded');
  }, [svgContent, title]);

  const handleDownloadPng = useCallback(async () => {
    if (!svgContent || !containerRef.current) return;

    try {
      // Create canvas from SVG
      const svgElement = containerRef.current.querySelector('svg');
      if (!svgElement) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get SVG dimensions
      const svgRect = svgElement.getBoundingClientRect();
      const scale = 2; // For higher resolution
      canvas.width = svgRect.width * scale;
      canvas.height = svgRect.height * scale;

      // Create image from SVG
      const img = new Image();
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        // Download
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${title?.replace(/\s+/g, '-').toLowerCase() || 'process-map'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('PNG downloaded');
      };

      img.src = url;
    } catch (err) {
      toast.error('Failed to download PNG');
    }
  }, [svgContent, title]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {(title || description) && (
        <CardHeader className="pb-3">
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && (
            <CardDescription className="line-clamp-2">{description}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className="p-0">
        {/* Controls */}
        {showControls && (
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.25}
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetZoom}
                disabled={zoom === 1}
                title="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCodePanel(!showCodePanel)}
                title={showCodePanel ? 'Hide code' : 'Show code'}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                title="Copy Mermaid code"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadSvg}
                disabled={!svgContent}
                title="Download SVG"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Diagram container */}
        <div className="relative">
          {loading && (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">Failed to render diagram</p>
              <p className="text-xs text-destructive mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && svgContent && (
            <div
              ref={containerRef}
              className="overflow-auto p-4"
              style={{
                maxHeight: '600px',
              }}
            >
              <div
                className="transition-transform duration-200 origin-top-left"
                style={{
                  transform: `scale(${zoom})`,
                }}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>
          )}
        </div>

        {/* Code panel */}
        {showCodePanel && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50">
              <span className="text-xs font-medium text-muted-foreground">Mermaid Code</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <pre className="p-4 text-xs overflow-auto max-h-48 bg-gray-900 text-gray-100">
              <code>{code}</code>
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default MermaidRenderer;
