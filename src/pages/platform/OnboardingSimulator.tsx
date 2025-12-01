/**
 * OnboardingSimulator Page
 * Platform admin tool to simulate and visualize the complete free trial onboarding journey
 */

import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrialTimeline } from '@/components/platform/simulator/TrialTimeline';
import { EmailPreview } from '@/components/platform/simulator/EmailPreview';
import { LivePreview } from '@/components/platform/simulator/LivePreview';
import { getDefaultTemplate, type EmailTemplate } from '@/lib/services/emailTemplateService';
import type { TrialTimelineData, TrialStatus } from '@/components/platform/simulator/types';
import { RotateCcw, Calendar, Mail, Eye } from 'lucide-react';

// Sample subscription data for simulation
const TRIAL_DAYS = 14;
const TRIAL_START_DATE = new Date();

function createTrialStatus(day: number, hasPaymentMethod = false): TrialStatus {
  const trialEndsAt = new Date(TRIAL_START_DATE);
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  const currentDate = new Date(TRIAL_START_DATE);
  currentDate.setDate(currentDate.getDate() + day);

  const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
  const hasExpired = currentDate >= trialEndsAt;
  const isTrialing = !hasExpired && day <= TRIAL_DAYS;

  return {
    isTrialing,
    daysRemaining,
    endsAt: trialEndsAt,
    startedAt: TRIAL_START_DATE,
    hasExpired,
    hasPaymentMethod,
  };
}

function generateTimelineData(): TrialTimelineData {
  const data: TrialTimelineData = {};

  // Day 0 - Signup
  data[0] = {
    title: 'Account Created - Trial Starts',
    trialStatus: createTrialStatus(0),
    emails: [
      {
        type: 'welcome',
        subject: 'Welcome Aboard! Let\'s Get You Started 👋',
        templateType: 'welcome',
      },
    ],
    screens: [
      {
        route: '/onboarding',
        description: 'User redirected to onboarding flow',
        components: ['WelcomeStep'],
      },
    ],
    features: ['Account Creation', 'Onboarding Access'],
    notes: 'Trial automatically starts when account is created. User receives welcome email immediately.',
  };

  // Day 1 - Onboarding
  data[1] = {
    title: 'Onboarding Flow - Org Setup & Fathom Connection',
    trialStatus: createTrialStatus(1),
    emails: [],
    screens: [
      {
        route: '/onboarding',
        description: 'Complete onboarding steps: org setup, Fathom connection, team invite',
        components: ['OrgSetupStep', 'FathomConnectionStep', 'TeamInviteStep'],
      },
      {
        route: '/meetings',
        description: 'After onboarding, user lands on meetings dashboard',
        components: ['TrialBanner', 'TrialBadge'],
      },
    ],
    features: ['Organization Setup', 'Fathom Integration', 'Team Invitations', 'Meetings Dashboard'],
    notes: 'User completes onboarding. Trial banner shows 13 days remaining.',
  };

  // Day 3 - First Follow-up
  data[3] = {
    title: 'First Follow-up Check',
    trialStatus: createTrialStatus(3),
    emails: [
      {
        type: 'reminder',
        subject: 'Reminder: Your Meeting Intelligence Access is Waiting! ⏰',
        templateType: 'reminder',
      },
    ],
    screens: [
      {
        route: '/meetings',
        description: 'User continues using the platform',
        components: ['TrialBanner'],
      },
    ],
    features: ['All Trial Features'],
    notes: 'If user hasn\'t completed onboarding, reminder email is sent.',
  };

  // Day 7 - Mid-trial
  data[7] = {
    title: 'Mid-Trial Check-in',
    trialStatus: createTrialStatus(7),
    emails: [],
    screens: [
      {
        route: '/meetings',
        description: 'Trial banner shows 7 days remaining',
        components: ['TrialBanner', 'TrialBadge'],
      },
    ],
    features: ['All Trial Features'],
    notes: 'Halfway through trial. Banner becomes more prominent (amber color).',
  };

  // Day 11 - Trial Ending Soon (Stripe webhook triggers)
  data[11] = {
    title: 'Trial Ending Soon Notification',
    trialStatus: createTrialStatus(11),
    emails: [
      {
        type: 'trial_ending',
        subject: 'Your trial ends in 3 days',
        templateType: 'reminder',
      },
    ],
    screens: [
      {
        route: '/meetings',
        description: 'Trial banner becomes urgent (red color)',
        components: ['TrialBanner', 'TrialBadge'],
      },
      {
        route: '/team/billing',
        description: 'User can add payment method',
        components: ['PaymentForm'],
      },
    ],
    features: ['All Trial Features', 'Payment Method Setup'],
    notes: 'Stripe webhook sends "trial_will_end" event. Banner shows urgent warning. In-app notification created.',
  };

  // Day 14 - Trial Expires
  data[14] = {
    title: 'Trial Expires',
    trialStatus: createTrialStatus(14, false), // No payment method
    emails: [
      {
        type: 'trial_expired',
        subject: 'Your trial has ended',
        templateType: 'reminder',
      },
    ],
    screens: [
      {
        route: '/team/billing',
        description: 'User redirected to billing page',
        components: ['UpgradePrompt', 'PaymentForm'],
      },
    ],
    features: ['Limited Access', 'Upgrade Required'],
    notes: 'Trial expires. User must add payment method to continue. Feature restrictions apply.',
  };

  // Day 15+ - Expired State
  data[15] = {
    title: 'Post-Trial - Upgrade Required',
    trialStatus: createTrialStatus(15, false),
    emails: [],
    screens: [
      {
        route: '/team/billing',
        description: 'Upgrade prompts throughout the app',
        components: ['UpgradeModal', 'FeatureRestrictionBanner'],
      },
    ],
    features: ['View-Only Access'],
    notes: 'User cannot access premium features until payment method is added.',
  };

  return data;
}

export default function OnboardingSimulator() {
  const [currentDay, setCurrentDay] = useState<number>(0);
  const [timelineData] = useState<TrialTimelineData>(() => generateTimelineData());
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<EmailTemplate | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);

  // Get email template for current day
  useEffect(() => {
    const dayData = timelineData[currentDay];
    if (!dayData || dayData.emails.length === 0) {
      setSelectedEmailTemplate(null);
      return;
    }

    // Get the first email's template
    const email = dayData.emails[0];
    if (email.templateType) {
      setIsLoadingEmail(true);
      getDefaultTemplate(email.templateType as any)
        .then((result) => {
          if (result.success && result.data) {
            setSelectedEmailTemplate(result.data);
          } else {
            setSelectedEmailTemplate(null);
          }
        })
        .catch((error) => {
          console.error('Error loading email template:', error);
          setSelectedEmailTemplate(null);
        })
        .finally(() => {
          setIsLoadingEmail(false);
        });
    } else {
      setSelectedEmailTemplate(null);
    }
  }, [currentDay, timelineData]);

  const currentTrialStatus = timelineData[currentDay]?.trialStatus || createTrialStatus(currentDay);

  // Sample variables for email preview
  const emailVariables = {
    user_name: 'Sarah Johnson',
    user_email: 'sarah@acmecorp.com',
    company_name: 'Acme Corp',
    referral_code: 'SARAHJ-2024',
    waitlist_position: '42',
    magic_link: '#preview',
    admin_name: 'Support Team',
    current_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    expiry_date: currentTrialStatus.endsAt
      ? currentTrialStatus.endsAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A',
    days_remaining: currentTrialStatus.daysRemaining,
  };

  const handleDayChange = (value: number[]) => {
    setCurrentDay(value[0]);
  };

  const resetToDay = (day: number) => {
    setCurrentDay(day);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Wrapper with max-width to prevent layout shift */}
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Onboarding Timeline Simulator
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Simulate and visualize the complete free trial journey for new users
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetToDay(0)}
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Day 0
              </Button>
            </div>
          </div>

          {/* Day Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Simulate Trial Day
              </CardTitle>
              <CardDescription>
                Drag the slider to simulate different days in the trial period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Slider
                  value={[currentDay]}
                  onValueChange={handleDayChange}
                  min={0}
                  max={15}
                  step={1}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Day 0 (Signup)</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    Day {currentDay} (Current)
                  </span>
                  <span>Day 15+ (Expired)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Two-column layout on desktop - Use lg: breakpoint for better desktop experience */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mb-8 w-full min-w-0">
          {/* Left Column - Timeline (2/3 width) */}
          <div className="min-w-0 w-full">
            <TrialTimeline
              timelineData={timelineData}
              currentDay={currentDay}
              onDaySelect={setCurrentDay}
            />
          </div>

          {/* Right Column - Preview Tabs (1/3 width) - Sticky on desktop */}
          <div className="min-w-0 w-full">
            <div className="lg:sticky lg:top-20 w-full">
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Live Preview
                  </TabsTrigger>
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="mt-0">
                  <LivePreview
                    trialStatus={currentTrialStatus}
                    day={currentDay}
                  />
                </TabsContent>

                <TabsContent value="email" className="mt-0">
                  {isLoadingEmail ? (
                    <Card className="h-full">
                      <CardContent className="flex items-center justify-center h-64">
                        <div className="text-gray-500 dark:text-gray-400">Loading email template...</div>
                      </CardContent>
                    </Card>
                  ) : (
                    <EmailPreview
                      template={selectedEmailTemplate}
                      variables={emailVariables}
                      day={currentDay}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Trial Status JSON Debug Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Trial Status (Debug)</CardTitle>
            <CardDescription>Current trial status calculation for Day {currentDay}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-xs">
              {JSON.stringify(currentTrialStatus, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

