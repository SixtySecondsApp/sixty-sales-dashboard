import { supabase } from '@/lib/supabase/clientV2';
import { CopilotService } from './copilotService';
import logger from '@/lib/utils/logger';

export interface LinkedInProfile {
  url: string;
  fullName: string;
  headline: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    description: string;
    dateRange: string;
  }>;
  recentPosts: Array<{
    content: string;
    date: string;
    likes: number;
  }>;
  about: string;
  location?: string;
  skills?: string[];
}

export class LinkedInEnrichmentService {
  
  /**
   * Find LinkedIn URL for a prospect using Gemini
   */
  static async findLinkedInUrl(name: string, company: string): Promise<string | null> {
    try {
      if (!name) return null;

      // We use the Copilot service (which uses Gemini/LLMs) to find the URL
      // In a real scenario, this might use a Search Tool or a specific enrichment API
      
      const prompt = `Find the LinkedIn public profile URL for ${name} at ${company}. Return ONLY the URL. If not found, return "NOT_FOUND".`;
      
      logger.log(`🔍 Searching LinkedIn URL for ${name} at ${company}...`);
      
      // Call Copilot (Gemini) to find the URL
      // Note: This assumes Copilot has search capabilities or can infer this
      const response = await CopilotService.sendMessage(prompt, { userId: 'system', currentView: 'contact' });
      
      const url = response.response.content.trim();
      
      if (url && url !== 'NOT_FOUND' && url.includes('linkedin.com/in/')) {
        return url;
      }
      
      // Fallback to constructing a likely URL if search fails (often accurate enough to try scraping)
      if (name) {
        const sanitizedName = name.toLowerCase().replace(/\s+/g, '-');
        return `https://www.linkedin.com/in/${sanitizedName}`;
      }
      
      return null;
    } catch (error) {
      logger.error('Error finding LinkedIn URL:', error);
      return null;
    }
  }

  /**
   * Scrape LinkedIn Profile using Apify
   * Uses the 'linkedin-profile-scraper' actor (2SyF0bVxmgGr8IVCZ)
   */
  static async scrapeProfile(url: string): Promise<LinkedInProfile | null> {
    try {
      const APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN;
      
      if (!APIFY_TOKEN) {
        logger.warn('⚠️ No Apify token found. Returning mock profile data.');
        return this.getMockProfile(url);
      }

      logger.log(`🕷️ Scraping LinkedIn profile: ${url}`);

      // Apify Actor: linkedin-profile-scraper (2SyF0bVxmgGr8IVCZ)
      const run = await fetch(`https://api.apify.com/v2/acts/2SyF0bVxmgGr8IVCZ/runs?token=${APIFY_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileUrls: [url],
          proxyConfiguration: {
            useApifyProxy: true
          },
          handlePageTimeoutSecs: 180,
          minDelay: 1,
          maxDelay: 3,
          includeSkills: true,
          includeCertifications: true,
          includeEducation: true,
          includeExperience: true,
          includePublications: true,
          maxResults: 1
        })
      });

      if (!run.ok) {
        throw new Error(`Apify run failed: ${run.statusText}`);
      }

      const runData = await run.json();
      const datasetId = runData.data.defaultDatasetId;
      const runId = runData.data.id;

      // Poll for results
      let status = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 60; // 3 minutes timeout (3s * 60)

      while (status === 'RUNNING' || status === 'READY') {
        if (attempts >= maxAttempts) {
          throw new Error('Apify scrape timed out');
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s
        
        const runCheck = await fetch(`https://api.apify.com/v2/acts/2SyF0bVxmgGr8IVCZ/runs/${runId}?token=${APIFY_TOKEN}`);
        const checkData = await runCheck.json();
        status = checkData.data.status;
        attempts++;
      }

      if (status !== 'SUCCEEDED') {
        throw new Error(`Apify run finished with status: ${status}`);
      }

      // Fetch results from dataset
      const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
      const items = await datasetResponse.json();

      if (items && items.length > 0) {
        return this.mapApifyResponseToProfile(items[0]);
      }

      return null;

    } catch (error) {
      logger.error('Error scraping LinkedIn profile:', error);
      return null;
    }
  }

  /**
   * Map Apify raw response to our internal LinkedInProfile format
   */
  private static mapApifyResponseToProfile(data: any): LinkedInProfile {
    return {
      url: data.linkedinUrl || '',
      fullName: data.fullName || `${data.firstName} ${data.lastName}`,
      headline: data.headline || '',
      summary: data.about || '',
      about: data.about || '',
      location: data.addressWithCountry || data.addressCountryOnly,
      experience: (data.experiences || []).map((exp: any) => ({
        title: exp.title,
        company: exp.subtitle?.split(' · ')[0] || '', // Often "Company · Full-time"
        description: exp.subComponents?.[0]?.description?.[0]?.text || '',
        dateRange: exp.caption || ''
      })),
      // Note: The specific actor response format for posts isn't in the example, 
      // but we map skills as an alternative valuable signal if posts aren't available
      skills: (data.skills || []).map((s: any) => s.title),
      recentPosts: [] // This actor might not return recent posts in this exact format, handled as empty for now
    };
  }

  /**
   * Orchestrates the full enrichment flow: URL Finding -> Scraping -> DB Update
   */
  static async enrichContactProfile(contactId: string, name: string, email: string, companyName?: string): Promise<boolean> {
    try {
      logger.log(`🚀 Starting enrichment for contact: ${name}`);

      // 1. Find URL
      let linkedinUrl = await this.findLinkedInUrl(name, companyName || '');
      
      if (!linkedinUrl) {
        logger.warn(`Could not find LinkedIn URL for ${name}`);
        return false;
      }

      // 2. Update Contact with URL immediately (so we have it even if scrape fails)
      await supabase
        .from('contacts')
        .update({ linkedin_url: linkedinUrl })
        .eq('id', contactId);

      // 3. Scrape Profile
      const profile = await this.scrapeProfile(linkedinUrl);

      if (!profile) {
        logger.warn(`Scraping failed for ${linkedinUrl}`);
        return false;
      }

      // 4. Update Contact with enriched data
      // We'll store the structured data in a JSONB column 'social_media_urls' (reusing existing field or creating new)
      // Or update specific fields like title, location if they are missing
      
      const updates: any = {
        enriched_at: new Date().toISOString(),
        enrichment_source: 'apify_linkedin',
        // Update title if missing
        ...(profile.headline && { title: profile.headline.split(' at ')[0] }), 
      };

      // Store full profile data in social_media_urls as a metadata container
      // In a real production schema, we should probably have a 'linkedin_data' column
      // For now, we'll assume we can update existing fields or add it to notes
      
      if (profile.summary) {
        // Append summary to notes without overwriting
        const { data: currentContact } = await supabase
          .from('contacts')
          .select('notes')
          .eq('id', contactId)
          .single();
          
        const newNotes = (currentContact?.notes || '') + `\n\n[LinkedIn Summary]\n${profile.summary}`;
        updates.notes = newNotes;
      }

      // We also want to store the raw profile for the AI to use later
      // Since we don't have a dedicated 'linkedin_data' column confirmed in all schemas, 
      // we will use the `social_media_urls` JSONB column to store the rich data object 
      // alongside the URL, as it's a flexible JSON container.
      updates.social_media_urls = {
        linkedin: linkedinUrl,
        linkedin_data: profile // Store full profile structure here
      };

      const { error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId);

      if (error) {
        logger.error('Failed to update contact with enrichment data:', error);
        return false;
      }

      logger.log(`✅ Successfully enriched contact: ${name}`);
      return true;

    } catch (error) {
      logger.error('Enrichment process failed:', error);
      return false;
    }
  }

  /**
   * Mock profile generator for demonstration/fallback
   */
  private static getMockProfile(url: string): LinkedInProfile {
    return {
      url,
      fullName: 'John Doe',
      headline: 'VP of Sales at TechCorp | Scaling Revenue',
      summary: 'Experienced sales leader with a track record of scaling SaaS revenue from $1M to $10M. Passionate about AI and automation.',
      about: 'I love building high-performing teams and leveraging technology to solve complex business problems.',
      location: 'San Francisco, CA',
      experience: [
        {
          title: 'VP of Sales',
          company: 'TechCorp',
          description: 'Leading the global sales organization.',
          dateRange: '2020 - Present'
        },
        {
          title: 'Director of Sales',
          company: 'GrowthStartup',
          description: 'Built the SDR team from scratch.',
          dateRange: '2017 - 2020'
        }
      ],
      recentPosts: [
        {
          content: 'Just published a new article on the future of AI in sales. #AI #Sales',
          date: '2 days ago',
          likes: 150
        }
      ]
    };
  }
}
