import { google, drive_v3 } from 'googleapis';
import { googleOAuthService } from './googleOAuthService';
import { supabase } from '../supabase/clientV2';
import { Readable } from 'stream';

interface FileMetadata {
  name: string;
  mimeType?: string;
  parents?: string[];
  description?: string;
  properties?: Record<string, string>;
  appProperties?: Record<string, string>;
  starred?: boolean;
}

interface FolderStructure {
  id: string;
  name: string;
  mimeType: string;
  children?: FolderStructure[];
}

interface SearchFilter {
  query?: string;
  mimeType?: string;
  folderId?: string;
  trashed?: boolean;
  starred?: boolean;
  orderBy?: string;
  pageSize?: number;
  pageToken?: string;
}

class GoogleDriveService {
  /**
   * Create a folder in Google Drive
   */
  async createFolder(
    userId: string,
    name: string,
    parentFolderId?: string
  ): Promise<string> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    
    if (!integration) {
      throw new Error('No Google integration found');
    }

    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const fileMetadata: drive_v3.Schema$File = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name, webViewLink'
      });

      // Cache folder in database
      await supabase
        .from('google_drive_folders')
        .insert({
          integration_id: integration.id,
          folder_id: response.data.id!,
          name,
          parent_id: parentFolderId,
          web_view_link: response.data.webViewLink,
          created_at: new Date().toISOString()
        });

      // Log the activity
      await googleOAuthService.logActivity(
        integration.id,
        'drive',
        'create_folder',
        'success',
        { name, parentFolderId },
        { folderId: response.data.id }
      );

      return response.data.id!;
    } catch (error) {
      console.error('Error creating folder:', error);
      
      await googleOAuthService.logActivity(
        integration.id,
        'drive',
        'create_folder',
        'error',
        { name, parentFolderId },
        null,
        error.message
      );

      throw new Error('Failed to create folder');
    }
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    userId: string,
    fileMetadata: FileMetadata,
    fileContent: Buffer | string | Readable,
    convertToGoogleFormat?: boolean
  ): Promise<{ id: string; webViewLink: string }> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    
    if (!integration) {
      throw new Error('No Google integration found');
    }

    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      // Determine Google format mime type if conversion requested
      let targetMimeType = fileMetadata.mimeType;
      if (convertToGoogleFormat) {
        targetMimeType = this.getGoogleMimeType(fileMetadata.mimeType || '');
      }

      const media = {
        mimeType: fileMetadata.mimeType || 'application/octet-stream',
        body: typeof fileContent === 'string' 
          ? Readable.from(fileContent)
          : fileContent instanceof Buffer
          ? Readable.from(fileContent)
          : fileContent
      };

      const response = await drive.files.create({
        requestBody: {
          ...fileMetadata,
          mimeType: targetMimeType
        },
        media,
        fields: 'id, name, webViewLink, mimeType'
      });

      // Log the activity
      await googleOAuthService.logActivity(
        integration.id,
        'drive',
        'upload_file',
        'success',
        { name: fileMetadata.name, parents: fileMetadata.parents },
        { fileId: response.data.id }
      );

      return {
        id: response.data.id!,
        webViewLink: response.data.webViewLink!
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      
      await googleOAuthService.logActivity(
        integration.id,
        'drive',
        'upload_file',
        'error',
        { name: fileMetadata.name },
        null,
        error.message
      );

      throw new Error('Failed to upload file');
    }
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(userId: string, fileId: string): Promise<Buffer> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const response = await drive.files.get({
        fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('Failed to download file');
    }
  }

  /**
   * List files in Google Drive
   */
  async listFiles(userId: string, filter: SearchFilter = {}) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      // Build query
      const queryParts: string[] = [];
      
      if (filter.query) {
        queryParts.push(filter.query);
      }
      
      if (filter.mimeType) {
        queryParts.push(`mimeType='${filter.mimeType}'`);
      }
      
      if (filter.folderId) {
        queryParts.push(`'${filter.folderId}' in parents`);
      }
      
      if (filter.trashed !== undefined) {
        queryParts.push(`trashed=${filter.trashed}`);
      }
      
      if (filter.starred !== undefined) {
        queryParts.push(`starred=${filter.starred}`);
      }

      const response = await drive.files.list({
        q: queryParts.join(' and '),
        orderBy: filter.orderBy,
        pageSize: filter.pageSize || 100,
        pageToken: filter.pageToken,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents, webViewLink, thumbnailLink, iconLink)'
      });

      return {
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error('Failed to list files');
    }
  }

  /**
   * Move a file to a different folder
   */
  async moveFile(
    userId: string,
    fileId: string,
    newParentId: string,
    oldParentId?: string
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      // If old parent not specified, get current parents
      if (!oldParentId) {
        const file = await drive.files.get({
          fileId,
          fields: 'parents'
        });
        oldParentId = file.data.parents?.[0];
      }

      const response = await drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: oldParentId,
        fields: 'id, name, parents'
      });

      return response.data;
    } catch (error) {
      console.error('Error moving file:', error);
      throw new Error('Failed to move file');
    }
  }

  /**
   * Copy a file
   */
  async copyFile(
    userId: string,
    fileId: string,
    newName?: string,
    parentFolderId?: string
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const requestBody: drive_v3.Schema$File = {};
      
      if (newName) {
        requestBody.name = newName;
      }
      
      if (parentFolderId) {
        requestBody.parents = [parentFolderId];
      }

      const response = await drive.files.copy({
        fileId,
        requestBody,
        fields: 'id, name, webViewLink'
      });

      return response.data;
    } catch (error) {
      console.error('Error copying file:', error);
      throw new Error('Failed to copy file');
    }
  }

  /**
   * Delete a file or folder
   */
  async deleteFile(userId: string, fileId: string) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      await drive.files.delete({ fileId });

      await googleOAuthService.logActivity(
        integration!.id,
        'drive',
        'delete_file',
        'success',
        { fileId },
        null
      );
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Share a file with specific users
   */
  async shareFile(
    userId: string,
    fileId: string,
    email: string,
    role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader',
    sendNotificationEmail: boolean = true
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const response = await drive.permissions.create({
        fileId,
        requestBody: {
          type: 'user',
          role,
          emailAddress: email
        },
        sendNotificationEmail,
        fields: 'id, role, emailAddress'
      });

      return response.data;
    } catch (error) {
      console.error('Error sharing file:', error);
      throw new Error('Failed to share file');
    }
  }

  /**
   * Create a public sharing link
   */
  async createPublicLink(
    userId: string,
    fileId: string,
    role: 'writer' | 'commenter' | 'reader' = 'reader'
  ): Promise<string> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      await drive.permissions.create({
        fileId,
        requestBody: {
          type: 'anyone',
          role
        }
      });

      const file = await drive.files.get({
        fileId,
        fields: 'webViewLink'
      });

      return file.data.webViewLink!;
    } catch (error) {
      console.error('Error creating public link:', error);
      throw new Error('Failed to create public link');
    }
  }

  /**
   * Get folder structure recursively
   */
  async getFolderStructure(
    userId: string,
    folderId: string = 'root'
  ): Promise<FolderStructure> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    const getFolderRecursive = async (id: string): Promise<FolderStructure> => {
      // Get folder details
      const folder = id === 'root' 
        ? { data: { id: 'root', name: 'My Drive', mimeType: 'application/vnd.google-apps.folder' } }
        : await drive.files.get({ fileId: id, fields: 'id, name, mimeType' });

      // Get children
      const children = await drive.files.list({
        q: `'${id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, mimeType)'
      });

      const structure: FolderStructure = {
        id: folder.data.id!,
        name: folder.data.name!,
        mimeType: folder.data.mimeType!
      };

      // Recursively get subfolders
      if (children.data.files && children.data.files.length > 0) {
        structure.children = await Promise.all(
          children.data.files.map(child => getFolderRecursive(child.id!))
        );
      }

      return structure;
    };

    try {
      return await getFolderRecursive(folderId);
    } catch (error) {
      console.error('Error getting folder structure:', error);
      throw new Error('Failed to get folder structure');
    }
  }

  /**
   * Search files by name
   */
  async searchFilesByName(userId: string, searchTerm: string, inFolder?: string) {
    const query = `name contains '${searchTerm}' and trashed=false`;
    const fullQuery = inFolder 
      ? `${query} and '${inFolder}' in parents`
      : query;

    return this.listFiles(userId, { query: fullQuery });
  }

  /**
   * Get cached folders from database
   */
  async getCachedFolders(userId: string) {
    const integration = await googleOAuthService.getTokens(userId);
    
    if (!integration) {
      return [];
    }

    const { data, error } = await supabase
      .from('google_drive_folders')
      .select('*')
      .eq('integration_id', integration.id)
      .order('name');

    if (error) {
      console.error('Error fetching cached folders:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Helper: Convert to Google Docs format mime types
   */
  private getGoogleMimeType(originalMimeType: string): string {
    const conversions: Record<string, string> = {
      'application/msword': 'application/vnd.google-apps.document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.google-apps.document',
      'application/vnd.ms-excel': 'application/vnd.google-apps.spreadsheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.google-apps.spreadsheet',
      'application/vnd.ms-powerpoint': 'application/vnd.google-apps.presentation',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/vnd.google-apps.presentation',
      'text/plain': 'application/vnd.google-apps.document',
      'text/csv': 'application/vnd.google-apps.spreadsheet'
    };

    return conversions[originalMimeType] || originalMimeType;
  }
}

export const googleDriveService = new GoogleDriveService();