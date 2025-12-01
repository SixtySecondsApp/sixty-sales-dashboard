/**
 * Types for the Onboarding Timeline Simulator
 */

export interface TrialStatus {
  isTrialing: boolean;
  daysRemaining: number;
  endsAt: Date | null;
  startedAt: Date | null;
  hasExpired: boolean;
  hasPaymentMethod: boolean;
}

export interface EmailData {
  type: 'access_grant' | 'reminder' | 'welcome' | 'trial_ending' | 'trial_expired';
  subject: string;
  templateId?: string;
  templateType?: string;
}

export interface ScreenData {
  route: string;
  description: string;
  components?: string[]; // e.g., ['TrialBanner', 'TrialBadge']
}

export interface TrialDayData {
  title: string;
  trialStatus: TrialStatus;
  emails: EmailData[];
  screens: ScreenData[];
  features: string[];
  notes?: string;
}

export interface TrialTimelineData {
  [day: number]: TrialDayData;
}

