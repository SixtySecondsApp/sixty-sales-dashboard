import React from 'react';
import { X, FileText, AlertCircle } from 'lucide-react';

interface ProposalConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sentProposal: boolean, notes?: string) => void;
  dealName: string;
  clientName?: string;
}

export const ProposalConfirmationModal: React.FC<ProposalConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  dealName,
  clientName
}) => {
  const [sentProposal, setSentProposal] = React.useState<boolean | null>(null);
  const [notes, setNotes] = React.useState('');
  const [showNotes, setShowNotes] = React.useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (sentProposal !== null) {
      onConfirm(sentProposal, sentProposal ? notes : undefined);
      // Reset state
      setSentProposal(null);
      setNotes('');
      setShowNotes(false);
    }
  };

  const handleCancel = () => {
    setSentProposal(null);
    setNotes('');
    setShowNotes(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/40 dark:bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative w-full h-full sm:h-auto sm:max-w-md bg-white dark:bg-gray-900/95 backdrop-blur-sm rounded-none sm:rounded-lg shadow-xl border-0 sm:border border-gray-200 dark:border-gray-700/50 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-200 dark:border-purple-500/20 flex-shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">Moving to Opportunity Stage</h2>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-0.5 truncate">
                {dealName} {clientName && `• ${clientName}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors flex-shrink-0 min-h-[40px] min-w-[40px]"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <p className="text-sm sm:text-base text-gray-900 dark:text-gray-100 font-medium mb-2">Have you sent a proposal to this client?</p>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                The Opportunity stage now represents deals where a formal proposal has been submitted.
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2 sm:space-y-3">
              <button
                onClick={() => {
                  setSentProposal(true);
                  setShowNotes(true);
                }}
                className={`w-full p-3 sm:p-4 min-h-[64px] rounded-lg border transition-all text-left group active:scale-[0.99] ${
                  sentProposal === true
                    ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-500 dark:border-purple-500/20 shadow-lg shadow-purple-500/20'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 hover:border-gray-400 dark:hover:border-gray-600/50 hover:bg-gray-100 dark:hover:bg-gray-800/70'
                }`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    sentProposal === true
                      ? 'border-purple-600 dark:border-purple-500 bg-purple-600 dark:bg-purple-500'
                      : 'border-gray-400 dark:border-gray-600 group-hover:border-gray-500 dark:group-hover:border-gray-500'
                  }`}>
                    {sentProposal === true && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-900 dark:text-gray-100 font-medium">Yes, proposal sent</p>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-1">
                      I've submitted a formal proposal to the client
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setSentProposal(false);
                  setShowNotes(false);
                }}
                className={`w-full p-3 sm:p-4 min-h-[64px] rounded-lg border transition-all text-left group active:scale-[0.99] ${
                  sentProposal === false
                    ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 dark:border-blue-500/20 shadow-lg shadow-blue-500/20'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700/50 hover:border-gray-400 dark:hover:border-gray-600/50 hover:bg-gray-100 dark:hover:bg-gray-800/70'
                }`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    sentProposal === false
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-600 dark:bg-blue-500'
                      : 'border-gray-400 dark:border-gray-600 group-hover:border-gray-500 dark:group-hover:border-gray-500'
                  }`}>
                    {sentProposal === false && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-900 dark:text-gray-100 font-medium">No, preparing proposal</p>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-1">
                      I'm still working on the proposal
                    </p>
                  </div>
                </div>
              </button>
            </div>

          {/* Notes field for proposal sent */}
          {showNotes && sentProposal === true && (
            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/20 rounded-lg">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Proposal Details (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Sent pricing proposal via email, includes 3 package options..."
                className="w-full px-3 py-2 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
          )}

          {/* Info box */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg flex gap-3">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-900 dark:text-gray-100">
              <p className="font-medium mb-1">Smart Task Creation</p>
              <p className="text-gray-700 dark:text-gray-300">
                {sentProposal === true
                  ? "We'll create a follow-up task for 3 days from now to check on the proposal status."
                  : "The deal will move to Opportunity stage for proposal preparation."}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0 sticky bottom-0 bg-white dark:bg-gray-900/95 backdrop-blur-sm">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 min-h-[44px] h-11 sm:h-12 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700/50 rounded-lg transition-colors active:scale-[0.98] text-sm sm:text-base font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={sentProposal === null}
            className="flex-1 px-4 min-h-[44px] h-11 sm:h-12 bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium active:scale-[0.98] text-sm sm:text-base"
          >
            Confirm & Move
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};