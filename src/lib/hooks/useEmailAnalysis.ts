/**
 * React Hook for Email AI Analysis
 * Provides email categorization, sentiment analysis, and smart features
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { emailAnalysisService, type EmailAnalysis, type SmartReply, type EmailSummary } from '../services/emailAnalysisService';
import type { GmailMessage } from '../types/gmail';
import { supabase } from '../supabase/clientV2';
import { toast } from 'sonner';
import logger from '../utils/logger';

export function useEmailAnalysis(email: GmailMessage | null) {
  const [userId, setUserId] = useState<string | undefined>();

  // Get current user ID
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      return user;
    },
  });

  // Analyze email
  const { data: analysis, isLoading: isAnalyzing, refetch: analyzeEmail } = useQuery({
    queryKey: ['emailAnalysis', email?.id],
    queryFn: () => email ? emailAnalysisService.analyzeEmail(email, userId) : Promise.resolve(null),
    enabled: !!email,
    gcTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Generate smart replies
  const smartReplies = useMutation({
    mutationFn: async (tone: 'professional' | 'friendly' | 'casual' | 'formal' = 'professional') => {
      if (!email) throw new Error('No email selected');
      return emailAnalysisService.generateSmartReplies(email, userId, tone);
    },
    onSuccess: (replies) => {
      logger.log('✅ Smart replies generated:', replies.length);
      toast.success(`Generated ${replies.length} reply suggestions`);
    },
    onError: (error) => {
      logger.error('❌ Error generating smart replies:', error);
      toast.error('Failed to generate reply suggestions');
    },
  });

  // Summarize email
  const summarize = useMutation({
    mutationFn: async (emails?: GmailMessage[]) => {
      const emailsToSummarize = emails || (email ? [email] : []);
      if (emailsToSummarize.length === 0) throw new Error('No emails to summarize');
      return emailAnalysisService.summarizeEmail(emailsToSummarize, userId);
    },
    onSuccess: (summary) => {
      logger.log('✅ Email summary generated:', summary);
      toast.success('Summary generated');
    },
    onError: (error) => {
      logger.error('❌ Error generating summary:', error);
      toast.error('Failed to generate summary');
    },
  });

  // Generate smart compose
  const smartCompose = useMutation({
    mutationFn: async (context: {
      recipient?: string;
      subject?: string;
      replyToEmail?: GmailMessage;
      tone?: 'professional' | 'friendly' | 'casual' | 'formal';
      purpose?: string;
    }) => {
      return emailAnalysisService.generateSmartCompose(context, userId);
    },
    onSuccess: () => {
      logger.log('✅ Smart compose generated');
      toast.success('Email drafted');
    },
    onError: (error) => {
      logger.error('❌ Error generating smart compose:', error);
      toast.error('Failed to draft email');
    },
  });

  return {
    // Analysis
    analysis,
    isAnalyzing,
    analyzeEmail,

    // Smart Replies
    generateSmartReplies: smartReplies.mutate,
    smartRepliesData: smartReplies.data,
    isGeneratingReplies: smartReplies.isPending,

    // Summarization
    summarize: summarize.mutate,
    summary: summarize.data,
    isSummarizing: summarize.isPending,

    // Smart Compose
    smartCompose: smartCompose.mutate,
    composedEmail: smartCompose.data,
    isComposing: smartCompose.isPending,
  };
}

/**
 * Hook for batch analyzing multiple emails
 */
export function useBatchEmailAnalysis(emails: GmailMessage[]) {
  const [userId, setUserId] = useState<string | undefined>();

  // Get current user ID
  useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      return user;
    },
  });

  const batchAnalyze = useMutation({
    mutationFn: async () => {
      if (emails.length === 0) throw new Error('No emails to analyze');
      return emailAnalysisService.batchAnalyzeEmails(emails, userId);
    },
    onSuccess: (results) => {
      logger.log('✅ Batch analysis complete:', results.size);
      toast.success(`Analyzed ${results.size} emails`);
    },
    onError: (error) => {
      logger.error('❌ Error in batch analysis:', error);
      toast.error('Failed to analyze emails');
    },
  });

  return {
    batchAnalyze: batchAnalyze.mutate,
    analysisResults: batchAnalyze.data,
    isAnalyzing: batchAnalyze.isPending,
  };
}

/**
 * Get category badge color
 */
export function getCategoryColor(category: EmailAnalysis['category']): string {
  const colors = {
    work: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    personal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    marketing: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    newsletter: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    social: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    notification: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    spam: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return colors[category] || colors.personal;
}

/**
 * Get sentiment badge color
 */
export function getSentimentColor(sentiment: EmailAnalysis['sentiment']): string {
  const colors = {
    positive: 'bg-green-500/20 text-green-400 border-green-500/30',
    neutral: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    negative: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return colors[sentiment] || colors.neutral;
}

/**
 * Get priority badge color
 */
export function getPriorityColor(priority: EmailAnalysis['priority']): string {
  const colors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  return colors[priority] || colors.medium;
}
