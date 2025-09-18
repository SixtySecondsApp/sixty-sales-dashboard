import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, User, Mail, Phone, Building2, Briefcase, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useContacts } from '@/lib/hooks/useContacts';
import { useUser } from '@/lib/hooks/useUser';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddContactModal({ isOpen, onClose, onSuccess }: AddContactModalProps) {
  const { userData } = useUser();
  const { createContact } = useContacts();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    title: '',
    email: '',
    website: '',
    phone: '',
    companyName: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const jobTitles = [
    'CEO',
    'CTO', 
    'CFO',
    'COO',
    'VP Sales',
    'VP Marketing',
    'VP Engineering',
    'VP Operations',
    'Sales Director',
    'Marketing Director',
    'Engineering Director',
    'Sales Manager',
    'Marketing Manager',
    'Account Manager',
    'Business Development Manager',
    'Product Manager',
    'Project Manager',
    'Senior Developer',
    'Developer',
    'Analyst',
    'Consultant',
    'Other'
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Auto-extract website from email when email is entered
    if (field === 'email' && value && !formData.website) {
      const emailDomain = value.split('@')[1];
      if (emailDomain && !['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'protonmail.com'].includes(emailDomain.toLowerCase())) {
        setFormData(prev => ({
          ...prev,
          website: `https://${emailDomain}`
        }));
        
        // Also suggest company name from domain if not set
        if (!formData.companyName) {
          const domainParts = emailDomain.split('.');
          const suggestedName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
          setFormData(prev => ({
            ...prev,
            companyName: suggestedName
          }));
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName.trim()) {
      toast.error('First name is required');
      return;
    }

    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    try {
      // Create the contact using the API service
      const contactData = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim() || undefined,
        title: formData.title || undefined,
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        company_name: formData.companyName.trim() || undefined,
        company_website: formData.website.trim() || undefined,
        owner_id: userData?.id || ''
      };
      
      const newContact = await createContact(contactData);
      
      if (newContact) {
        toast.success('Contact added successfully');
        onSuccess?.();
        handleClose();
      } else {
        throw new Error('Failed to create contact');
      }
    } catch (error) {
      toast.error('Failed to add contact');
      console.error('Error adding contact:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      firstName: '',
      lastName: '',
      title: '',
      email: '',
      website: '',
      phone: '',
      companyName: ''
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
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Add New Contact</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <Label htmlFor="firstName" className="text-sm font-medium text-gray-300">
                First Name *
              </Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Enter first name"
                className="mt-1 bg-gray-800 border-gray-700 text-white"
                required
              />
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="lastName" className="text-sm font-medium text-gray-300">
                Last Name
              </Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Enter last name"
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          {/* Job Title */}
          <div>
            <Label className="text-sm font-medium text-gray-300">Job Title</Label>
            <Select value={formData.title} onValueChange={(value) => handleInputChange('title', value)}>
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Select job title" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {jobTitles.map(title => (
                  <SelectItem key={title} value={title} className="text-gray-300">
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-300">
                Email *
              </Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="contact@company.com"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <Label htmlFor="website" className="text-sm font-medium text-gray-300">
                Website
              </Label>
              <div className="relative mt-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="https://website.com"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  title="Auto-filled from email domain"
                />
              </div>
            </div>
          </div>

          {/* Company Name */}
          <div>
            <Label htmlFor="companyName" className="text-sm font-medium text-gray-300">
              Company Name
            </Label>
            <div className="relative mt-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                placeholder="Company Name"
                className="pl-10 bg-gray-800 border-gray-700 text-white"
                title="Auto-suggested from email domain"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <Label htmlFor="phone" className="text-sm font-medium text-gray-300">
              Phone Number
            </Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

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
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isLoading ? 'Adding...' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default AddContactModal;