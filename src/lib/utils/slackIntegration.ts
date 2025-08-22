// Slack Integration Utilities
// This file provides various ways to integrate with Slack for sharing roadmap tickets

import logger from '@/lib/utils/logger';

export interface SlackShareOptions {
  ticketId: number;
  title: string;
  description: string;
  ticketUrl: string;
  type?: string;
  priority?: string;
  status?: string;
}

/**
 * Generate Slack-formatted message for roadmap tickets
 */
export function generateSlackMessage(options: SlackShareOptions): string {
  const { ticketId, title, description, ticketUrl, type, priority, status } = options;
  
  // Create status emoji based on priority and type
  const getEmoji = () => {
    if (type === 'bug') return '🐛';
    if (type === 'feature') return '✨';
    if (type === 'improvement') return '🚀';
    if (priority === 'critical') return '🚨';
    if (priority === 'high') return '⚡';
    return '📋';
  };

  // Create priority badge
  const getPriorityBadge = () => {
    switch (priority) {
      case 'critical': return '🔴 Critical';
      case 'high': return '🟡 High';
      case 'medium': return '🟢 Medium';
      case 'low': return '🔵 Low';
      default: return '';
    }
  };

  // Build the message
  const emoji = getEmoji();
  const priorityBadge = getPriorityBadge();
  
  let message = `${emoji} *Roadmap Ticket #${ticketId}*\n`;
  message += `*${title}*\n\n`;
  
  if (description) {
    // Limit description length for Slack
    const truncatedDesc = description.length > 200 
      ? description.substring(0, 200) + '...' 
      : description;
    message += `${truncatedDesc}\n\n`;
  }
  
  // Add metadata
  if (priorityBadge) {
    message += `Priority: ${priorityBadge}\n`;
  }
  
  if (type) {
    message += `Type: ${type.charAt(0).toUpperCase() + type.slice(1)}\n`;
  }
  
  if (status) {
    message += `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}\n`;
  }
  
  message += `\n🔗 <${ticketUrl}|View Full Ticket>`;
  
  return message;
}

/**
 * Copy Slack-formatted message to clipboard
 */
export async function copySlackMessage(options: SlackShareOptions): Promise<void> {
  const message = generateSlackMessage(options);
  await navigator.clipboard.writeText(message);
}

/**
 * Generate Slack Block Kit format for rich messages
 * This can be used with Slack webhooks or the Slack API
 */
export function generateSlackBlocks(options: SlackShareOptions) {
  const { ticketId, title, description, ticketUrl, type, priority, status } = options;
  
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Roadmap Ticket #${ticketId}*\n${title}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: description
        }
      },
      {
        type: "section",
        fields: [
          ...(priority ? [{
            type: "mrkdwn",
            text: `*Priority:*\n${priority.charAt(0).toUpperCase() + priority.slice(1)}`
          }] : []),
          ...(type ? [{
            type: "mrkdwn",
            text: `*Type:*\n${type.charAt(0).toUpperCase() + type.slice(1)}`
          }] : []),
          ...(status ? [{
            type: "mrkdwn",
            text: `*Status:*\n${status.charAt(0).toUpperCase() + status.slice(1)}`
          }] : [])
        ]
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Ticket"
            },
            url: ticketUrl,
            style: "primary"
          }
        ]
      }
    ]
  };
}

/**
 * Send message to Slack via webhook (requires webhook URL)
 * This is for teams that have set up Slack webhooks
 */
export async function sendToSlackWebhook(
  webhookUrl: string, 
  options: SlackShareOptions,
  useBlocks = false
): Promise<boolean> {
  try {
    const payload = useBlocks 
      ? generateSlackBlocks(options)
      : { text: generateSlackMessage(options) };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    logger.error('Failed to send to Slack webhook:', error);
    return false;
  }
}

/**
 * Open Slack desktop app with pre-filled message (if available)
 */
export function openSlackApp(options: SlackShareOptions): boolean {
  try {
    const message = encodeURIComponent(generateSlackMessage(options));
    const slackUrl = `slack://channel?text=${message}`;
    
    // Try to open Slack app
    window.location.href = slackUrl;
    
    // Return true if we attempted to open
    return true;
  } catch (error) {
    logger.error('Failed to open Slack app:', error);
    return false;
  }
}

/**
 * Get Slack sharing options based on what's available
 */
export function getAvailableSlackOptions() {
  const options = [
    {
      id: 'copy-formatted',
      name: 'Copy Slack Message',
      description: 'Copy formatted message to paste in Slack',
      available: true
    }
  ];

  // Check if we can detect Slack app (this is limited in browsers)
  // We'll always show the copy option as it's most reliable
  
  return options;
}