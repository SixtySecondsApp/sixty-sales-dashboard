import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  X,
  Building2,
  ArrowRight,
  Handshake,
  Users,
  Activity,
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Eye,
  Shuffle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCompanyMerge } from '@/lib/hooks/useCompanyMerge';
import { MergePreview } from '@/lib/services/companyMergeService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Company {
  id: string;
  name: string;
  status: string;
  website?: string;
  industry?: string;
  created_at: string;
  deal_count?: number;
  contact_count?: number;
  total_value?: number;
}

interface MergeCompaniesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceCompanies: Company[];
  targetCompany?: Company;
  onMergeComplete?: (result: any) => void;
}

export function MergeCompaniesModal({
  isOpen,
  onClose,
  sourceCompanies,
  targetCompany: initialTargetCompany,
  onMergeComplete
}: MergeCompaniesModalProps) {
  const {
    isLoading,
    mergePreview,
    previewMerge,
    executeMerge,
    validateMergePermissions,
    error
  } = useCompanyMerge();

  const [targetCompany, setTargetCompany] = useState<Company | undefined>(initialTargetCompany);
  const [currentStep, setCurrentStep] = useState<'select' | 'preview' | 'confirm' | 'complete'>('select');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [mergeResult, setMergeResult] = useState<any>(null);

  // All companies available for selection as target
  const allCompanies = targetCompany 
    ? [targetCompany, ...sourceCompanies]
    : sourceCompanies;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(initialTargetCompany ? 'preview' : 'select');
      setValidationResult(null);
      setMergeResult(null);
      if (initialTargetCompany) {
        handleGeneratePreview();
      }
    }
  }, [isOpen, initialTargetCompany]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleTargetSelection = (company: Company) => {
    setTargetCompany(company);
    setCurrentStep('preview');
    handleGeneratePreview(company);
  };

  const handleGeneratePreview = async (target = targetCompany) => {
    if (!target) return;

    try {
      const sourceIds = sourceCompanies
        .filter(c => c.id !== target.id)
        .map(c => c.id);
      
      if (sourceIds.length === 0) return;

      await previewMerge(sourceIds, target.id);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  };

  const handleValidateAndConfirm = async () => {
    if (!targetCompany) return;

    try {
      const sourceIds = sourceCompanies
        .filter(c => c.id !== targetCompany.id)
        .map(c => c.id);
      
      const validation = await validateMergePermissions([...sourceIds, targetCompany.id]);
      setValidationResult(validation);
      setCurrentStep('confirm');
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleExecuteMerge = async () => {
    if (!targetCompany || !mergePreview) return;

    try {
      const sourceIds = sourceCompanies
        .filter(c => c.id !== targetCompany.id)
        .map(c => c.id);

      const result = await executeMerge(sourceIds, targetCompany.id, {
        merged_via: 'manual_modal',
        source_companies: sourceCompanies.filter(c => c.id !== targetCompany.id).map(c => ({
          id: c.id,
          name: c.name
        })),
        target_company: {
          id: targetCompany.id,
          name: targetCompany.name
        }
      });

      setMergeResult(result);
      setCurrentStep('complete');
      
      if (onMergeComplete) {
        onMergeComplete(result);
      }
    } catch (error) {
      console.error('Merge execution failed:', error);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'select':
        return renderSelectTarget();
      case 'preview':
        return renderPreview();
      case 'confirm':
        return renderConfirm();
      case 'complete':
        return renderComplete();
      default:
        return null;
    }
  };

  const renderSelectTarget = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Building2 className="w-12 h-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Select Target Company</h3>
        <p className="text-gray-400 text-sm">
          Choose which company will receive all data from the other companies
        </p>
      </div>

      <div className="space-y-3">
        {allCompanies.map((company) => (
          <Card 
            key={company.id}
            className="bg-gray-800/50 border-gray-700/50 hover:border-blue-500/50 cursor-pointer transition-colors"
            onClick={() => handleTargetSelection(company)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-white">{company.name}</h4>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                    <span>{company.industry || 'No industry'}</span>
                    <span>•</span>
                    <span>Created {format(new Date(company.created_at), 'MMM yyyy')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "capitalize",
                      company.status === 'active' 
                        ? 'border-green-500/30 text-green-400'
                        : 'border-gray-500/30 text-gray-400'
                    )}
                  >
                    {company.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Merge Preview</h3>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
      </div>

      {mergePreview && (
        <>
          {/* Company Overview */}
          <div className="flex items-center justify-center gap-4 p-4 bg-gray-800/30 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">Merging From</div>
              <div className="space-y-1">
                {mergePreview.source_companies.map(company => (
                  <div key={company.id} className="text-white font-medium">
                    {company.name}
                  </div>
                ))}
              </div>
            </div>
            
            <ArrowRight className="w-6 h-6 text-blue-400" />
            
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">Merging Into</div>
              <div className="text-white font-medium text-lg">
                {mergePreview.target_company.name}
              </div>
              <Badge 
                variant="outline" 
                className="mt-1 border-green-500/30 text-green-400"
              >
                Primary Company
              </Badge>
            </div>
          </div>

          {/* Transfer Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="bg-gray-800/50 border-gray-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-blue-400" />
                  <CardTitle className="text-sm text-gray-400">Deals</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-white">{mergePreview.deals.count}</div>
                <div className="text-sm text-blue-400">
                  {formatCurrency(mergePreview.deals.total_value)}
                </div>
                {mergePreview.deals.total_mrr > 0 && (
                  <div className="text-xs text-gray-400">
                    {formatCurrency(mergePreview.deals.total_mrr)} MRR
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <CardTitle className="text-sm text-gray-400">Contacts</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-white">{mergePreview.contacts.count}</div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <CardTitle className="text-sm text-gray-400">Activities</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-white">{mergePreview.activities.count}</div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-400" />
                  <CardTitle className="text-sm text-gray-400">Tasks</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-white">{mergePreview.tasks.count}</div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-yellow-400" />
                  <CardTitle className="text-sm text-gray-400">Notes</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-white">{mergePreview.notes.count}</div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <CardTitle className="text-sm text-gray-400">Clients</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-white">{mergePreview.clients.count}</div>
              </CardContent>
            </Card>
          </div>

          {/* Info Alert */}
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-400">
              All data from the source companies will be transferred to {mergePreview.target_company.name}. 
              The source companies will be marked as merged but not deleted.
            </AlertDescription>
          </Alert>
        </>
      )}

      {error && (
        <Alert className="bg-red-500/10 border-red-500/30">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderConfirm = () => (
    <div className="space-y-6">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Confirm Merge</h3>
        <p className="text-gray-400 text-sm">
          This action cannot be undone. Please review the details carefully.
        </p>
      </div>

      {validationResult && (
        <>
          {validationResult.valid ? (
            <Alert className="bg-green-500/10 border-green-500/30">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-400">
                All validation checks passed. Ready to merge.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">
                <div>Validation failed:</div>
                <ul className="mt-2 list-disc list-inside">
                  {validationResult.errors?.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validationResult.warnings && validationResult.warnings.length > 0 && (
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
              <Info className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-400">
                <div>Warnings:</div>
                <ul className="mt-2 list-disc list-inside">
                  {validationResult.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {mergePreview && (
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Merge Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Source Companies:</span>
              <div className="mt-1">
                {mergePreview.source_companies.map(company => (
                  <div key={company.id} className="text-white">{company.name}</div>
                ))}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Target Company:</span>
              <div className="text-white mt-1">{mergePreview.target_company.name}</div>
            </div>
            <div>
              <span className="text-gray-400">Total Data:</span>
              <div className="text-white mt-1">
                {mergePreview.deals.count} deals, {mergePreview.contacts.count} contacts, {mergePreview.activities.count} activities
              </div>
            </div>
            <div>
              <span className="text-gray-400">Total Value:</span>
              <div className="text-white mt-1">{formatCurrency(mergePreview.deals.total_value)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-6 text-center">
      <div>
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Merge Completed!</h3>
        <p className="text-gray-400">
          Companies have been successfully merged.
        </p>
      </div>

      {mergeResult && (
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Transfer Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-400">{mergeResult.deals_transferred}</div>
              <div className="text-gray-400">Deals Transferred</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-emerald-400">{mergeResult.contacts_transferred}</div>
              <div className="text-gray-400">Contacts Transferred</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-400">{mergeResult.activities_transferred}</div>
              <div className="text-gray-400">Activities Transferred</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-orange-400">{mergeResult.tasks_transferred}</div>
              <div className="text-gray-400">Tasks Transferred</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const getStepButtons = () => {
    switch (currentStep) {
      case 'select':
        return (
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-800/50 border-gray-700/50 text-gray-300"
          >
            Cancel
          </Button>
        );
      case 'preview':
        return (
          <>
            <Button
              variant="outline"
              onClick={() => setCurrentStep('select')}
              className="bg-gray-800/50 border-gray-700/50 text-gray-300"
            >
              Back
            </Button>
            <Button
              onClick={handleValidateAndConfirm}
              disabled={!mergePreview || isLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Merge
                </>
              )}
            </Button>
          </>
        );
      case 'confirm':
        return (
          <>
            <Button
              variant="outline"
              onClick={() => setCurrentStep('preview')}
              className="bg-gray-800/50 border-gray-700/50 text-gray-300"
            >
              Back
            </Button>
            <Button
              onClick={handleExecuteMerge}
              disabled={!validationResult?.valid || isLoading}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Shuffle className="w-4 h-4 mr-2" />
                  Execute Merge
                </>
              )}
            </Button>
          </>
        );
      case 'complete':
        return (
          <Button
            onClick={onClose}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            Done
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-blue-400" />
            Merge Companies
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {renderStep()}
        </div>

        <DialogFooter className="flex justify-between">
          {getStepButtons()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}