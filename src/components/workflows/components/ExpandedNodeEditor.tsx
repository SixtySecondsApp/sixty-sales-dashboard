import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Node } from 'reactflow';
import { X, Settings } from 'lucide-react';

interface ExpandedNodeEditorProps {
  node: Node | null;
  nodePosition: { x: number; y: number } | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, data: any) => void;
  onNodeClick?: (nodeId: string) => void;
  reactFlowInstance: any;
}

export const ExpandedNodeEditor: React.FC<ExpandedNodeEditorProps> = ({
  node,
  nodePosition,
  onClose,
  onUpdateNode,
  onNodeClick,
  reactFlowInstance
}) => {
  const [activeTab, setActiveTab] = useState<'main' | 'settings'>('main');
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Use a default position if nodePosition is not provided
  const safeNodePosition = nodePosition || { x: 0, y: 0 };

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Handle clicks outside the editor
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't close if clicking inside the editor
      if (editorRef.current && editorRef.current.contains(target)) {
        return;
      }
      
      // Check if clicking on another node
      const nodeElement = target.closest('.react-flow__node');
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id');
        if (nodeId && nodeId !== node?.id && onNodeClick) {
          onNodeClick(nodeId);
          return;
        }
      }
      
      // If clicking on canvas (but not on a node), close editor
      const isReactFlowElement = target.closest('.react-flow');
      if (isReactFlowElement && !nodeElement) {
        onClose();
      }
    };
    
    // Use a small delay to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [node, onClose, onNodeClick]);

  if (!node) {
    return null;
  }

  // Create handleUpdate that uses the current node.id
  const handleUpdate = useCallback((field: string, value: any) => {
    if (node?.id) {
      onUpdateNode(node.id, { [field]: value });
    }
  }, [node?.id, onUpdateNode]);

  // Calculate target position (3/4 of screen, centered)
  const targetWidth = window.innerWidth * 0.75;
  const targetHeight = window.innerHeight * 0.75;
  const targetX = (window.innerWidth - targetWidth) / 2;
  const targetY = (window.innerHeight - targetHeight) / 2;

  // Get React Flow viewport to convert node position to screen coordinates
  const getScreenPosition = useCallback(() => {
    if (!reactFlowInstance || !safeNodePosition) return { x: targetX, y: targetY };
    
    try {
      // Get the React Flow wrapper element to find its position
      const flowWrapper = document.querySelector('.react-flow');
      if (!flowWrapper) return { x: targetX, y: targetY };
      
      const flowRect = flowWrapper.getBoundingClientRect();
      const viewport = reactFlowInstance.getViewport();
      
      // Convert flow coordinates to screen coordinates
      // React Flow uses: screenX = (flowX * zoom) + viewport.x + flowRect.left
      const nodeScreenX = (safeNodePosition.x * viewport.zoom) + viewport.x + flowRect.left;
      const nodeScreenY = (safeNodePosition.y * viewport.zoom) + viewport.y + flowRect.top;
      
      return {
        x: nodeScreenX,
        y: nodeScreenY
      };
    } catch (e) {
      console.error('Error calculating screen position:', e);
      return { x: targetX, y: targetY };
    }
  }, [reactFlowInstance, safeNodePosition, targetX, targetY]);

  // Recalculate position when node position or viewport changes
  const [initialPos, setInitialPos] = useState(() => getScreenPosition());
  
  useEffect(() => {
    if (safeNodePosition && reactFlowInstance) {
      const newPos = getScreenPosition();
      setInitialPos(newPos);
    }
  }, [safeNodePosition, reactFlowInstance, getScreenPosition]);


  return (
    <AnimatePresence>
      <motion.div
        ref={editorRef}
        className="expanded-node-editor fixed z-[100] bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
        initial={{
          x: initialPos.x,
          y: initialPos.y,
          width: 300,
          height: 200,
          opacity: 0.8,
          scale: 0.9
        }}
        animate={{
          x: targetX,
          y: targetY,
          width: targetWidth,
          height: targetHeight,
          opacity: 1,
          scale: 1
        }}
        exit={{
          x: initialPos.x,
          y: initialPos.y,
          width: 300,
          height: 200,
          opacity: 0,
          scale: 0.9
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {node.data.label || node.type}
            </h2>
            <span className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded capitalize">
              {node.type}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'main' ? 'settings' : 'main')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Toggle Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-64px)] overflow-y-auto p-6">
          {activeTab === 'main' ? (
            <div className="space-y-6">
              {/* Basic Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Label
                  </label>
                  <input
                    type="text"
                    value={node.data.label || ''}
                    onChange={(e) => handleUpdate('label', e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter node label..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={node.data.description || ''}
                    onChange={(e) => handleUpdate('description', e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24"
                    placeholder="Enter description..."
                  />
                </div>
              </div>

              {/* Node Type Specific Content */}
              {renderNodeSpecificContent(node, handleUpdate)}
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Advanced Settings
              </h3>
              {renderAdvancedSettings(node, handleUpdate)}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Render node-specific content based on node type
const renderNodeSpecificContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  switch (node.type) {
    case 'condition':
      return renderConditionContent(node, handleUpdate);
    case 'trigger':
      return renderTriggerContent(node, handleUpdate);
    case 'action':
      return renderActionContent(node, handleUpdate);
    case 'imageInput':
      return renderImageInputContent(node, handleUpdate);
    case 'freepikImageGen':
      return renderFreepikImageGenContent(node, handleUpdate);
    case 'freepikUpscale':
      return renderFreepikUpscaleContent(node, handleUpdate);
    case 'freepikVideoGen':
      return renderFreepikVideoGenContent(node, handleUpdate);
    case 'veo3VideoGen':
      return renderVeo3VideoGenContent(node, handleUpdate);
    case 'freepikLipSync':
      return renderFreepikLipSyncContent(node, handleUpdate);
    case 'freepikMusic':
      return renderFreepikMusicContent(node, handleUpdate);
    case 'aiAgent':
      return renderAIAgentContent(node, handleUpdate);
    case 'customGPT':
      return renderCustomGPTContent(node, handleUpdate);
    case 'form':
      return renderFormContent(node, handleUpdate);
    case 'googleEmail':
      return renderGoogleEmailContent(node, handleUpdate);
    case 'googleDocs':
      return renderGoogleDocsContent(node, handleUpdate);
    default:
      return (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          No additional configuration available for this node type.
        </div>
      );
  }
};

// Render condition-specific content
const renderConditionContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Condition Type
        </label>
        <select
          value={node.data.conditionType || 'field'}
          onChange={(e) => {
            handleUpdate('conditionType', e.target.value);
          }}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="field">Field Value</option>
          <option value="stage">Deal Stage</option>
          <option value="value">Deal Value</option>
          <option value="owner">Deal Owner</option>
          <option value="time">Time-Based</option>
          <option value="custom_field">Custom Field</option>
          <option value="time_since_contact">Time Since Contact</option>
          <option value="custom">Custom Logic</option>
        </select>
      </div>

      {node.data.conditionType === 'stage' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Stage Equals
          </label>
          <select
            value={node.data.stageCondition || 'SQL'}
            onChange={(e) => {
              handleUpdate('stageCondition', e.target.value);
              handleUpdate('condition', `stage = ${e.target.value}`);
            }}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="SQL">SQL</option>
            <option value="Opportunity">Opportunity</option>
            <option value="Verbal">Verbal</option>
            <option value="Signed">Signed</option>
          </select>
        </div>
      )}

      {node.data.conditionType === 'value' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Operator
            </label>
            <select
              value={node.data.operator || '>'}
              onChange={(e) => {
                const op = e.target.value;
                const val = node.data.valueAmount || 10000;
                handleUpdate('operator', op);
                handleUpdate('condition', `deal_value ${op} ${val}`);
              }}
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value=">">Greater than</option>
              <option value="<">Less than</option>
              <option value="=">Equals</option>
              <option value=">=">Greater or equal</option>
              <option value="<=">Less or equal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Value
            </label>
            <input
              type="number"
              value={node.data.valueAmount || 10000}
              onChange={(e) => {
                const val = e.target.value;
                const op = node.data.operator || '>';
                handleUpdate('valueAmount', val);
                handleUpdate('condition', `deal_value ${op} ${val}`);
              }}
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter amount..."
            />
          </div>
        </>
      )}

      {node.data.condition && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Condition Expression
          </label>
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono text-gray-900 dark:text-gray-100">
            {node.data.condition}
          </div>
        </div>
      )}
    </div>
  );
};

// Render trigger-specific content
const renderTriggerContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="text-sm text-gray-500 dark:text-gray-400">
      Trigger nodes are configured automatically based on workflow events.
    </div>
  );
};

// Render action-specific content
const renderActionContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="text-sm text-gray-500 dark:text-gray-400">
      Action nodes execute specific tasks in the workflow.
    </div>
  );
};

// Render Freepik Image Gen content
const renderImageInputContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Label
        </label>
        <input
          type="text"
          value={node.data.label || 'Input Image'}
          onChange={(e) => handleUpdate('label', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Input Image"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Image URL
        </label>
        <input
          type="url"
          value={node.data.src || ''}
          onChange={(e) => handleUpdate('src', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://example.com/image.jpg"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Enter an image URL, upload an image, or generate one with Nano Banana Pro
        </p>
      </div>
      
      {/* Nano Banana Pro Generation Options */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Nano Banana Pro</span>
          <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20 rounded">
            AI Generation
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Generation Prompt
            </label>
            <textarea
              value={node.data.generatePrompt || ''}
              onChange={(e) => handleUpdate('generatePrompt', e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
              placeholder="Describe the image you want to generate..."
              rows={3}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enter a prompt to generate an image using Nano Banana Pro (Gemini 3 Pro Image)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Aspect Ratio
            </label>
            <select
              value={node.data.aspectRatio || 'square'}
              onChange={(e) => handleUpdate('aspectRatio', e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="square">Square</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

const renderFreepikImageGenContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Prompt
        </label>
        <textarea
          value={node.data.prompt || ''}
          onChange={(e) => handleUpdate('prompt', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-32 font-mono"
          placeholder="Enter image generation prompt..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Negative Prompt (Optional)
        </label>
        <textarea
          value={node.data.negative_prompt || ''}
          onChange={(e) => handleUpdate('negative_prompt', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24 font-mono"
          placeholder="What to exclude from the image..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Aspect Ratio
        </label>
        <select
          value={node.data.aspect_ratio || 'square'}
          onChange={(e) => handleUpdate('aspect_ratio', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="square">Square</option>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </div>
      {node.data.generated_image && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Generated Image
          </label>
          <img 
            src={node.data.generated_image} 
            alt="Generated" 
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700"
          />
        </div>
      )}
    </div>
  );
};

// Render Freepik Upscale content
const renderFreepikUpscaleContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Scale Factor
        </label>
        <select
          value={node.data.scale_factor || 2}
          onChange={(e) => handleUpdate('scale_factor', parseInt(e.target.value))}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Optimize For
        </label>
        <select
          value={node.data.optimize_for || 'quality'}
          onChange={(e) => handleUpdate('optimize_for', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="quality">Quality</option>
          <option value="speed">Speed</option>
        </select>
      </div>
    </div>
  );
};

// Render Freepik Video Gen content
const renderFreepikVideoGenContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Motion Prompt
        </label>
        <textarea
          value={node.data.prompt || ''}
          onChange={(e) => handleUpdate('prompt', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-32 font-mono"
          placeholder="Describe the movement/animation..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Duration
        </label>
        <select
          value={node.data.duration || '5'}
          onChange={(e) => handleUpdate('duration', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="5">5 seconds</option>
          <option value="10">10 seconds</option>
        </select>
      </div>
    </div>
  );
};

// Render Veo 3 Video Gen content
const renderVeo3VideoGenContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Video Prompt
        </label>
        <textarea
          value={node.data.prompt || ''}
          onChange={(e) => handleUpdate('prompt', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-32 font-mono"
          placeholder="Describe the video you want to generate..."
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Enter a detailed prompt describing the video scene, action, and style
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Model
          </label>
          <select
            value={node.data.model || 'veo-3.0-fast-generate-preview'}
            onChange={(e) => handleUpdate('model', e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="veo-3.0-fast-generate-preview">Fast Generate</option>
            <option value="veo-3.0-generate-preview">Quality Generate</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Duration
          </label>
          <select
            value={node.data.durationSeconds || 8}
            onChange={(e) => handleUpdate('durationSeconds', parseInt(e.target.value))}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={5}>5 seconds</option>
            <option value={8}>8 seconds</option>
            <option value={10}>10 seconds</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Aspect Ratio
          </label>
          <select
            value={node.data.aspectRatio || '16:9'}
            onChange={(e) => handleUpdate('aspectRatio', e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Portrait)</option>
            <option value="1:1">1:1 (Square)</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={node.data.generateAudio !== undefined ? node.data.generateAudio : true}
              onChange={(e) => handleUpdate('generateAudio', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-purple-500 focus:ring-purple-500"
            />
            <span>Generate Audio</span>
          </label>
        </div>
      </div>
    </div>
  );
};

// Render Freepik Lip Sync content
const renderFreepikLipSyncContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Input Video URL (Optional override)
        </label>
        <input
          type="text"
          value={node.data.input_video || ''}
          onChange={(e) => handleUpdate('input_video', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Override video input..."
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Normally provided by connection, but can be overridden here.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Input Audio URL (Optional override)
        </label>
        <input
          type="text"
          value={node.data.input_audio || ''}
          onChange={(e) => handleUpdate('input_audio', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Override audio input..."
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Normally provided by connection, but can be overridden here.
        </p>
      </div>
    </div>
  );
};

// Render Freepik Music content
const renderFreepikMusicContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Music Prompt
        </label>
        <textarea
          value={node.data.prompt || ''}
          onChange={(e) => handleUpdate('prompt', e.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-32 font-mono"
          placeholder="Describe the music you want..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Style
        </label>
        <select
          value={node.data.style || 'cinematic'}
          onChange={(e) => handleUpdate('style', e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {['ambient', 'electronic', 'cinematic', 'corporate', 'energetic', 'calm', 'upbeat', 'dramatic', 'background', 'custom'].map(style => (
            <option key={style} value={style}>{style}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Duration (seconds)
        </label>
        <input
          type="number"
          value={node.data.duration || 30}
          onChange={(e) => handleUpdate('duration', parseInt(e.target.value))}
          min={5}
          max={120}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

// Render AI Agent content
const renderAIAgentContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          System Prompt
        </label>
        <textarea
          value={node.data.config?.systemPrompt || ''}
          onChange={(e) => handleUpdate('config', { ...node.data.config, systemPrompt: e.target.value })}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-32 font-mono"
          placeholder="Define agent behavior..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          User Prompt
        </label>
        <textarea
          value={node.data.config?.userPrompt || ''}
          onChange={(e) => handleUpdate('config', { ...node.data.config, userPrompt: e.target.value })}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-32 font-mono"
          placeholder="Enter task instructions..."
        />
      </div>
    </div>
  );
};

// Render Custom GPT content
const renderCustomGPTContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Message
        </label>
        <textarea
          value={node.data.config?.message || ''}
          onChange={(e) => handleUpdate('config', { ...node.data.config, message: e.target.value })}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-32 font-mono"
          placeholder="Enter message..."
        />
      </div>
    </div>
  );
};

// Render Form content
const renderFormContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Form Description
        </label>
        <textarea
          value={node.data.config?.formDescription || ''}
          onChange={(e) => handleUpdate('config', { ...node.data.config, formDescription: e.target.value })}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24"
          placeholder="Enter form description..."
        />
      </div>
    </div>
  );
};

// Render Google Email content
const renderGoogleEmailContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Subject
        </label>
        <input
          type="text"
          value={node.data.config?.subject || ''}
          onChange={(e) => handleUpdate('config', { ...node.data.config, subject: e.target.value })}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Email subject..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Body
        </label>
        <textarea
          value={node.data.config?.body || ''}
          onChange={(e) => handleUpdate('config', { ...node.data.config, body: e.target.value })}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-48"
          placeholder="Email body..."
        />
      </div>
    </div>
  );
};

// Render Google Docs content
const renderGoogleDocsContent = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Content
        </label>
        <textarea
          value={node.data.config?.content || ''}
          onChange={(e) => handleUpdate('config', { ...node.data.config, content: e.target.value })}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-64 font-mono"
          placeholder="Document content..."
        />
      </div>
    </div>
  );
};

// Render advanced settings
const renderAdvancedSettings = (node: Node, handleUpdate: (field: string, value: any) => void) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Node ID
        </label>
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-400">
          {node.id}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Position
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">X</label>
            <input
              type="number"
              value={node.position.x}
              onChange={(e) => {
                // Position updates would need to be handled differently
                // This is just for display/advanced editing
              }}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm"
              disabled
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Y</label>
            <input
              type="number"
              value={node.position.y}
              onChange={(e) => {
                // Position updates would need to be handled differently
              }}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm"
              disabled
            />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Raw Data (JSON)
        </label>
        <textarea
          value={JSON.stringify(node.data, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              handleUpdate('', parsed);
            } catch (e) {
              // Invalid JSON, ignore
            }
          }}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-64"
        />
      </div>
    </div>
  );
};

