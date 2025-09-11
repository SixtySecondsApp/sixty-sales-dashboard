/**
 * Natural Language Processing Utilities
 * Text processing, analysis, and extraction utilities for AI features
 */

export interface TextAnalysis {
  wordCount: number;
  sentenceCount: number;
  averageWordsPerSentence: number;
  readabilityScore: number;
  language: string;
  complexity: 'simple' | 'medium' | 'complex';
}

export interface NamedEntity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'time' | 'email' | 'phone' | 'url';
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface KeyPhrase {
  phrase: string;
  relevance: number;
  frequency: number;
  category?: string;
}

export interface TextSimilarity {
  similarity: number;
  matchingTokens: string[];
  commonPhrases: string[];
}

export interface TextSummarization {
  summary: string;
  keyPoints: string[];
  confidence: number;
  compressionRatio: number;
}

export interface Intent {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  context: Record<string, any>;
}

class NLPUtils {
  // Common stop words for text processing
  private readonly stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
    'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was',
    'will', 'with', 'would', 'you', 'your', 'i', 'me', 'my', 'we', 'us',
    'our', 'they', 'them', 'their', 'this', 'these', 'those', 'but', 'or',
    'if', 'can', 'could', 'should', 'would', 'may', 'might', 'must', 'shall',
  ]);

  // Email-specific patterns
  private readonly emailPatterns = {
    greeting: /^(hi|hello|hey|dear|good\s+(?:morning|afternoon|evening))/i,
    closing: /(best\s+regards|sincerely|thanks|thank\s+you|cheers|regards|talk\s+soon)$/i,
    question: /\?/g,
    urgency: /\b(urgent|asap|immediately|emergency|critical|deadline)\b/gi,
    meeting: /\b(meeting|call|sync|standup|catchup|conference|webinar)\b/gi,
    followUp: /\b(follow\s*up|follow-up|following\s+up|circle\s+back)\b/gi,
  };

  // Business intent patterns
  private readonly intentPatterns = {
    scheduling: {
      pattern: /\b(schedule|meeting|call|appointment|book|calendar|available|free|time)\b/gi,
      keywords: ['schedule', 'meeting', 'call', 'appointment', 'calendar', 'time'],
    },
    information: {
      pattern: /\b(information|details|data|report|update|status|progress)\b/gi,
      keywords: ['information', 'details', 'data', 'report', 'update'],
    },
    request: {
      pattern: /\b(please|can you|could you|would you|need|require|request)\b/gi,
      keywords: ['please', 'need', 'require', 'request'],
    },
    complaint: {
      pattern: /\b(problem|issue|error|bug|complaint|dissatisfied|unhappy)\b/gi,
      keywords: ['problem', 'issue', 'error', 'complaint'],
    },
    praise: {
      pattern: /\b(great|excellent|amazing|wonderful|fantastic|thank|appreciate)\b/gi,
      keywords: ['great', 'excellent', 'amazing', 'thank', 'appreciate'],
    },
  };

  // Time and date patterns
  private readonly timePatterns = {
    time: /\b(?:\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/gi,
    date: /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}|\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?)\b/gi,
    relativeDate: /\b(?:today|tomorrow|yesterday|next\s+\w+|last\s+\w+|this\s+\w+)\b/gi,
    duration: /\b(?:\d+\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?))\b/gi,
  };

  /**
   * Analyze text structure and complexity
   */
  analyzeText(text: string): TextAnalysis {
    const sentences = this.splitIntoSentences(text);
    const words = this.tokenizeWords(text);
    const nonStopWords = words.filter(word => !this.stopWords.has(word.toLowerCase()));
    
    const wordCount = words.length;
    const sentenceCount = sentences.length;
    const averageWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    
    // Simple readability score based on average sentence length and word complexity
    const complexWords = nonStopWords.filter(word => word.length > 6).length;
    const complexityRatio = wordCount > 0 ? complexWords / wordCount : 0;
    const readabilityScore = Math.max(0, 100 - (averageWordsPerSentence * 2) - (complexityRatio * 50));
    
    let complexity: TextAnalysis['complexity'] = 'simple';
    if (averageWordsPerSentence > 20 || complexityRatio > 0.3) {
      complexity = 'complex';
    } else if (averageWordsPerSentence > 15 || complexityRatio > 0.2) {
      complexity = 'medium';
    }

    return {
      wordCount,
      sentenceCount,
      averageWordsPerSentence,
      readabilityScore,
      language: this.detectLanguage(text),
      complexity,
    };
  }

  /**
   * Extract named entities from text
   */
  extractNamedEntities(text: string): NamedEntity[] {
    const entities: NamedEntity[] = [];
    
    // Extract emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailRegex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'email',
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
    
    // Extract phone numbers
    const phoneRegex = /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;
    while ((match = phoneRegex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'phone',
        confidence: 0.9,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
    
    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    while ((match = urlRegex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'url',
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
    
    // Extract dates
    for (const [patternKey, pattern] of Object.entries(this.timePatterns)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: patternKey === 'time' ? 'time' : 'date',
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }
    
    // Extract person names (simple heuristic)
    const namePattern = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
    while ((match = namePattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'person',
        confidence: 0.7,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
    
    // Extract organizations (simple heuristic)
    const orgKeywords = ['Inc', 'Corp', 'LLC', 'Ltd', 'Company', 'Co', 'Organization'];
    const orgPattern = new RegExp(`\\b[A-Z][\\w\\s]+(?:${orgKeywords.join('|')})\\b`, 'g');
    while ((match = orgPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'organization',
        confidence: 0.75,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return entities.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Extract key phrases from text
   */
  extractKeyPhrases(text: string, maxPhrases: number = 10): KeyPhrase[] {
    const sentences = this.splitIntoSentences(text);
    const words = this.tokenizeWords(text.toLowerCase());
    const nonStopWords = words.filter(word => !this.stopWords.has(word));
    
    // Calculate word frequency
    const wordFreq: Record<string, number> = {};
    nonStopWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // Extract n-grams (1-3 words)
    const phrases: Record<string, { frequency: number; sentences: Set<number> }> = {};
    
    // Unigrams
    nonStopWords.forEach(word => {
      if (word.length > 3) {
        phrases[word] = phrases[word] || { frequency: 0, sentences: new Set() };
        phrases[word].frequency += 1;
      }
    });
    
    // Bigrams and trigrams
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= nonStopWords.length - n; i++) {
        const phrase = nonStopWords.slice(i, i + n).join(' ');
        if (phrase.length > 5) {
          phrases[phrase] = phrases[phrase] || { frequency: 0, sentences: new Set() };
          phrases[phrase].frequency += 1;
        }
      }
    }
    
    // Calculate relevance score
    const maxFreq = Math.max(...Object.values(phrases).map(p => p.frequency));
    
    const keyPhrases = Object.entries(phrases)
      .map(([phrase, data]) => ({
        phrase,
        frequency: data.frequency,
        relevance: data.frequency / maxFreq,
        category: this.categorizePhrase(phrase),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxPhrases);

    return keyPhrases;
  }

  /**
   * Calculate text similarity between two texts
   */
  calculateSimilarity(text1: string, text2: string): TextSimilarity {
    const tokens1 = new Set(this.tokenizeWords(text1.toLowerCase()));
    const tokens2 = new Set(this.tokenizeWords(text2.toLowerCase()));
    
    const intersection = new Set([...tokens1].filter(token => tokens2.has(token)));
    const union = new Set([...tokens1, ...tokens2]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Find common phrases
    const phrases1 = this.extractKeyPhrases(text1, 20).map(p => p.phrase);
    const phrases2 = this.extractKeyPhrases(text2, 20).map(p => p.phrase);
    const commonPhrases = phrases1.filter(phrase => phrases2.includes(phrase));

    return {
      similarity: jaccardSimilarity,
      matchingTokens: Array.from(intersection),
      commonPhrases,
    };
  }

  /**
   * Summarize text using extractive summarization
   */
  summarizeText(text: string, maxSentences: number = 3): TextSummarization {
    const sentences = this.splitIntoSentences(text);
    
    if (sentences.length <= maxSentences) {
      return {
        summary: text,
        keyPoints: sentences,
        confidence: 1,
        compressionRatio: 1,
      };
    }
    
    // Score sentences based on various factors
    const scoredSentences = sentences.map((sentence, index) => {
      let score = 0;
      
      // Position scoring (earlier sentences are more important)
      score += (sentences.length - index) / sentences.length * 0.3;
      
      // Length scoring (moderate length sentences are preferred)
      const words = this.tokenizeWords(sentence);
      const idealLength = 15;
      const lengthScore = 1 - Math.abs(words.length - idealLength) / idealLength;
      score += lengthScore * 0.2;
      
      // Keyword scoring
      const keyPhrases = this.extractKeyPhrases(text, 10);
      const keywordCount = keyPhrases.filter(phrase => 
        sentence.toLowerCase().includes(phrase.phrase)
      ).length;
      score += (keywordCount / Math.max(keyPhrases.length, 1)) * 0.5;
      
      return { sentence, score, index };
    });
    
    // Select top sentences
    const selectedSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .sort((a, b) => a.index - b.index)
      .map(item => item.sentence);
    
    const summary = selectedSentences.join(' ');
    const compressionRatio = summary.length / text.length;
    
    return {
      summary,
      keyPoints: selectedSentences,
      confidence: Math.min(0.9, selectedSentences.length / maxSentences),
      compressionRatio,
    };
  }

  /**
   * Classify text intent for business communications
   */
  classifyIntent(text: string): Intent {
    const lowerText = text.toLowerCase();
    const intentScores: Record<string, number> = {};
    
    // Score each intent pattern
    for (const [intentName, intentData] of Object.entries(this.intentPatterns)) {
      const matches = lowerText.match(intentData.pattern) || [];
      const keywordMatches = intentData.keywords.filter(keyword => 
        lowerText.includes(keyword)
      ).length;
      
      intentScores[intentName] = (matches.length * 0.6) + (keywordMatches * 0.4);
    }
    
    // Find highest scoring intent
    const topIntent = Object.entries(intentScores)
      .sort(([,a], [,b]) => b - a)[0];
    
    const intent = topIntent ? topIntent[0] : 'general';
    const confidence = topIntent ? Math.min(topIntent[1] / 5, 1) : 0.5;
    
    // Extract entities relevant to the intent
    const entities: Record<string, any> = {};
    const namedEntities = this.extractNamedEntities(text);
    
    // Group entities by type
    namedEntities.forEach(entity => {
      entities[entity.type] = entities[entity.type] || [];
      entities[entity.type].push(entity.text);
    });
    
    // Extract context based on intent
    const context: Record<string, any> = {
      hasQuestions: (text.match(/\?/g) || []).length > 0,
      hasUrgency: this.emailPatterns.urgency.test(text),
      hasMeeting: this.emailPatterns.meeting.test(text),
      isFollowUp: this.emailPatterns.followUp.test(text),
      wordCount: this.tokenizeWords(text).length,
      sentiment: this.detectBasicSentiment(text),
    };

    return {
      intent,
      confidence,
      entities,
      context,
    };
  }

  /**
   * Normalize text for better processing
   */
  normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Clean HTML and formatting from text
   */
  cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract text from email formatting
   */
  extractEmailContent(rawEmail: string): {
    subject: string;
    body: string;
    signature?: string;
    quotedText?: string;
  } {
    const lines = rawEmail.split('\n');
    
    // Extract subject (first line starting with "Subject:" or similar)
    let subject = '';
    const subjectLine = lines.find(line => 
      /^(subject|re|fwd?):\s*/i.test(line.trim())
    );
    if (subjectLine) {
      subject = subjectLine.replace(/^(subject|re|fwd?):\s*/i, '').trim();
    }
    
    // Find quoted text (lines starting with >)
    const quotedLines = lines.filter(line => line.trim().startsWith('>'));
    const quotedText = quotedLines.length > 0 ? quotedLines.join('\n') : undefined;
    
    // Extract main body (excluding quoted text)
    const bodyLines = lines.filter(line => 
      !line.trim().startsWith('>') && 
      !line.trim().startsWith('From:') &&
      !line.trim().startsWith('To:') &&
      !line.trim().startsWith('Date:') &&
      !line.trim().startsWith('Subject:')
    );
    
    // Try to separate signature (common patterns)
    const signatureIndicators = ['--', 'best regards', 'sincerely', 'thanks,'];
    let signatureStartIndex = -1;
    
    for (let i = bodyLines.length - 1; i >= 0; i--) {
      const line = bodyLines[i].toLowerCase().trim();
      if (signatureIndicators.some(indicator => line.includes(indicator))) {
        signatureStartIndex = i;
        break;
      }
    }
    
    let body = bodyLines.join('\n').trim();
    let signature: string | undefined;
    
    if (signatureStartIndex > 0 && signatureStartIndex < bodyLines.length - 1) {
      signature = bodyLines.slice(signatureStartIndex).join('\n').trim();
      body = bodyLines.slice(0, signatureStartIndex).join('\n').trim();
    }
    
    return {
      subject,
      body: this.cleanText(body),
      signature,
      quotedText,
    };
  }

  // Private helper methods

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private tokenizeWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  private detectLanguage(text: string): string {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with'];
    const words = this.tokenizeWords(text.toLowerCase());
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    
    return englishCount / words.length > 0.1 ? 'en' : 'unknown';
  }

  private categorizePhrase(phrase: string): string {
    const lowerPhrase = phrase.toLowerCase();
    
    if (this.emailPatterns.meeting.test(lowerPhrase)) return 'meeting';
    if (this.emailPatterns.urgency.test(lowerPhrase)) return 'urgent';
    if (this.emailPatterns.followUp.test(lowerPhrase)) return 'follow-up';
    if (/\b(project|task|work|job)\b/i.test(lowerPhrase)) return 'work';
    if (/\b(time|date|schedule|calendar)\b/i.test(lowerPhrase)) return 'scheduling';
    
    return 'general';
  }

  private detectBasicSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = [
      'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'perfect',
      'love', 'like', 'enjoy', 'pleased', 'happy', 'excited', 'thank',
      'appreciate', 'congratulations', 'success', 'good', 'best',
    ];
    
    const negativeWords = [
      'terrible', 'awful', 'horrible', 'bad', 'worst', 'hate', 'dislike',
      'angry', 'frustrated', 'disappointed', 'upset', 'problem', 'issue',
      'error', 'mistake', 'fail', 'wrong', 'concern', 'worried', 'sorry',
    ];
    
    const words = this.tokenizeWords(text.toLowerCase());
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    if (positiveCount > negativeCount && positiveCount > 0) return 'positive';
    if (negativeCount > positiveCount && negativeCount > 0) return 'negative';
    return 'neutral';
  }
}

// Utility functions for common NLP tasks

/**
 * Calculate Levenshtein distance between two strings
 */
export function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate fuzzy string similarity (0-1 scale)
 */
export function calculateFuzzyStringSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = calculateLevenshteinDistance(str1, str2);
  return 1 - (distance / maxLength);
}

/**
 * Find fuzzy matches in a list of strings
 */
export function findFuzzyMatches(
  query: string,
  candidates: string[],
  threshold: number = 0.6
): Array<{ text: string; similarity: number }> {
  return candidates
    .map(candidate => ({
      text: candidate,
      similarity: calculateFuzzyStringSimilarity(query.toLowerCase(), candidate.toLowerCase()),
    }))
    .filter(match => match.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Extract and parse dates from natural language
 */
export function parseDateFromNaturalLanguage(text: string): Date | null {
  const now = new Date();
  const lowerText = text.toLowerCase().trim();
  
  // Handle relative dates
  if (lowerText.includes('today')) {
    return now;
  }
  
  if (lowerText.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  if (lowerText.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  
  // Handle "next [day]" patterns
  const nextDayMatch = lowerText.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (nextDayMatch) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(nextDayMatch[1]);
    const currentDay = now.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
    return nextDate;
  }
  
  // Try to parse as a regular date
  try {
    const parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

export const nlpUtils = new NLPUtils();