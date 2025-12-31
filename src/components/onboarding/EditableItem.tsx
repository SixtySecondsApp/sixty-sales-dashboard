/**
 * EditableItem Component
 *
 * Inline editable text item with icon, edit, and delete functionality.
 * Used in skill configuration for criteria, disqualifiers, questions, etc.
 */

import { useState, useCallback, KeyboardEvent, useRef, useEffect } from 'react';
import { Check, Pencil, Trash2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableItemProps {
  value: string;
  onSave: (newValue: string) => void;
  onDelete: () => void;
  icon: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function EditableItem({
  value,
  onSave,
  onDelete,
  icon: Icon,
  iconColor = 'text-gray-400',
  className,
}: EditableItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    if (editValue.trim() && editValue !== value) {
      onSave(editValue.trim());
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  }, [editValue, value, onSave]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  }, [handleSave, value]);

  if (isEditing) {
    return (
      <div className={cn(
        'flex items-center gap-2 p-2 rounded-lg bg-gray-800',
        className
      )}>
        <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', iconColor)} />
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="flex-1 text-sm bg-transparent outline-none text-white"
        />
        <button
          onClick={handleSave}
          className="text-green-500 hover:text-green-400 transition-colors"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      'group flex items-center gap-2 p-2 rounded-lg transition-colors bg-gray-800 hover:bg-gray-750',
      className
    )}>
      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', iconColor)} />
      <span className="flex-1 text-sm text-gray-300">{value}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
