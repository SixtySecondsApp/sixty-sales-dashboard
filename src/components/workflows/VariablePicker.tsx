import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Code, Database, Workflow, Hash } from 'lucide-react';

export interface Variable {
  name: string;
  type: 'form' | 'workflow' | 'node' | 'custom';
  description: string;
  example?: string;
}

interface VariablePickerProps {
  onInsert: (variable: string) => void;
  showButton?: boolean;
  buttonText?: string;
  formFields?: Array<{ name: string; type: string; label: string }>;
}

const VariablePicker: React.FC<VariablePickerProps> = ({ 
  onInsert, 
  showButton = true, 
  buttonText = "Insert Variable",
  formFields = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate optimal dropdown position
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 320; // w-80 = 20rem = 320px
      const dropdownHeight = 256; // max-h-64 = 16rem = 256px
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      let position: { top?: number; bottom?: number; left?: number; right?: number } = {};
      
      // Calculate vertical position
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      
      if (spaceBelow < dropdownHeight + 8 && spaceAbove > dropdownHeight + 8) {
        // Position above button
        position.bottom = viewportHeight - buttonRect.top + 8;
      } else {
        // Position below button
        position.top = buttonRect.bottom + 8;
      }
      
      // Calculate horizontal alignment
      const spaceRight = viewportWidth - buttonRect.left;
      if (spaceRight < dropdownWidth && buttonRect.right > dropdownWidth) {
        // Align to right edge of button
        position.right = viewportWidth - buttonRect.right;
      } else {
        // Align to left edge of button
        position.left = buttonRect.left;
      }
      
      setDropdownPosition(position);
    }
  }, [isOpen]);

  // Available variables
  const variables: Variable[] = [
    // Form variables (dynamic based on form fields)
    ...formFields.map(field => ({
      name: `formData.fields.${field.name}`,
      type: 'form' as const,
      description: `${field.label || field.name} from form submission`,
      example: field.type === 'email' ? 'user@example.com' : 'Sample value'
    })),
    
    // Common form variables
    {
      name: 'formData.submittedAt',
      type: 'form',
      description: 'When the form was submitted',
      example: '2024-01-15T10:30:00Z'
    },
    {
      name: 'formData.submissionId',
      type: 'form', 
      description: 'Unique form submission ID',
      example: 'sub_123abc456'
    },

    // Workflow variables
    {
      name: 'workflow.executionId',
      type: 'workflow',
      description: 'Current workflow execution ID',
      example: 'exec_789def123'
    },
    {
      name: 'workflow.startTime',
      type: 'workflow',
      description: 'When workflow execution started',
      example: '2024-01-15T10:30:00Z'
    },

    // Node variables
    {
      name: 'previousOutput',
      type: 'node',
      description: 'Output from previous node',
      example: 'Result from previous step'
    },

    // Custom variables
    {
      name: 'custom.lastAIResponse',
      type: 'custom',
      description: 'Last AI agent response',
      example: 'Generated AI response'
    }
  ];

  const getVariableIcon = (type: Variable['type']) => {
    switch (type) {
      case 'form': return <Database className="w-4 h-4 text-blue-400" />;
      case 'workflow': return <Workflow className="w-4 h-4 text-purple-400" />;
      case 'node': return <Code className="w-4 h-4 text-green-400" />;
      case 'custom': return <Hash className="w-4 h-4 text-orange-400" />;
    }
  };

  const handleInsert = (variableName: string) => {
    onInsert(`{{${variableName}}}`);
    setIsOpen(false);
  };

  const groupedVariables = variables.reduce((groups, variable) => {
    if (!groups[variable.type]) {
      groups[variable.type] = [];
    }
    groups[variable.type].push(variable);
    return groups;
  }, {} as Record<string, Variable[]>);

  if (!showButton) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600/20 border border-blue-600/30 rounded-lg text-blue-400 hover:bg-blue-600/30 transition-colors"
      >
        <Code className="w-3 h-3" />
        {buttonText}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div 
            ref={dropdownRef}
            className="fixed w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto"
            style={{
              top: dropdownPosition.top,
              bottom: dropdownPosition.bottom,
              left: dropdownPosition.left,
              right: dropdownPosition.right,
            }}
          >
            <div className="p-3">
              <h4 className="text-sm font-medium text-white mb-3">Available Variables</h4>
              
              {Object.entries(groupedVariables).map(([type, vars]) => (
                <div key={type} className="mb-4 last:mb-0">
                  <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                    {type} Variables
                  </h5>
                  <div className="space-y-1">
                    {vars.map((variable, index) => (
                      <button
                        key={index}
                        onClick={() => handleInsert(variable.name)}
                        className="w-full text-left p-2 rounded-lg hover:bg-gray-700/50 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          {getVariableIcon(variable.type)}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white font-mono">
                              {`{{${variable.name}}}`}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {variable.description}
                            </div>
                            {variable.example && (
                              <div className="text-xs text-gray-500 mt-1 italic">
                                Example: {variable.example}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default VariablePicker;