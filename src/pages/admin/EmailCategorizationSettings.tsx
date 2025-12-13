/**
 * Email Categorization Settings Admin Page
 * 
 * Full settings page for configuring Fyxer-style email categorization
 */

import React from 'react';
import { EmailCategorizationSettings as CategorizationSettingsComponent } from '@/components/integrations/EmailCategorizationSettings';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrg } from '@/lib/contexts/OrgContext';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function EmailCategorizationSettingsPage() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuth();
  const { organization, loading: orgLoading } = useOrg();

  if (userLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Categorization</h1>
        <p className="text-muted-foreground">
          Configure how your emails are automatically categorized for sales follow-ups
        </p>
      </div>

      {/* Settings Component */}
      <CategorizationSettingsComponent orgId={organization?.id || null} />
    </div>
  );
}

