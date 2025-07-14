import { useState, useEffect } from 'react';
import { AtSign, Phone, Linkedin } from 'lucide-react';

export type IdentifierType = 'email' | 'phone' | 'linkedin' | 'unknown';

interface IdentifierFieldProps {
  value: string;
  onChange: (value: string, type: IdentifierType) => void;
  required?: boolean;
  placeholder?: string;
  label?: string;
}

export function IdentifierField({
  value,
  onChange,
  required = false,
  placeholder = "Enter email address",
  label = "Email Address"
}: IdentifierFieldProps) {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('unknown');
  const [isTouched, setIsTouched] = useState(false);
  
  // Detect identifier type based on input value
  useEffect(() => {
    if (!value) {
      setIdentifierType('unknown');
      return;
    }
    
    // Improved email validation with strict regex pattern
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (emailRegex.test(value)) {
      setIdentifierType('email');
      return;
    }
    
    // Check if it's a LinkedIn URL
    if (value.includes('linkedin.com/') || value.startsWith('linkedin.com/')) {
      setIdentifierType('linkedin');
      return;
    }
    
    // Check if it's a phone number (simplified check)
    if (/^[\d\+\-\(\)\s]{6,20}$/.test(value)) {
      setIdentifierType('phone');
      return;
    }
    
    setIdentifierType('unknown');
  }, [value]);
  
  // Update parent component when identifier type changes
  useEffect(() => {
    if (value) {
      onChange(value, identifierType);
    }
  }, [identifierType, value, onChange]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setIsTouched(true);
    onChange(newValue, identifierType);
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-400/90">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className={`flex items-center border ${
        isTouched && required && !value 
          ? 'border-red-500/50' 
          : 'border-gray-700/30'
      } rounded-xl 
        bg-gray-800/30 focus-within:ring-2 focus-within:ring-[#37bd7e] 
        focus-within:border-transparent transition-colors hover:bg-gray-800/50`}>
        <span className="pl-3 text-gray-500">
          {identifierType === 'email' && <AtSign className="w-5 h-5 text-blue-400" />}
          {identifierType === 'phone' && <Phone className="w-5 h-5 text-green-400" />}
          {identifierType === 'linkedin' && <Linkedin className="w-5 h-5 text-blue-600" />}
          {identifierType === 'unknown' && <AtSign className="w-5 h-5" />}
        </span>
        <input
          type="text"
          required={required}
          className="w-full bg-transparent border-none px-4 py-2.5 
            text-white/90 focus:outline-none"
          value={value}
          onChange={handleChange}
          onBlur={() => setIsTouched(true)}
          placeholder={placeholder}
          aria-required={required}
        />
      </div>
      {isTouched && required && !value && (
        <p className="text-red-500 text-xs mt-1">
          This field is required
        </p>
      )}
      {value && identifierType === 'unknown' && (
        <p className="text-yellow-500 text-xs mt-1">
          Please enter a valid email, phone number, or LinkedIn URL
        </p>
      )}
    </div>
  );
} 