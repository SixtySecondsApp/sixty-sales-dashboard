/**
 * Intervention Modal Component
 *
 * Multi-step workflow for deploying "permission to close" interventions.
 * Steps: Detection Alert → AI Recommendation → Send & Track → Response Handling
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Sparkles,
  Send,
  Copy,
  Check,
  Eye,
  Clock,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { HealthScoreBadge } from './HealthScoreBadge';
import type { RelationshipHealthScore } from '@/lib/services/relationshipHealthService';
import type { GhostRiskAssessment } from '@/lib/services/ghostDetectionService';
import type { InterventionTemplate, PersonalizedTemplate } from '@/lib/services/interventionTemplateService';

interface InterventionModalProps {
  isOpen: boolean;
  onClose: () => void;
  relationshipHealth: RelationshipHealthScore;
  ghostRisk: GhostRiskAssessment;
  contactName: string;
  companyName?: string;
  recommendedTemplate?: InterventionTemplate;
  personalizedTemplate?: PersonalizedTemplate;
  alternativeTemplates?: InterventionTemplate[];
  onSelectTemplate: (templateId: string) => void;
  onSendIntervention: (channel: 'email' | 'linkedin') => void;
}

type Step = 'detection' | 'recommendation' | 'send' | 'response';

export function InterventionModal({
  isOpen,
  onClose,
  relationshipHealth,
  ghostRisk,
  contactName,
  companyName,
  recommendedTemplate,
  personalizedTemplate,
  alternativeTemplates = [],
  onSelectTemplate,
  onSendIntervention,
}: InterventionModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('detection');
  const [copied, setCopied] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'linkedin'>('email');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('detection');
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Copy template to clipboard
  const handleCopy = async () => {
    if (!personalizedTemplate) return;

    const fullEmail = `Subject: ${personalizedTemplate.subject}\n\n${personalizedTemplate.body}`;

    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopied(true);
      toast.success('Template copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy template');
    }
  };

  // Handle send
  const handleSend = () => {
    onSendIntervention(selectedChannel);
    setCurrentStep('send');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Intervention Workflow
            </h2>
            <p className="text-sm text-gray-600">
              {contactName} {companyName && `• ${companyName}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          {[
            { key: 'detection', label: 'Detection' },
            { key: 'recommendation', label: 'Template' },
            { key: 'send', label: 'Send' },
            { key: 'response', label: 'Track' },
          ].map((step, index) => (
            <div
              key={step.key}
              className="flex flex-1 items-center"
            >
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    currentStep === step.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                <span className={`mt-1 text-xs ${
                  currentStep === step.key ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
              </div>
              {index < 3 && (
                <div className={`h-0.5 flex-1 ${
                  index < (['detection', 'recommendation', 'send', 'response'].indexOf(currentStep))
                    ? 'bg-blue-600'
                    : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Detection Alert */}
          {currentStep === 'detection' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-900 mb-1">
                      Ghost Risk Detected
                    </h3>
                    <p className="text-sm text-red-700">
                      This relationship shows multiple warning signs of ghosting
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Name:</span>
                    <span className="text-sm font-medium">{contactName}</span>
                  </div>
                  {companyName && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Company:</span>
                      <span className="text-sm font-medium">{companyName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Health Score:</span>
                    <HealthScoreBadge
                      score={relationshipHealth.overall_health_score}
                      status={relationshipHealth.health_status}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Ghost Probability:</span>
                    <span className="text-sm font-semibold text-red-600">
                      {ghostRisk.ghostProbabilityPercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Signs */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Warning Signs</h4>
                <div className="space-y-2">
                  {ghostRisk.signals.map((signal, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className={`rounded-full p-1 mt-0.5 ${
                        signal.severity === 'critical' ? 'bg-red-100' :
                        signal.severity === 'high' ? 'bg-orange-100' :
                        'bg-yellow-100'
                      }`}>
                        <AlertTriangle className={`h-3 w-3 ${
                          signal.severity === 'critical' ? 'text-red-600' :
                          signal.severity === 'high' ? 'text-orange-600' :
                          'text-yellow-600'
                        }`} />
                      </div>
                      <p className="text-sm text-gray-700">{signal.signal_context}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Interaction */}
              {relationshipHealth.last_meaningful_interaction && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Last Meaningful Interaction</h4>
                  <div className="text-sm text-gray-700">
                    <p>{JSON.stringify(relationshipHealth.last_meaningful_interaction)}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setCurrentStep('recommendation')}
                className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Continue to Template Selection
              </button>
            </div>
          )}

          {/* Step 2: AI Recommendation */}
          {currentStep === 'recommendation' && personalizedTemplate && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900 mb-1">
                      AI Recommendation
                    </h3>
                    <p className="text-sm text-blue-700">
                      Based on context and performance, we recommend this template
                    </p>
                  </div>
                </div>
              </div>

              {/* Template Preview */}
              <div className="rounded-lg border border-gray-200">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {recommendedTemplate?.template_name}
                      </h4>
                      {recommendedTemplate?.recovery_rate_percent && (
                        <p className="text-xs text-gray-600">
                          {recommendedTemplate.recovery_rate_percent}% recovery rate
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                      {Math.round((personalizedTemplate.confidenceScore || 0) * 100)}% confidence
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Subject */}
                  <div>
                    <label className="text-xs font-medium text-gray-600">Subject:</label>
                    <p className="text-sm text-gray-900 mt-1">{personalizedTemplate.subject}</p>
                  </div>

                  {/* Body */}
                  <div>
                    <label className="text-xs font-medium text-gray-600">Message:</label>
                    <div className="mt-1 rounded-md bg-gray-50 p-3">
                      <pre className="whitespace-pre-wrap text-sm text-gray-900 font-sans">
                        {personalizedTemplate.body}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alternative Templates */}
              {alternativeTemplates.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
                    Try Different Template ({alternativeTemplates.length} alternatives)
                  </summary>
                  <div className="mt-2 space-y-2">
                    {alternativeTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => onSelectTemplate(template.id)}
                        className="w-full rounded-md border border-gray-200 p-3 text-left hover:border-blue-500 hover:bg-blue-50"
                      >
                        <p className="text-sm font-medium text-gray-900">{template.template_name}</p>
                        {template.recovery_rate_percent && (
                          <p className="text-xs text-gray-600">
                            {template.recovery_rate_percent}% recovery rate
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep('detection')}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCopy}
                  className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Template'}
                </button>
                <button
                  onClick={() => setCurrentStep('send')}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Send */}
          {currentStep === 'send' && personalizedTemplate && (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-start gap-3">
                  <Send className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-green-900 mb-1">
                      Ready to Send
                    </h3>
                    <p className="text-sm text-green-700">
                      Template is copied to your clipboard. Send via your email client.
                    </p>
                  </div>
                </div>
              </div>

              {/* Channel Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Channel:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedChannel('email')}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      selectedChannel === 'email'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">Email</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Send via Gmail or Outlook
                    </p>
                  </button>
                  <button
                    onClick={() => setSelectedChannel('linkedin')}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      selectedChannel === 'linkedin'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">LinkedIn</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Send as LinkedIn message
                    </p>
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-2">Next Steps:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                  <li>Template is copied to clipboard</li>
                  <li>Open your {selectedChannel === 'email' ? 'email client' : 'LinkedIn'}</li>
                  <li>Paste and send to {contactName}</li>
                  <li>Click "Mark as Sent" below when done</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep('recommendation')}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Mark as Sent
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Response Tracking */}
          {currentStep === 'response' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <Eye className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900 mb-1">
                      Intervention Deployed
                    </h3>
                    <p className="text-sm text-blue-700">
                      We'll track engagement and notify you when they respond
                    </p>
                  </div>
                </div>
              </div>

              {/* Tracking Info */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-3">What We're Tracking:</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email Sent</p>
                      <p className="text-xs text-gray-600">Just now</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 opacity-50">
                    <Eye className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email Opened</p>
                      <p className="text-xs text-gray-600">Waiting...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 opacity-50">
                    <Send className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Response Received</p>
                      <p className="text-xs text-gray-600">Waiting...</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next steps */}
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-2">What Happens Next:</h4>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• We'll notify you when they open the email</li>
                  <li>• You'll get an alert when they respond</li>
                  <li>• AI will suggest a reply based on their response</li>
                  <li>• Health score will update as engagement improves</li>
                </ul>
              </div>

              <button
                onClick={onClose}
                className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
