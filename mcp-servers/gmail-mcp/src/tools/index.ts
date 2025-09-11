import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { GmailClient } from '../gmail-client.js';

/**
 * Gmail Tools Implementation
 * Provides all Gmail MCP tools with proper validation and error handling
 */

// Input validation schemas
const ListEmailsArgsSchema = z.object({
  query: z.string().optional(),
  maxResults: z.number().min(1).max(500).optional().default(10),
  labelIds: z.array(z.string()).optional(),
});

const GetEmailArgsSchema = z.object({
  messageId: z.string().min(1),
  format: z.enum(['minimal', 'full', 'raw', 'metadata']).optional().default('full'),
});

const GetThreadArgsSchema = z.object({
  threadId: z.string().min(1),
  format: z.enum(['minimal', 'full', 'metadata']).optional().default('full'),
});

const SearchEmailsArgsSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().min(1).max(500).optional().default(20),
  includeSpamTrash: z.boolean().optional().default(false),
});

const SendEmailArgsSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  isHtml: z.boolean().optional().default(false),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    contentType: z.string(),
  })).optional(),
});

const ReplyEmailArgsSchema = z.object({
  messageId: z.string().min(1),
  body: z.string().min(1),
  replyAll: z.boolean().optional().default(false),
  isHtml: z.boolean().optional().default(false),
});

const ForwardEmailArgsSchema = z.object({
  messageId: z.string().min(1),
  to: z.array(z.string().email()).min(1),
  additionalMessage: z.string().optional(),
});

const MessageIdsArgsSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1),
});

const DeleteEmailArgsSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1),
  permanent: z.boolean().optional().default(false),
});

const MarkAsReadArgsSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1),
  read: z.boolean().optional().default(true),
});

const StarEmailArgsSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1),
  starred: z.boolean().optional().default(true),
});

const ApplyLabelArgsSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1),
  labelIds: z.array(z.string().min(1)).min(1),
  action: z.enum(['add', 'remove']).optional().default('add'),
});

const CreateLabelArgsSchema = z.object({
  name: z.string().min(1),
  messageListVisibility: z.enum(['show', 'hide']).optional().default('show'),
  labelListVisibility: z.enum(['labelShow', 'labelHide', 'labelShowIfUnread']).optional().default('labelShow'),
  color: z.object({
    textColor: z.string().optional(),
    backgroundColor: z.string().optional(),
  }).optional(),
});

const GetLabelsArgsSchema = z.object({
  includeSystem: z.boolean().optional().default(true),
});

const ScheduleSendArgsSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  scheduledTime: z.string().min(1),
  isHtml: z.boolean().optional().default(false),
});

const CreateDraftArgsSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  isHtml: z.boolean().optional().default(false),
});

const ExtractAttachmentsArgsSchema = z.object({
  messageId: z.string().min(1),
  downloadPath: z.string().optional(),
  filenameFilter: z.string().optional(),
});

const SummarizeThreadArgsSchema = z.object({
  threadId: z.string().min(1),
  summaryType: z.enum(['brief', 'detailed', 'action_items']).optional().default('brief'),
  maxMessages: z.number().min(1).max(50).optional().default(20),
});

/**
 * Create all Gmail tools
 */
export function createGmailTools(_gmailClient: GmailClient): Tool[] {
  return [
    // List emails
    {
      name: 'gmail_list_emails',
      description: 'List emails from Gmail with optional filtering and search criteria',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Gmail search query using Gmail operators (e.g., "is:unread", "from:user@example.com", "has:attachment")',
          },
          maxResults: {
            type: 'number',
            minimum: 1,
            maximum: 500,
            default: 10,
            description: 'Maximum number of emails to retrieve',
          },
          labelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of label IDs to filter by (e.g., ["INBOX", "IMPORTANT"])',
          },
        },
      },
    },

    // Get specific email
    {
      name: 'gmail_get_email',
      description: 'Get detailed information about a specific email by its ID',
      inputSchema: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'Gmail message ID',
          },
          format: {
            type: 'string',
            enum: ['minimal', 'full', 'raw', 'metadata'],
            default: 'full',
            description: 'Format of the message response',
          },
        },
        required: ['messageId'],
      },
    },

    // Get email thread
    {
      name: 'gmail_get_thread',
      description: 'Get an email thread with all related messages',
      inputSchema: {
        type: 'object',
        properties: {
          threadId: {
            type: 'string',
            description: 'Gmail thread ID',
          },
          format: {
            type: 'string',
            enum: ['minimal', 'full', 'metadata'],
            default: 'full',
            description: 'Format of the thread response',
          },
        },
        required: ['threadId'],
      },
    },

    // Search emails
    {
      name: 'gmail_search',
      description: 'Advanced Gmail search with complex queries and operators',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Advanced search query using Gmail operators (e.g., "from:john@example.com has:attachment older_than:7d")',
          },
          maxResults: {
            type: 'number',
            minimum: 1,
            maximum: 500,
            default: 20,
            description: 'Maximum results to return',
          },
          includeSpamTrash: {
            type: 'boolean',
            default: false,
            description: 'Include messages from spam and trash folders',
          },
        },
        required: ['query'],
      },
    },

    // Send email
    {
      name: 'gmail_send_email',
      description: 'Send a new email message with optional attachments',
      inputSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            minItems: 1,
            description: 'Recipient email addresses',
          },
          cc: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            description: 'CC recipient email addresses',
          },
          bcc: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            description: 'BCC recipient email addresses',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Email body content',
          },
          isHtml: {
            type: 'boolean',
            default: false,
            description: 'Whether the body contains HTML content',
          },
          attachments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                content: { type: 'string', description: 'Base64 encoded file content' },
                contentType: { type: 'string', description: 'MIME type of the file' },
              },
              required: ['filename', 'content', 'contentType'],
            },
            description: 'File attachments',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },

    // Reply to email
    {
      name: 'gmail_reply_to_email',
      description: 'Reply to an existing email message',
      inputSchema: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'ID of the message to reply to',
          },
          body: {
            type: 'string',
            description: 'Reply message content',
          },
          replyAll: {
            type: 'boolean',
            default: false,
            description: 'Reply to all recipients instead of just the sender',
          },
          isHtml: {
            type: 'boolean',
            default: false,
            description: 'Whether the body contains HTML content',
          },
        },
        required: ['messageId', 'body'],
      },
    },

    // Forward email
    {
      name: 'gmail_forward_email',
      description: 'Forward an email to other recipients',
      inputSchema: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'ID of the message to forward',
          },
          to: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            minItems: 1,
            description: 'Recipients to forward the message to',
          },
          additionalMessage: {
            type: 'string',
            description: 'Additional message to include before the forwarded content',
          },
        },
        required: ['messageId', 'to'],
      },
    },

    // Archive emails
    {
      name: 'gmail_archive_email',
      description: 'Archive one or more emails (remove from inbox)',
      inputSchema: {
        type: 'object',
        properties: {
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Array of message IDs to archive',
          },
        },
        required: ['messageIds'],
      },
    },

    // Delete emails
    {
      name: 'gmail_delete_email',
      description: 'Delete emails (move to trash or permanent deletion)',
      inputSchema: {
        type: 'object',
        properties: {
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Array of message IDs to delete',
          },
          permanent: {
            type: 'boolean',
            default: false,
            description: 'Permanently delete emails (requires admin privileges)',
          },
        },
        required: ['messageIds'],
      },
    },

    // Mark as read/unread
    {
      name: 'gmail_mark_as_read',
      description: 'Mark emails as read or unread',
      inputSchema: {
        type: 'object',
        properties: {
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Array of message IDs',
          },
          read: {
            type: 'boolean',
            default: true,
            description: 'Mark as read (true) or unread (false)',
          },
        },
        required: ['messageIds'],
      },
    },

    // Star/unstar emails
    {
      name: 'gmail_star_email',
      description: 'Add or remove stars from emails',
      inputSchema: {
        type: 'object',
        properties: {
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Array of message IDs',
          },
          starred: {
            type: 'boolean',
            default: true,
            description: 'Add star (true) or remove star (false)',
          },
        },
        required: ['messageIds'],
      },
    },

    // Apply labels
    {
      name: 'gmail_apply_label',
      description: 'Apply or remove labels from emails',
      inputSchema: {
        type: 'object',
        properties: {
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Array of message IDs',
          },
          labelIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Array of label IDs to apply or remove',
          },
          action: {
            type: 'string',
            enum: ['add', 'remove'],
            default: 'add',
            description: 'Add or remove the specified labels',
          },
        },
        required: ['messageIds', 'labelIds'],
      },
    },

    // Create label
    {
      name: 'gmail_create_label',
      description: 'Create a new Gmail label with custom settings',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Label name',
          },
          messageListVisibility: {
            type: 'string',
            enum: ['show', 'hide'],
            default: 'show',
            description: 'Visibility of the label in the message list',
          },
          labelListVisibility: {
            type: 'string',
            enum: ['labelShow', 'labelHide', 'labelShowIfUnread'],
            default: 'labelShow',
            description: 'Visibility of the label in the label list',
          },
          color: {
            type: 'object',
            properties: {
              textColor: { type: 'string' },
              backgroundColor: { type: 'string' },
            },
            description: 'Label color settings',
          },
        },
        required: ['name'],
      },
    },

    // Get labels
    {
      name: 'gmail_get_labels',
      description: 'Get all Gmail labels (system and user-created)',
      inputSchema: {
        type: 'object',
        properties: {
          includeSystem: {
            type: 'boolean',
            default: true,
            description: 'Include system labels like INBOX, SENT, etc.',
          },
        },
      },
    },

    // Schedule send (Note: This is a mock implementation as Gmail API doesn't directly support scheduled sending)
    {
      name: 'gmail_schedule_send',
      description: 'Schedule an email to be sent at a specific time (creates draft with reminder)',
      inputSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            minItems: 1,
            description: 'Recipient email addresses',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Email body content',
          },
          scheduledTime: {
            type: 'string',
            description: 'ISO 8601 timestamp for when to send the email',
          },
          isHtml: {
            type: 'boolean',
            default: false,
            description: 'Whether the body contains HTML content',
          },
        },
        required: ['to', 'subject', 'body', 'scheduledTime'],
      },
    },

    // Create draft
    {
      name: 'gmail_create_draft',
      description: 'Create a draft email message',
      inputSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            minItems: 1,
            description: 'Recipient email addresses',
          },
          cc: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            description: 'CC recipient email addresses',
          },
          bcc: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            description: 'BCC recipient email addresses',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Email body content',
          },
          isHtml: {
            type: 'boolean',
            default: false,
            description: 'Whether the body contains HTML content',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },

    // Extract attachments
    {
      name: 'gmail_extract_attachments',
      description: 'Extract and download attachments from an email',
      inputSchema: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'Gmail message ID',
          },
          downloadPath: {
            type: 'string',
            description: 'Local path to save attachments (optional)',
          },
          filenameFilter: {
            type: 'string',
            description: 'Regular expression pattern to filter filenames',
          },
        },
        required: ['messageId'],
      },
    },

    // Summarize thread
    {
      name: 'gmail_summarize_thread',
      description: 'Generate an AI summary of an email thread conversation',
      inputSchema: {
        type: 'object',
        properties: {
          threadId: {
            type: 'string',
            description: 'Gmail thread ID',
          },
          summaryType: {
            type: 'string',
            enum: ['brief', 'detailed', 'action_items'],
            default: 'brief',
            description: 'Type of summary to generate',
          },
          maxMessages: {
            type: 'number',
            minimum: 1,
            maximum: 50,
            default: 20,
            description: 'Maximum number of messages to include in summary',
          },
        },
        required: ['threadId'],
      },
    },
  ];
}

/**
 * Execute Gmail tool
 */
export async function executeGmailTool(
  name: string,
  args: any,
  gmailClient: GmailClient
): Promise<any> {
  try {
    switch (name) {
      case 'gmail_list_emails': {
        const validatedArgs = ListEmailsArgsSchema.parse(args);
        const emails = await gmailClient.listEmails({
          query: validatedArgs.query,
          maxResults: validatedArgs.maxResults,
          labelIds: validatedArgs.labelIds,
          includeSpamTrash: false, // Default value
        });
        return {
          emails,
          count: emails.length,
          hasMore: emails.length === validatedArgs.maxResults,
        };
      }

      case 'gmail_get_email': {
        const validatedArgs = GetEmailArgsSchema.parse(args);
        const email = await gmailClient.getEmail(validatedArgs.messageId, validatedArgs.format);
        return { email };
      }

      case 'gmail_get_thread': {
        const validatedArgs = GetThreadArgsSchema.parse(args);
        const thread = await gmailClient.getThread(validatedArgs.threadId, validatedArgs.format);
        return { thread };
      }

      case 'gmail_search': {
        const validatedArgs = SearchEmailsArgsSchema.parse(args);
        const emails = await gmailClient.searchEmails(
          validatedArgs.query,
          validatedArgs.maxResults,
          validatedArgs.includeSpamTrash
        );
        return {
          emails,
          count: emails.length,
          query: validatedArgs.query,
        };
      }

      case 'gmail_send_email': {
        const validatedArgs = SendEmailArgsSchema.parse(args);
        const messageId = await gmailClient.sendEmail(validatedArgs);
        return {
          success: true,
          messageId,
          message: 'Email sent successfully',
        };
      }

      case 'gmail_reply_to_email': {
        const validatedArgs = ReplyEmailArgsSchema.parse(args);
        const messageId = await gmailClient.replyToEmail(validatedArgs);
        return {
          success: true,
          messageId,
          message: 'Reply sent successfully',
        };
      }

      case 'gmail_forward_email': {
        const validatedArgs = ForwardEmailArgsSchema.parse(args);
        const messageId = await gmailClient.forwardEmail(validatedArgs);
        return {
          success: true,
          messageId,
          message: 'Email forwarded successfully',
        };
      }

      case 'gmail_archive_email': {
        const validatedArgs = MessageIdsArgsSchema.parse(args);
        await gmailClient.archiveEmails(validatedArgs.messageIds);
        return {
          success: true,
          archivedCount: validatedArgs.messageIds.length,
          message: 'Emails archived successfully',
        };
      }

      case 'gmail_delete_email': {
        const validatedArgs = DeleteEmailArgsSchema.parse(args);
        await gmailClient.deleteEmails(validatedArgs.messageIds, validatedArgs.permanent);
        return {
          success: true,
          deletedCount: validatedArgs.messageIds.length,
          permanent: validatedArgs.permanent,
          message: `Emails ${validatedArgs.permanent ? 'permanently deleted' : 'moved to trash'} successfully`,
        };
      }

      case 'gmail_mark_as_read': {
        const validatedArgs = MarkAsReadArgsSchema.parse(args);
        await gmailClient.markAsRead(validatedArgs.messageIds, validatedArgs.read);
        return {
          success: true,
          updatedCount: validatedArgs.messageIds.length,
          action: validatedArgs.read ? 'marked as read' : 'marked as unread',
        };
      }

      case 'gmail_star_email': {
        const validatedArgs = StarEmailArgsSchema.parse(args);
        await gmailClient.starEmails(validatedArgs.messageIds, validatedArgs.starred);
        return {
          success: true,
          updatedCount: validatedArgs.messageIds.length,
          action: validatedArgs.starred ? 'starred' : 'unstarred',
        };
      }

      case 'gmail_apply_label': {
        const validatedArgs = ApplyLabelArgsSchema.parse(args);
        await gmailClient.applyLabels(
          validatedArgs.messageIds,
          validatedArgs.labelIds,
          validatedArgs.action
        );
        return {
          success: true,
          updatedCount: validatedArgs.messageIds.length,
          action: validatedArgs.action,
          labelIds: validatedArgs.labelIds,
        };
      }

      case 'gmail_create_label': {
        const validatedArgs = CreateLabelArgsSchema.parse(args);
        const labelId = await gmailClient.createLabel(validatedArgs);
        return {
          success: true,
          labelId,
          name: validatedArgs.name,
          message: 'Label created successfully',
        };
      }

      case 'gmail_get_labels': {
        const validatedArgs = GetLabelsArgsSchema.parse(args);
        const labels = await gmailClient.getLabels(validatedArgs.includeSystem);
        return {
          labels,
          count: labels.length,
          includeSystem: validatedArgs.includeSystem,
        };
      }

      case 'gmail_schedule_send': {
        const validatedArgs = ScheduleSendArgsSchema.parse(args);
        
        // Since Gmail API doesn't support native scheduled sending,
        // we'll create a draft and provide instructions for scheduling
        const draftId = await gmailClient.createDraft({
          to: validatedArgs.to,
          subject: `[SCHEDULED: ${validatedArgs.scheduledTime}] ${validatedArgs.subject}`,
          body: `This email is scheduled to be sent at: ${validatedArgs.scheduledTime}\n\n${validatedArgs.body}`,
          isHtml: validatedArgs.isHtml,
        });

        return {
          success: true,
          draftId,
          scheduledTime: validatedArgs.scheduledTime,
          message: 'Draft created with schedule information. Use Gmail web interface or third-party tools to schedule sending.',
          instructions: 'To schedule this email, use Gmail web interface: Go to Drafts → Open draft → Click schedule send arrow → Select time',
        };
      }

      case 'gmail_create_draft': {
        const validatedArgs = CreateDraftArgsSchema.parse(args);
        const draftId = await gmailClient.createDraft(validatedArgs);
        return {
          success: true,
          draftId,
          message: 'Draft created successfully',
        };
      }

      case 'gmail_extract_attachments': {
        const validatedArgs = ExtractAttachmentsArgsSchema.parse(args);
        const attachments = await gmailClient.extractAttachments(validatedArgs.messageId);
        
        let filteredAttachments = attachments;
        if (validatedArgs.filenameFilter) {
          const regex = new RegExp(validatedArgs.filenameFilter);
          filteredAttachments = attachments.filter(att => regex.test(att.filename));
        }

        return {
          attachments: filteredAttachments.map(att => ({
            id: att.id,
            filename: att.filename,
            mimeType: att.mimeType,
            size: att.size,
            data: att.data, // base64 encoded
          })),
          totalCount: attachments.length,
          filteredCount: filteredAttachments.length,
          messageId: validatedArgs.messageId,
        };
      }

      case 'gmail_summarize_thread': {
        const validatedArgs = SummarizeThreadArgsSchema.parse(args);
        const thread = await gmailClient.getThread(validatedArgs.threadId, 'full');
        
        // Basic summarization logic
        const messagesToSummarize = thread.messages.slice(0, validatedArgs.maxMessages);
        const participants = Array.from(new Set(messagesToSummarize.map(msg => msg.from)));
        const dateRange = messagesToSummarize.length > 1 
          ? `${messagesToSummarize[0]?.date} to ${messagesToSummarize[messagesToSummarize.length - 1]?.date}`
          : messagesToSummarize[0]?.date || '';

        let summary = '';
        switch (validatedArgs.summaryType) {
          case 'brief':
            summary = `Thread "${thread.subject}" with ${participants.length} participants (${participants.join(', ')}). ${messagesToSummarize.length} messages from ${dateRange}.`;
            break;
          case 'detailed':
            summary = `Email thread summary:\n` +
              `Subject: ${thread.subject}\n` +
              `Participants: ${participants.join(', ')}\n` +
              `Message count: ${messagesToSummarize.length}\n` +
              `Date range: ${dateRange}\n` +
              `Key points:\n` +
              messagesToSummarize.map((msg, i) => 
                `${i + 1}. From ${msg.from} (${msg.date}): ${msg.snippet}`
              ).join('\n');
            break;
          case 'action_items':
            // Simple action item extraction (look for common action words)
            const actionWords = ['todo', 'action', 'task', 'deadline', 'due', 'follow up', 'next steps'];
            const actionItems = messagesToSummarize
              .filter(msg => actionWords.some(word => msg.snippet.toLowerCase().includes(word)))
              .map(msg => `- ${msg.from}: ${msg.snippet}`);
            summary = actionItems.length > 0 
              ? `Action items from thread:\n${actionItems.join('\n')}`
              : 'No clear action items identified in this thread.';
            break;
        }

        return {
          threadId: validatedArgs.threadId,
          subject: thread.subject,
          summary,
          summaryType: validatedArgs.summaryType,
          messageCount: messagesToSummarize.length,
          participants,
          dateRange,
        };
      }

      default:
        throw new Error(`Unknown Gmail tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid arguments: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}