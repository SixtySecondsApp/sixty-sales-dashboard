import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Mail, 
  Calendar, 
  HardDrive, 
  Settings, 
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { googleOAuthService } from '../../lib/services/googleOAuthService';
import { GoogleIntegrationModal } from '../workflows/GoogleIntegrationModal';
import { toast } from 'sonner';

interface GoogleTemplate {
  id: string;
  name: string;
  description: string;
  template_type: string;
  template_content: any;
  is_global: boolean;
  created_at: string;
}

export const GoogleWorkspaceSettings: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [hasIntegration, setHasIntegration] = useState(false);
  const [integrationDetails, setIntegrationDetails] = useState<any>(null);
  const [templates, setTemplates] = useState<GoogleTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState<Partial<GoogleTemplate> | null>(null);

  useEffect(() => {
    loadUserAndIntegration();
    loadTemplates();
  }, []);

  const loadUserAndIntegration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const hasValid = await googleOAuthService.hasValidIntegration(user.id);
        setHasIntegration(hasValid);
        
        if (hasValid) {
          const integration = await googleOAuthService.getTokens(user.id);
          setIntegrationDetails(integration);
        }
      }
    } catch (error) {
      console.error('Error loading integration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('google_docs_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    }
  };

  const handleCreateTemplate = () => {
    setNewTemplate({
      name: '',
      description: '',
      template_type: 'proposal',
      template_content: {
        sections: []
      },
      is_global: false
    });
  };

  const handleSaveTemplate = async (template: Partial<GoogleTemplate>) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('google_docs_templates')
        .insert({
          user_id: template.is_global ? null : user.id,
          name: template.name,
          description: template.description,
          template_type: template.template_type,
          template_content: template.template_content,
          is_global: template.is_global
        });

      if (error) throw error;
      
      toast.success('Template created successfully');
      setNewTemplate(null);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('google_docs_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      
      toast.success('Template deleted');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Integration Status */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Google Workspace Integration
          </h3>
          {!hasIntegration && (
            <button
              onClick={() => setShowIntegrationModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Connect Google Workspace
            </button>
          )}
        </div>

        {hasIntegration ? (
          <div className="space-y-4">
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-green-400 font-medium">Connected</p>
                    <p className="text-gray-400 text-sm">
                      {integrationDetails?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIntegrationModal(true)}
                  className="text-gray-400 hover:text-white"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <ServiceCard
                icon={<FileText className="w-6 h-6" />}
                name="Google Docs"
                status="active"
              />
              <ServiceCard
                icon={<HardDrive className="w-6 h-6" />}
                name="Google Drive"
                status="active"
              />
              <ServiceCard
                icon={<Mail className="w-6 h-6" />}
                name="Gmail"
                status="active"
              />
              <ServiceCard
                icon={<Calendar className="w-6 h-6" />}
                name="Google Calendar"
                status="active"
              />
            </div>
          </div>
        ) : (
          <div className="bg-gray-700/50 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">
              Connect your Google Workspace to enable document creation, email automation, and calendar management
            </p>
            <button
              onClick={() => setShowIntegrationModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Connect Now
            </button>
          </div>
        )}
      </div>

      {/* Document Templates */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Document Templates</h3>
          <button
            onClick={handleCreateTemplate}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

        {newTemplate && (
          <TemplateEditor
            template={newTemplate}
            onSave={handleSaveTemplate}
            onCancel={() => setNewTemplate(null)}
          />
        )}

        <div className="space-y-3">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-white font-medium">{template.name}</p>
                <p className="text-gray-400 text-sm">{template.description}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-gray-500">
                    Type: {template.template_type}
                  </span>
                  {template.is_global && (
                    <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                      Global
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingTemplate(template.id)}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="p-2 text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No templates created yet
            </div>
          )}
        </div>
      </div>

      {/* Integration Modal */}
      {showIntegrationModal && user && (
        <GoogleIntegrationModal
          isOpen={showIntegrationModal}
          onClose={() => {
            setShowIntegrationModal(false);
            loadUserAndIntegration();
          }}
          userId={user.id}
          onIntegrationComplete={() => {
            loadUserAndIntegration();
          }}
        />
      )}
    </div>
  );
};

const ServiceCard: React.FC<{
  icon: React.ReactNode;
  name: string;
  status: 'active' | 'inactive';
}> = ({ icon, name, status }) => (
  <div className="bg-gray-700/50 rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      {icon}
      <div className={`w-2 h-2 rounded-full ${
        status === 'active' ? 'bg-green-500' : 'bg-gray-500'
      }`} />
    </div>
    <p className="text-white text-sm font-medium">{name}</p>
    <p className="text-gray-500 text-xs">
      {status === 'active' ? 'Connected' : 'Not connected'}
    </p>
  </div>
);

const TemplateEditor: React.FC<{
  template: Partial<GoogleTemplate>;
  onSave: (template: Partial<GoogleTemplate>) => void;
  onCancel: () => void;
}> = ({ template, onSave, onCancel }) => {
  const [editedTemplate, setEditedTemplate] = useState(template);

  return (
    <div className="bg-gray-700 rounded-lg p-4 mb-4">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Template Name
          </label>
          <input
            type="text"
            value={editedTemplate.name || ''}
            onChange={(e) => setEditedTemplate({ ...editedTemplate, name: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="e.g., Sales Proposal Template"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Description
          </label>
          <input
            type="text"
            value={editedTemplate.description || ''}
            onChange={(e) => setEditedTemplate({ ...editedTemplate, description: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="Brief description of the template"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Template Type
          </label>
          <select
            value={editedTemplate.template_type || 'proposal'}
            onChange={(e) => setEditedTemplate({ ...editedTemplate, template_type: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="proposal">Proposal</option>
            <option value="report">Report</option>
            <option value="invoice">Invoice</option>
            <option value="meeting_notes">Meeting Notes</option>
            <option value="contract">Contract</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_global"
            checked={editedTemplate.is_global || false}
            onChange={(e) => setEditedTemplate({ ...editedTemplate, is_global: e.target.checked })}
            className="rounded border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="is_global" className="text-sm text-gray-300">
            Make this template available to all users
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(editedTemplate)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
};