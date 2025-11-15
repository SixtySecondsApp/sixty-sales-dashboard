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