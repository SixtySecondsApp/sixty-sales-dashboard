import React from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';

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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isActive = data?.isTestActive || false;
  const isFlowing = data?.isFlowing || false;

  return (
    <>
      {/* Background path for visibility */}
      <path
        id={id}
        style={style}
        className={`react-flow__edge-path ${isActive ? 'stroke-yellow-400' : ''}`}
        d={edgePath}
        markerEnd={markerEnd}
        strokeWidth={isActive ? 3 : 2}
        stroke={isActive ? '#facc15' : '#37bd7e'}
        fill="none"
        strokeOpacity={isActive ? 1 : 0.6}
      />
      
      {/* Animated flow indicator when test is running */}
      {isFlowing && (
        <>
          {/* Gradient definition for the flow effect */}
          <defs>
            <linearGradient id={`flow-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#facc15" stopOpacity="0.8" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          
          {/* Animated dots flowing along the path */}
          <circle r="4" fill="#facc15">
            <animateMotion dur="2s" repeatCount="indefinite">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          
          <circle r="4" fill="#facc15">
            <animateMotion dur="2s" repeatCount="indefinite" begin="0.5s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          
          <circle r="4" fill="#facc15">
            <animateMotion dur="2s" repeatCount="indefinite" begin="1s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          
          <circle r="4" fill="#facc15">
            <animateMotion dur="2s" repeatCount="indefinite" begin="1.5s">
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
            strokeWidth: 3,
            stroke: '#facc15',
            strokeOpacity: 0.5,
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