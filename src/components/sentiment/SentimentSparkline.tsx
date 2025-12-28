/**
 * SentimentSparkline - Mini line chart for sentiment history
 *
 * Displays a compact sparkline visualization of sentiment trends over time.
 * Uses inline SVG for performance - no external charting library required.
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SentimentSparklineProps {
  /** Array of sentiment scores (-1 to +1), in chronological order */
  values: number[];
  /** Width of the sparkline in pixels */
  width?: number;
  /** Height of the sparkline in pixels */
  height?: number;
  /** CSS class name */
  className?: string;
  /** Show dots at data points */
  showDots?: boolean;
}

export function SentimentSparkline({
  values,
  width = 60,
  height = 24,
  className,
  showDots = false,
}: SentimentSparklineProps) {
  const pathData = useMemo(() => {
    if (!values.length) return null;

    const padding = 2;
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;

    // Normalize values from [-1, 1] to [0, effectiveHeight]
    // Invert because SVG y-axis goes down
    const normalizedValues = values.map(v => {
      const normalized = ((v + 1) / 2) * effectiveHeight;
      return effectiveHeight - normalized + padding;
    });

    const xStep = values.length > 1 ? effectiveWidth / (values.length - 1) : 0;

    // Build path
    const points = normalizedValues.map((y, i) => ({
      x: padding + i * xStep,
      y,
    }));

    const pathString = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    // Calculate gradient color based on trend
    const firstValue = values[0] ?? 0;
    const lastValue = values[values.length - 1] ?? 0;
    const trend = lastValue - firstValue;

    return {
      path: pathString,
      points,
      trend,
      lastValue,
    };
  }, [values, width, height]);

  if (!pathData || values.length < 2) {
    return (
      <div
        className={cn("flex items-center justify-center text-xs text-gray-400", className)}
        style={{ width, height }}
      >
        --
      </div>
    );
  }

  // Determine stroke color based on trend and current sentiment
  const getStrokeColor = () => {
    if (pathData.trend > 0.1) return '#10b981'; // emerald-500 (improving)
    if (pathData.trend < -0.1) return '#ef4444'; // red-500 (declining)
    if (pathData.lastValue > 0.2) return '#10b981'; // positive sentiment
    if (pathData.lastValue < -0.2) return '#ef4444'; // negative sentiment
    return '#6b7280'; // gray-500 (neutral/stable)
  };

  const strokeColor = getStrokeColor();

  return (
    <svg
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Zero line (neutral sentiment) */}
      <line
        x1={2}
        y1={height / 2}
        x2={width - 2}
        y2={height / 2}
        stroke="#374151"
        strokeWidth={0.5}
        strokeDasharray="2,2"
        opacity={0.5}
      />

      {/* Sparkline path */}
      <path
        d={pathData.path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Optional dots at data points */}
      {showDots && pathData.points.map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r={1.5}
          fill={strokeColor}
        />
      ))}

      {/* End point indicator */}
      <circle
        cx={pathData.points[pathData.points.length - 1].x}
        cy={pathData.points[pathData.points.length - 1].y}
        r={2}
        fill={strokeColor}
      />
    </svg>
  );
}

export default SentimentSparkline;
