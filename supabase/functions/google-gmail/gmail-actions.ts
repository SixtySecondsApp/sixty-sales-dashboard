// Gmail action functions for modifying emails

export async function modifyEmail(accessToken: string, request: any): Promise<any> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${request.messageId}/modify`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: request.addLabelIds || [],
        removeLabelIds: request.removeLabelIds || [],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  return await response.json();
}

export async function archiveEmail(accessToken: string, messageId: string): Promise<any> {
  // Archive means removing INBOX label
  return modifyEmail(accessToken, {
    messageId,
    removeLabelIds: ['INBOX'],
  });
}

export async function trashEmail(accessToken: string, messageId: string): Promise<any> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  return await response.json();
}

export async function starEmail(accessToken: string, messageId: string, starred: boolean): Promise<any> {
  // Star/unstar means adding/removing STARRED label
  return modifyEmail(accessToken, {
    messageId,
    addLabelIds: starred ? ['STARRED'] : [],
    removeLabelIds: starred ? [] : ['STARRED'],
  });
}

export async function markAsRead(accessToken: string, messageId: string, read: boolean): Promise<any> {
  // Mark as read/unread means removing/adding UNREAD label
  return modifyEmail(accessToken, {
    messageId,
    addLabelIds: read ? [] : ['UNREAD'],
    removeLabelIds: read ? ['UNREAD'] : [],
  });
}

export async function getFullLabel(accessToken: string, labelId: string): Promise<any> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  return await response.json();
}

export async function replyToEmail(
  accessToken: string,
  messageId: string,
  body: string,
  replyAll: boolean = false,
  isHtml: boolean = false
): Promise<any> {
  // First, get the original message to extract headers
  const messageResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!messageResponse.ok) {
    const errorData = await messageResponse.json();
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const originalMessage = await messageResponse.json();
  const headers = originalMessage.payload?.headers || [];
  
  const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name)?.value || '';
  
  const fromEmail = getHeader('from');
  const toEmails = getHeader('to')?.split(',').map((e: string) => e.trim()) || [];
  const ccEmails = getHeader('cc')?.split(',').map((e: string) => e.trim()) || [];
  const subject = getHeader('subject');
  const messageIdHeader = getHeader('message-id');
  
  // Extract email address from "Name <email@example.com>" format
  const extractEmail = (str: string) => {
    const match = str.match(/<(.+)>/);
    return match ? match[1] : str.trim();
  };
  
  const replyTo = extractEmail(fromEmail);
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  
  // Build reply recipients
  let replyToEmails: string[] = [];
  if (replyAll) {
    replyToEmails = [replyTo, ...toEmails.map(extractEmail), ...ccEmails.map(extractEmail)];
    replyToEmails = [...new Set(replyToEmails)]; // Remove duplicates
  } else {
    replyToEmails = [replyTo];
  }
  
  // Build email message
  const emailLines = [
    `To: ${replyToEmails.join(', ')}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${messageIdHeader}`,
    `References: ${messageIdHeader}`,
    `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
    '',
    body
  ];
  
  const emailMessage = emailLines.join('\r\n');
  const encodedMessage = btoa(emailMessage)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage,
        threadId: originalMessage.threadId
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  return await response.json();
}

export async function forwardEmail(
  accessToken: string,
  messageId: string,
  to: string[],
  additionalMessage?: string
): Promise<any> {
  // First, get the original message
  const messageResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!messageResponse.ok) {
    const errorData = await messageResponse.json();
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const originalMessage = await messageResponse.json();
  const headers = originalMessage.payload?.headers || [];
  
  const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name)?.value || '';
  
  const subject = getHeader('subject');
  const forwardSubject = subject.startsWith('Fwd:') ? subject : `Fwd: ${subject}`;
  
  // Get the original message body
  let originalBody = '';
  if (originalMessage.payload?.body?.data) {
    originalBody = atob(originalMessage.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  } else if (originalMessage.payload?.parts) {
    // Handle multipart messages
    const textPart = originalMessage.payload.parts.find((p: any) => 
      p.mimeType === 'text/plain' || p.mimeType === 'text/html'
    );
    if (textPart?.body?.data) {
      originalBody = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  }
  
  // Build forward message
  const forwardBody = additionalMessage 
    ? `${additionalMessage}\n\n--- Forwarded message ---\n${originalBody}`
    : `--- Forwarded message ---\n${originalBody}`;
  
  const emailLines = [
    `To: ${to.join(', ')}`,
    `Subject: ${forwardSubject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    forwardBody
  ];
  
  const emailMessage = emailLines.join('\r\n');
  const encodedMessage = btoa(emailMessage)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  return await response.json();
}