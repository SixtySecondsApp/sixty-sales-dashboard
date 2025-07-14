import React, { useState } from 'react';
import { Edit, MessageCircle, Phone, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import ContactEditModal from '@/components/ContactEditModal';
import type { Contact } from '@/lib/database/models';

interface ContactHeaderProps {
  contact: Contact;
}

export function ContactHeader({ contact }: ContactHeaderProps) {
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);

  const getInitials = (contact: Contact) => {
    const firstName = contact.first_name || '';
    const lastName = contact.last_name || '';
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?';
  };

  const getFullName = (contact: Contact) => {
    if (contact.first_name && contact.last_name) {
      return `${contact.first_name} ${contact.last_name}`;
    }
    if (contact.full_name) {
      return contact.full_name;
    }
    return contact.email || 'Unknown Contact';
  };

  return (
    <div className="mb-8">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb-nav">
        <button 
          onClick={() => navigate('/crm/contacts')}
          className="breadcrumb-item flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Contacts
        </button>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{getFullName(contact)}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full border-3 border-blue-400 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
            {getInitials(contact)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{getFullName(contact)}</h1>
            <div className="flex items-center gap-3 text-gray-400 mb-2">
              {contact.title && (
                <>
                  <span className="text-lg">{contact.title}</span>
                  <span className="text-gray-600">•</span>
                </>
              )}
              {contact.company && (
                <span className="text-lg">{contact.company.name}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Active
              </Badge>
              {contact.is_primary && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  Primary Contact
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="btn-group">
          <button 
            className="btn-primary"
            onClick={() => setShowEditModal(true)}
          >
            <Edit className="w-4 h-4" />
            <span>Edit Contact</span>
          </button>
          <button className="btn-secondary">
            <MessageCircle className="w-4 h-4" />
            <span>Message</span>
          </button>
          <button className="btn-secondary">
            <Phone className="w-4 h-4" />
            <span>Call</span>
          </button>
        </div>
      </div>
      
      {/* Edit Contact Modal */}
      <ContactEditModal
        open={showEditModal}
        setOpen={setShowEditModal}
        contact={contact}
      />
    </div>
  );
} 