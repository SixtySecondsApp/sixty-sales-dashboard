import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Building2, Globe, Users, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddCompanyModal({ isOpen, onClose, onSuccess }: AddCompanyModalProps) {
  const [formData, setFormData] = useState({
    website: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const industries = [
    'Software Development',
    'Healthcare',
    'Financial Services',
    'Manufacturing',
    'Retail & E-commerce',
    'Education',
    'Telecommunications',
    'Real Estate',
    'Consulting',
    'Media & Entertainment',
    'Transportation',
    'Energy',
    'Other'
  ];

  const companySizes = [
    '1-10 employees',
    '11-50 employees', 
    '51-200 employees',
    '201-500 employees',
    '501-1000 employees',
    '1000+ employees'
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.website.trim()) {
      toast.error('Company website URL is required');
      return;
    }

    // Basic URL validation
    try {
      new URL(formData.website.startsWith('http') ? formData.website : `https://${formData.website}`);
    } catch {
      toast.error('Please enter a valid website URL');
      return;
    }

    setIsLoading(true);
    
    try {
      // Here you would typically call your API to enrich the company data from the URL
      // This would extract company name, domain, industry, etc. from the website
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Company added and enriched successfully');
      onSuccess?.();
      handleClose();
    } catch (error) {
      toast.error('Failed to add and enrich company');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      website: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-gray-900 rounded-xl p-6 w-full max-w-2xl mx-4 border border-gray-800 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Add New Company</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Website URL - Primary Input */}
          <div>
            <Label htmlFor="website" className="text-sm font-medium text-gray-300 mb-2 block">
              Company Website URL *
            </Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://company.com or company.com"
                className="pl-12 bg-gray-800 border-gray-700 text-white text-lg py-3"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              We'll automatically extract company information from the website
            </p>
          </div>

          {/* Enrichment Preview */}
          {formData.website && (
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Company data will be enriched with:</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Company name and description</li>
                <li>• Industry and company size</li>
                <li>• Location and contact information</li>
                <li>• Social media profiles</li>
                <li>• Company logo and branding</li>
              </ul>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {isLoading ? 'Enriching...' : 'Add & Enrich Company'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default AddCompanyModal;