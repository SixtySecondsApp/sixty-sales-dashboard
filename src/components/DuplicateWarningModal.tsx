import React from 'react';
import { X, AlertTriangle, HelpCircle, CheckCircle, XCircle, Users, Mail, Phone } from 'lucide-react';

interface DuplicateMatch {
  id: string;
  field: string;
  value: string;
  existingRecord: any;
  similarity?: number;
}

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  onUpdate: (existingId: string) => void;
  duplicates: DuplicateMatch[];
  entityType: 'contact' | 'company' | 'deal';
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  onUpdate,
  duplicates,
  entityType
}) => {
  const [selectedDuplicate, setSelectedDuplicate] = React.useState<string | null>(null);
  const [showWhyInfo, setShowWhyInfo] = React.useState(false);

  if (!isOpen || !duplicates.length) return null;

  const getFieldIcon = (field: string) => {
    switch (field.toLowerCase()) {
      case 'email':
      case 'contact_email':
        return <Mail className="w-4 h-4" />;
      case 'phone':
      case 'contact_phone':
        return <Phone className="w-4 h-4" />;
      case 'company':
      case 'client_name':
      case 'name':
        return <Users className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getFieldLabel = (field: string) => {
    switch (field.toLowerCase()) {
      case 'contact_email':
        return 'Email';
      case 'contact_phone':
        return 'Phone';
      case 'client_name':
        return 'Company';
      default:
        return field.charAt(0).toUpperCase() + field.slice(1);
    }
  };

  const getSimilarityColor = (similarity?: number) => {
    if (!similarity) return 'text-gray-400';
    if (similarity >= 0.9) return 'text-red-400';
    if (similarity >= 0.7) return 'text-orange-400';
    return 'text-yellow-400';
  };

  const getSimilarityText = (similarity?: number) => {
    if (!similarity) return '';
    const percentage = Math.round(similarity * 100);
    return `${percentage}% match`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gray-900 rounded-lg shadow-xl border border-gray-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Potential Duplicate {entityType === 'contact' ? 'Contact' : entityType === 'company' ? 'Company' : 'Deal'} Detected
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  We found {duplicates.length} existing {duplicates.length === 1 ? 'record' : 'records'} that might be the same
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Why am I seeing this? */}
        <div className="p-6 border-b border-gray-800">
          <button
            onClick={() => setShowWhyInfo(!showWhyInfo)}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Why am I seeing this warning?
          </button>
          
          {showWhyInfo && (
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="text-sm font-medium text-white mb-2">We check for duplicates to help you:</h4>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">
                    <strong>Maintain clean data:</strong> Prevent multiple records for the same entity
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">
                    <strong>Save time:</strong> Update existing records instead of creating duplicates
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-300">
                    <strong>Track history:</strong> Keep all interactions with a {entityType} in one place
                  </span>
                </li>
              </ul>
              
              <div className="mt-3 pt-3 border-t border-blue-500/20">
                <p className="text-sm text-gray-400">
                  We detected matches based on: {duplicates.map(d => getFieldLabel(d.field)).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Duplicate Records */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Existing Records Found:</h3>
          <div className="space-y-3">
            {duplicates.map((duplicate) => {
              const record = duplicate.existingRecord;
              return (
                <button
                  key={duplicate.id}
                  onClick={() => setSelectedDuplicate(duplicate.id)}
                  className={`w-full p-4 rounded-lg border transition-all text-left ${
                    selectedDuplicate === duplicate.id
                      ? 'bg-purple-500/10 border-purple-500 shadow-lg shadow-purple-500/20'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedDuplicate === duplicate.id
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-600'
                        }`}>
                          {selectedDuplicate === duplicate.id && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <span className="font-medium text-white">
                          {record.name || record.company || record.email || 'Unnamed Record'}
                        </span>
                        {duplicate.similarity && (
                          <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-800 ${getSimilarityColor(duplicate.similarity)}`}>
                            {getSimilarityText(duplicate.similarity)}
                          </span>
                        )}
                      </div>
                      
                      <div className="ml-7 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          {getFieldIcon(duplicate.field)}
                          <span className="text-gray-400">
                            <strong className="text-orange-400">Matching {getFieldLabel(duplicate.field)}:</strong> {duplicate.value}
                          </span>
                        </div>
                        
                        {record.email && duplicate.field !== 'email' && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-500">{record.email}</span>
                          </div>
                        )}
                        
                        {record.phone && duplicate.field !== 'phone' && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-500">{record.phone}</span>
                          </div>
                        )}
                        
                        {record.created_at && (
                          <div className="text-xs text-gray-500 mt-2">
                            Created: {new Date(record.created_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Action Options */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-3">What would you like to do?</h4>
            <div className="space-y-2 text-sm">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="action"
                  checked={selectedDuplicate !== null}
                  onChange={() => {}}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-white group-hover:text-purple-400 transition-colors">
                    Update existing record
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedDuplicate
                      ? `Update the selected record instead of creating a new one`
                      : `Select a record above to update it`}
                  </p>
                </div>
              </label>
              
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="action"
                  checked={selectedDuplicate === null}
                  onChange={() => setSelectedDuplicate(null)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-white group-hover:text-blue-400 transition-colors">
                    Create new record anyway
                  </p>
                  <p className="text-xs text-gray-500">
                    This is a different {entityType}, create a separate record
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          {selectedDuplicate ? (
            <button
              onClick={() => onUpdate(selectedDuplicate)}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Update Existing Record
            </button>
          ) : (
            <button
              onClick={onProceed}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Create New Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
};