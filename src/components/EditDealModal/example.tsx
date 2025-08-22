import React, { useState } from 'react';
import { Button } from '../ui/button';
import EditDealModal from './EditDealModal';
import logger from '@/lib/utils/logger';

// Example deal data
const exampleDeal = {
  id: 'd-123',
  dealName: 'Acme Corp - Growth Plan',
  company: 'Acme Corp',
  contactName: 'John Smith',
  closeDate: '2025-06-30',
  dealValue: 25000,
  stage: 'proposal',
  probability: 60,
  priority: 'high',
  dealSize: 'medium',
  leadSource: {
    type: 'outbound', 
    channel: 'linkedin'
  },
  nextAction: 'proposal',
  description: 'Acme Corp is looking to implement our Growth Plan to scale their marketing efforts.',
};

export const EditDealModalExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [deal, setDeal] = useState(exampleDeal);
  
  const handleSave = async (formData: any) => {
    // Update the deal in state (in a real app, this would save to API/database)
    setDeal({
      ...deal,
      ...formData
    });
    
    logger.log('Deal saved:', formData);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Close the modal
    setIsOpen(false);
  };
  
  const handleDelete = async (dealId: string) => {
    logger.log('Deal deleted:', dealId);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Close the modal
    setIsOpen(false);
  };
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Deal Modal Example</h1>
      
      <Button onClick={() => setIsOpen(true)}>
        Open Edit Deal Modal
      </Button>
      
      <EditDealModal 
        open={isOpen}
        setOpen={setIsOpen}
        deal={deal}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}; 