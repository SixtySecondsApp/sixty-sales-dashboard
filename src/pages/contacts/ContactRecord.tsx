import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ContactProfileSkeleton } from '@/components/ui/contact-skeleton';
import { ContactHeader } from './components/ContactHeader';
import { ContactTabs } from './components/ContactTabs';
import { ContactSidebar } from './components/ContactSidebar';
import { ContactMainContent } from './components/ContactMainContent';
import { ContactRightPanel } from './components/ContactRightPanel';
import { ApiContactService } from '@/lib/services/apiContactService';
import type { Contact } from '@/lib/database/models';
import logger from '@/lib/utils/logger';

const ContactRecord: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [childComponentsReady, setChildComponentsReady] = useState(false);

  useEffect(() => {
    const fetchContact = async () => {
      if (!id) {
        setError('Contact ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        logger.log('Fetching contact with ID:', id);
        const contactData = await ApiContactService.getContactById(id, true);
        
        if (!contactData) {
          setError('Contact not found');
          return;
        }
        
        logger.log('Contact data received:', contactData);
        setContact(contactData);
        
        // Add a small delay to allow child components to initialize
        setTimeout(() => {
          setChildComponentsReady(true);
          setLoading(false);
        }, 300);
      } catch (err) {
        logger.error('Error fetching contact:', err);
        setError(err instanceof Error ? err.message : 'Failed to load contact');
        setLoading(false);
      }
    };

    fetchContact();
  }, [id]);

  // Show skeleton loader until both contact data and child components are ready
  if (loading || !childComponentsReady) {
    return <ContactProfileSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <Alert variant="destructive" className="bg-red-900/20 border-red-700 text-red-300">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300">
              {error}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <button 
              onClick={() => navigate('/crm?tab=contacts')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              ← Back to Contacts
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <Alert className="bg-gray-800/60 border-gray-600 text-gray-300">
            <AlertCircle className="h-4 w-4 text-gray-400" />
            <AlertDescription className="text-gray-300">
              Contact not found. It may have been deleted or moved.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <button 
              onClick={() => navigate('/crm?tab=contacts')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              ← Back to Contacts
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={contact?.id || 'loading'}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen text-gray-100"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Contact Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ContactHeader contact={contact} />
          </motion.div>

          {/* Navigation Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ContactTabs 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
            />
          </motion.div>

          {/* Main Content Grid */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Left Sidebar */}
            <div className="lg:col-span-3">
              <ContactSidebar contact={contact} />
            </div>

            {/* Main Content */}
            <div className="lg:col-span-6">
              <ContactMainContent 
                contact={contact} 
                activeTab={activeTab} 
              />
            </div>

            {/* Right Panel */}
            <div className="lg:col-span-3">
              <ContactRightPanel contact={contact} />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ContactRecord; 