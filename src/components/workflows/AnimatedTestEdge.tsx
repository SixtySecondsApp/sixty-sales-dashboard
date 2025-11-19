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
  
  // Style adaptation for "Modern Dark" theme
  // Default: Zinc-600 (#52525b) - matches node borders
  // Active: Yellow (#facc15)
  const strokeColor = isActive ? '#facc15' : '#52525b';

  return (
    <>
      {/* Background path */}
      <path
        id={id}
        style={style}
        className={`react-flow__edge-path transition-colors duration-300`}
        d={edgePath}
        markerEnd={markerEnd}
        strokeWidth={isActive ? 3 : 2}
        stroke={strokeColor}
        fill="none"
        strokeOpacity={isActive ? 1 : 0.8}
      />
      
      {/* Animated flow indicator when test is running */}
      {isFlowing && (
        <>
          <circle r="3" fill="#facc15">
            <animateMotion dur="1.5s" repeatCount="indefinite">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          
          <circle r="3" fill="#facc15">
            <animateMotion dur="1.5s" repeatCount="indefinite" begin="0.5s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          
          <circle r="3" fill="#facc15">
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
            stroke: '#facc15',
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
