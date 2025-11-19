import React from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { useTheme } from '@/hooks/useTheme';

interface AnimatedTestEdgeProps extends EdgeProps {
  data?: {
    isTestActive?: boolean;
    isFlowing?: boolean;
  };
}

const AnimatedTestEdge: React.FC<AnimatedTestEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) => {
  const { resolvedTheme } = useTheme();
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isActive = data?.isTestActive || false;
  const isFlowing = data?.isFlowing || false;
  
  // Theme-aware colors
  const strokeColor = isActive 
    ? (resolvedTheme === 'dark' ? '#facc15' : '#eab308') // yellow-400 dark, yellow-500 light
    : (resolvedTheme === 'dark' ? '#52525b' : '#9ca3af'); // zinc-600 dark, gray-400 light
  
  const fillColor = resolvedTheme === 'dark' ? '#facc15' : '#eab308'; // yellow-400 dark, yellow-500 light

  return (
    <>
      {/* Background path */}
      <path
        id={id}
        style={{
          ...style,
          stroke: strokeColor,
        }}
        className="react-flow__edge-path transition-colors duration-300"
        d={edgePath}
        markerEnd={markerEnd}
        strokeWidth={isActive ? 3 : 2}
        fill="none"
        strokeOpacity={isActive ? 1 : 0.8}
      />
      
      {/* Animated flow indicator when test is running */}
      {isFlowing && (
        <>
          <circle r="3" fill={fillColor}>
            <animateMotion dur="1.5s" repeatCount="indefinite">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          
          <circle r="3" fill={fillColor}>
            <animateMotion dur="1.5s" repeatCount="indefinite" begin="0.5s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          
          <circle r="3" fill={fillColor}>
            <animateMotion dur="1.5s" repeatCount="indefinite" begin="1s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
        </>
      )}
      
      {/* Pulse animation for active edges */}
      {isActive && !isFlowing && (
        <path
          style={{
            ...style,
            strokeWidth: 4,
            stroke: strokeColor,
            strokeOpacity: 0.3,
          }}
          className="animate-pulse"
          d={edgePath}
          fill="none"
        />
      )}
    </>
  );
};

export default AnimatedTestEdge;
