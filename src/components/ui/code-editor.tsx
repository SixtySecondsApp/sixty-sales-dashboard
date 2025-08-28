import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Copy, 
  Check, 
  AlertCircle, 
  Code, 
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'json' | 'javascript' | 'text';
  readOnly?: boolean;
  height?: string;
  placeholder?: string;
  className?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'json',
  readOnly = false,
  height = '200px',
  placeholder,
  className
}) => {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lineNumbers, setLineNumbers] = useState<number[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate line numbers
  useEffect(() => {
    const lines = value.split('\n').length;
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
  }, [value]);

  // Validate JSON if language is json
  useEffect(() => {
    if (language === 'json' && value.trim()) {
      try {
        JSON.parse(value);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    } else {
      setError(null);
    }
  }, [value, language]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!readOnly) {
      onChange(e.target.value);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatJSON = () => {
    if (language === 'json' && !error && value.trim()) {
      try {
        const formatted = JSON.stringify(JSON.parse(value), null, 2);
        onChange(formatted);
      } catch (error) {
        // Ignore formatting errors
      }
    }
  };

  const currentHeight = isExpanded ? '500px' : height;

  return (
    <motion.div 
      className={cn(
        "relative bg-gray-900/50 border border-gray-700/50 rounded-lg overflow-hidden",
        className
      )}
      layout
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-400 uppercase font-medium">{language}</span>
          {error && (
            <div className="flex items-center gap-1 text-red-400">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs">Invalid {language}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {language === 'json' && !readOnly && (
            <Button
              size="sm"
              variant="ghost"
              onClick={formatJSON}
              className="h-6 px-2 text-xs hover:bg-gray-700/50"
              disabled={!!error || !value.trim()}
            >
              Format
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0 hover:bg-gray-700/50"
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={copyToClipboard}
            className="h-6 w-6 p-0 hover:bg-gray-700/50"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="relative flex" style={{ height: currentHeight }}>
        {/* Line Numbers */}
        <div className="flex-shrink-0 bg-gray-800/30 border-r border-gray-700/50 px-2 py-3 select-none">
          {lineNumbers.map((num) => (
            <div 
              key={num} 
              className="text-xs text-gray-500 font-mono leading-5 text-right"
              style={{ minWidth: '20px' }}
            >
              {num}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          value={value}
          onChange={handleChange}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn(
            "flex-1 bg-transparent text-gray-100 font-mono text-sm p-3 resize-none outline-none",
            "placeholder-gray-500 leading-5",
            readOnly && "cursor-not-allowed",
            error && "text-red-300"
          )}
          style={{
            tabSize: 2,
            whiteSpace: 'pre',
            lineHeight: '1.25rem'
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-red-500/10 border-t border-red-500/20 px-3 py-2"
        >
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Syntax Error:</span>
            <span className="text-xs">{error}</span>
          </div>
        </motion.div>
      )}

      {/* Copy Feedback */}
      {copied && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-2 right-12 bg-emerald-600 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-10"
        >
          Copied!
        </motion.div>
      )}
    </motion.div>
  );
};