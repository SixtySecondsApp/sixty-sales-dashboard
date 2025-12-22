/**
 * Task Extraction Integration Service
 * Integrates custom extraction rules into task generation from meeting transcripts
 */

import { ExtractionRulesService, type TaskExtractionRule } from './extractionRulesService';

export interface ExtractedTask {
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadlineDays?: number | null;
  source: 'custom_rule' | 'ai_analysis';
  matchedRuleId?: string;
}

/**
 * Apply custom extraction rules to a transcript
 * Returns tasks that match user-defined rules
 */
export async function applyExtractionRules(
  userId: string,
  transcript: string
): Promise<ExtractedTask[]> {
  try {
    const matchedRules = await ExtractionRulesService.matchExtractionRules(userId, transcript);
    
    if (matchedRules.length === 0) {
      return [];
    }

    const extractedTasks: ExtractedTask[] = [];

    // For each matched rule, extract tasks
    for (const rule of matchedRules) {
      // Find sentences/phrases in transcript that match trigger phrases
      const sentences = transcript.split(/[.!?]\s+/);
      
      for (const sentence of sentences) {
        const lowerSentence = sentence.toLowerCase();
        
        // Check if any trigger phrase appears in this sentence
        const matchingPhrase = rule.trigger_phrases.find(phrase =>
          lowerSentence.includes(phrase.toLowerCase())
        );

        if (matchingPhrase) {
          // Extract task title (use sentence or create from phrase)
          const taskTitle = sentence.trim() || `Follow up on: ${matchingPhrase}`;

          extractedTasks.push({
            title: taskTitle,
            category: rule.task_category,
            priority: rule.default_priority,
            deadlineDays: rule.default_deadline_days,
            source: 'custom_rule',
            matchedRuleId: rule.id,
          });
        }
      }
    }

    // Deduplicate tasks (same title)
    const uniqueTasks = Array.from(
      new Map(extractedTasks.map(task => [task.title.toLowerCase(), task])).values()
    );

    return uniqueTasks;
  } catch (error) {
    console.error('Error applying extraction rules:', error);
    return [];
  }
}

/**
 * Apply meeting type template to extraction
 * Returns enhanced extraction configuration based on meeting type
 */
export async function applyMeetingTypeTemplate(
  userId: string,
  meetingType: string | null
): Promise<Record<string, any> | null> {
  if (!meetingType) return null;

  try {
    const template = await ExtractionRulesService.getMeetingTypeTemplate(userId, meetingType);
    return template?.extraction_template || null;
  } catch (error) {
    console.error('Error applying meeting type template:', error);
    return null;
  }
}

/**
 * Combine AI-extracted tasks with custom rule-extracted tasks
 * Prioritizes custom rules over AI analysis
 */
export function mergeExtractedTasks(
  aiTasks: Array<{ title: string; category?: string; priority?: string }>,
  ruleTasks: ExtractedTask[]
): ExtractedTask[] {
  const merged: ExtractedTask[] = [];
  const seenTitles = new Set<string>();

  // Add custom rule tasks first (higher priority)
  for (const task of ruleTasks) {
    const key = task.title.toLowerCase().trim();
    if (!seenTitles.has(key)) {
      merged.push(task);
      seenTitles.add(key);
    }
  }

  // Add AI tasks that don't conflict
  for (const task of aiTasks) {
    const key = task.title.toLowerCase().trim();
    if (!seenTitles.has(key)) {
      merged.push({
        title: task.title,
        category: task.category || 'general',
        priority: (task.priority as any) || 'medium',
        source: 'ai_analysis',
      });
      seenTitles.add(key);
    }
  }

  return merged;
}



























