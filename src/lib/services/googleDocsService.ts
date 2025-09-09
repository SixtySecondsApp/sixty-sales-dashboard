import { google, docs_v1, drive_v3 } from 'googleapis';
import { googleOAuthService } from './googleOAuthService';
import { supabase } from '../supabase/clientV2';

interface DocumentTemplate {
  title: string;
  content: Array<{
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'image';
    text?: string;
    level?: number; // For headings
    items?: string[]; // For lists
    rows?: string[][]; // For tables
    imageUrl?: string; // For images
    style?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      fontSize?: number;
      color?: string;
      alignment?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    };
  }>;
  variables?: Record<string, string>; // For template variable replacement
}

class GoogleDocsService {
  /**
   * Create a new Google Doc with formatted content
   */
  async createDocument(
    userId: string,
    template: DocumentTemplate,
    folderId?: string
  ): Promise<{ documentId: string; documentUrl: string }> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    
    if (!integration) {
      throw new Error('No Google integration found');
    }

    const docs = google.docs({ version: 'v1', auth: authClient });
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      // Create the document
      const createResponse = await docs.documents.create({
        requestBody: {
          title: this.replaceVariables(template.title, template.variables)
        }
      });

      const documentId = createResponse.data.documentId!;

      // Build requests for document content
      const requests = this.buildDocumentRequests(template);

      // Apply the content to the document
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests
          }
        });
      }

      // Move to folder if specified
      if (folderId) {
        await drive.files.update({
          fileId: documentId,
          addParents: folderId,
          fields: 'id, parents'
        });
      }

      // Log the activity
      await googleOAuthService.logActivity(
        integration.id,
        'docs',
        'create_document',
        'success',
        { title: template.title, folderId },
        { documentId }
      );

      return {
        documentId,
        documentUrl: `https://docs.google.com/document/d/${documentId}/edit`
      };
    } catch (error) {
      console.error('Error creating document:', error);
      
      await googleOAuthService.logActivity(
        integration.id,
        'docs',
        'create_document',
        'error',
        { title: template.title, folderId },
        null,
        error.message
      );

      throw new Error('Failed to create Google Doc');
    }
  }

  /**
   * Build document update requests from template
   */
  private buildDocumentRequests(template: DocumentTemplate): docs_v1.Schema$Request[] {
    const requests: docs_v1.Schema$Request[] = [];
    let currentIndex = 1; // Start after the title

    for (const element of template.content) {
      const text = this.replaceVariables(element.text || '', template.variables);

      switch (element.type) {
        case 'heading':
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: text + '\n'
            }
          });
          
          const headingLength = text.length;
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + headingLength
              },
              paragraphStyle: {
                namedStyleType: this.getHeadingStyle(element.level || 1)
              },
              fields: 'namedStyleType'
            }
          });
          
          currentIndex += headingLength + 1;
          break;

        case 'paragraph':
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: text + '\n\n'
            }
          });

          if (element.style) {
            const textLength = text.length;
            requests.push(...this.buildStyleRequests(
              currentIndex,
              currentIndex + textLength,
              element.style
            ));
          }

          currentIndex += text.length + 2;
          break;

        case 'list':
          if (element.items) {
            for (const item of element.items) {
              const itemText = this.replaceVariables(item, template.variables);
              requests.push({
                insertText: {
                  location: { index: currentIndex },
                  text: '• ' + itemText + '\n'
                }
              });
              currentIndex += itemText.length + 3;
            }
            requests.push({
              insertText: {
                location: { index: currentIndex },
                text: '\n'
              }
            });
            currentIndex += 1;
          }
          break;

        case 'table':
          if (element.rows) {
            // Insert table
            const rows = element.rows.length;
            const columns = element.rows[0]?.length || 0;
            
            if (rows > 0 && columns > 0) {
              requests.push({
                insertTable: {
                  location: { index: currentIndex },
                  rows,
                  columns
                }
              });
              
              // Table insertion adds characters, estimate the new index
              currentIndex += (rows * columns * 2) + 2;
            }
          }
          break;

        case 'image':
          if (element.imageUrl) {
            requests.push({
              insertInlineImage: {
                location: { index: currentIndex },
                uri: element.imageUrl,
                objectSize: {
                  height: { magnitude: 200, unit: 'PT' },
                  width: { magnitude: 200, unit: 'PT' }
                }
              }
            });
            currentIndex += 1;
          }
          break;
      }
    }

    return requests;
  }

  /**
   * Build text style requests
   */
  private buildStyleRequests(
    startIndex: number,
    endIndex: number,
    style: any
  ): docs_v1.Schema$Request[] {
    const requests: docs_v1.Schema$Request[] = [];

    if (style.bold || style.italic || style.underline || style.fontSize || style.color) {
      const textStyle: docs_v1.Schema$TextStyle = {};
      
      if (style.bold) textStyle.bold = true;
      if (style.italic) textStyle.italic = true;
      if (style.underline) textStyle.underline = true;
      
      if (style.fontSize) {
        textStyle.fontSize = {
          magnitude: style.fontSize,
          unit: 'PT'
        };
      }
      
      if (style.color) {
        // Convert hex color to RGB
        const rgb = this.hexToRgb(style.color);
        if (rgb) {
          textStyle.foregroundColor = {
            color: {
              rgbColor: {
                red: rgb.r / 255,
                green: rgb.g / 255,
                blue: rgb.b / 255
              }
            }
          };
        }
      }

      requests.push({
        updateTextStyle: {
          range: { startIndex, endIndex },
          textStyle,
          fields: Object.keys(textStyle).join(',')
        }
      });
    }

    if (style.alignment) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle: {
            alignment: style.alignment
          },
          fields: 'alignment'
        }
      });
    }

    return requests;
  }

  /**
   * Get Google Doc by ID
   */
  async getDocument(userId: string, documentId: string) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const docs = google.docs({ version: 'v1', auth: authClient });

    try {
      const response = await docs.documents.get({ documentId });
      return response.data;
    } catch (error) {
      console.error('Error fetching document:', error);
      throw new Error('Failed to fetch Google Doc');
    }
  }

  /**
   * Update existing Google Doc
   */
  async updateDocument(
    userId: string,
    documentId: string,
    requests: docs_v1.Schema$Request[]
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    const docs = google.docs({ version: 'v1', auth: authClient });

    try {
      const response = await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });

      await googleOAuthService.logActivity(
        integration!.id,
        'docs',
        'update_document',
        'success',
        { documentId, requestCount: requests.length },
        { replies: response.data.replies }
      );

      return response.data;
    } catch (error) {
      console.error('Error updating document:', error);
      
      await googleOAuthService.logActivity(
        integration!.id,
        'docs',
        'update_document',
        'error',
        { documentId },
        null,
        error.message
      );

      throw new Error('Failed to update Google Doc');
    }
  }

  /**
   * Export document as PDF
   */
  async exportAsPdf(userId: string, documentId: string): Promise<Buffer> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const response = await drive.files.export({
        fileId: documentId,
        mimeType: 'application/pdf'
      }, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      console.error('Error exporting document as PDF:', error);
      throw new Error('Failed to export document as PDF');
    }
  }

  /**
   * Save document template to database
   */
  async saveTemplate(
    userId: string,
    name: string,
    description: string,
    templateType: string,
    templateContent: any,
    isGlobal: boolean = false
  ) {
    const { data, error } = await supabase
      .from('google_docs_templates')
      .insert({
        user_id: isGlobal ? null : userId,
        name,
        description,
        template_type: templateType,
        template_content: templateContent,
        is_global: isGlobal,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving template:', error);
      throw new Error('Failed to save document template');
    }

    return data;
  }

  /**
   * Get document templates
   */
  async getTemplates(userId: string, templateType?: string) {
    let query = supabase
      .from('google_docs_templates')
      .select('*')
      .or(`user_id.eq.${userId},is_global.eq.true`);

    if (templateType) {
      query = query.eq('template_type', templateType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Helper: Replace variables in text
   */
  private replaceVariables(text: string, variables?: Record<string, string>): string {
    if (!variables) return text;

    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  /**
   * Helper: Get heading style name
   */
  private getHeadingStyle(level: number): docs_v1.Schema$ParagraphStyle['namedStyleType'] {
    switch (level) {
      case 1: return 'HEADING_1';
      case 2: return 'HEADING_2';
      case 3: return 'HEADING_3';
      case 4: return 'HEADING_4';
      case 5: return 'HEADING_5';
      case 6: return 'HEADING_6';
      default: return 'HEADING_1';
    }
  }

  /**
   * Helper: Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
}

export const googleDocsService = new GoogleDocsService();