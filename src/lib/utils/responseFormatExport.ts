import type { PromptTemplate } from '@/lib/prompts';
import type { PlatformSkill } from '@/lib/services/platformSkillService';

export type ExportedExample =
  | { type: 'json'; content: unknown; raw: string }
  | { type: 'text' | 'markdown' | 'html'; content: string };

export interface PromptResponseFormatExport {
  kind: 'prompt';
  featureKey: string;
  templateId: string;
  name: string;
  description: string;
  responseFormat: PromptTemplate['responseFormat'];
  responseSchema?: string;
  examples: ExportedExample[];
}

export interface SkillResponseFormatExport {
  kind: 'skill';
  category: PlatformSkill['category'];
  skillKey: string;
  name: string;
  description: string;
  responseFormatSection?: string;
  examples: ExportedExample[];
}

interface FencedCodeBlock {
  lang?: string;
  code: string;
}

export function buildPromptResponseFormatExport(template: PromptTemplate): PromptResponseFormatExport {
  const examples = extractExamplesFromPromptTemplate(template);
  return {
    kind: 'prompt',
    featureKey: template.featureKey,
    templateId: template.id,
    name: template.name,
    description: template.description,
    responseFormat: template.responseFormat,
    responseSchema: template.responseSchema,
    examples,
  };
}

export function buildSkillResponseFormatExport(skill: PlatformSkill): SkillResponseFormatExport {
  const content = skill.content_template || '';

  const responseFormatSection =
    extractMarkdownSection(content, ['response format', 'output format', 'format']) || undefined;

  const examplesSection = extractMarkdownSection(content, ['examples', 'example']) || '';
  const examples = extractExamplesFromText(examplesSection || content);

  return {
    kind: 'skill',
    category: skill.category,
    skillKey: skill.skill_key,
    name: skill.frontmatter.name,
    description: skill.frontmatter.description,
    responseFormatSection,
    examples,
  };
}

export async function writeJsonToClipboard(value: unknown) {
  const json = JSON.stringify(value, null, 2);
  await navigator.clipboard.writeText(json);
}

function extractExamplesFromPromptTemplate(template: PromptTemplate): ExportedExample[] {
  const combined = [template.systemPrompt, template.userPrompt].filter(Boolean).join('\n\n');

  // Prefer fenced ```json blocks; fallback to brace-scanned JSON objects.
  const fenced = extractFencedCodeBlocks(combined);
  const jsonFenceBlocks = fenced.filter((b) => (b.lang || '').toLowerCase() === 'json');
  const jsonExamples: ExportedExample[] = jsonFenceBlocks
    .map((b) => tryParseJsonExample(b.code))
    .filter((v): v is ExportedExample => Boolean(v));

  if (jsonExamples.length > 0) return jsonExamples;

  const scanned = extractJsonObjects(combined);
  const scannedExamples: ExportedExample[] = scanned
    .map((raw) => tryParseJsonExample(raw))
    .filter((v): v is ExportedExample => Boolean(v));

  if (scannedExamples.length > 0) return scannedExamples;

  // Non-JSON prompt formats (or no parseable JSON present): return small text excerpts.
  const excerpt = combined.trim().slice(0, 4000);
  if (!excerpt) return [];

  const type = template.responseFormat;
  if (type === 'markdown' || type === 'html' || type === 'text') {
    return [{ type, content: excerpt }];
  }

  // If responseFormat is json but no parseable examples exist, still include a text excerpt.
  return [{ type: 'text', content: excerpt }];
}

function extractExamplesFromText(text: string): ExportedExample[] {
  const fenced = extractFencedCodeBlocks(text);
  if (fenced.length > 0) {
    const out: ExportedExample[] = [];
    for (const b of fenced) {
      const lang = (b.lang || '').toLowerCase();
      if (lang === 'json') {
        const parsed = tryParseJsonExample(b.code);
        if (parsed) out.push(parsed);
      } else if (lang === 'html') {
        out.push({ type: 'html', content: b.code.trim() });
      } else if (lang === 'markdown' || lang === 'md') {
        out.push({ type: 'markdown', content: b.code.trim() });
      } else {
        out.push({ type: 'text', content: b.code.trim() });
      }
    }
    return out;
  }

  const scanned = extractJsonObjects(text);
  const scannedExamples: ExportedExample[] = scanned
    .map((raw) => tryParseJsonExample(raw))
    .filter((v): v is ExportedExample => Boolean(v));
  if (scannedExamples.length > 0) return scannedExamples;

  const trimmed = text.trim();
  return trimmed ? [{ type: 'text', content: trimmed.slice(0, 4000) }] : [];
}

function tryParseJsonExample(raw: string): ExportedExample | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return { type: 'json', content: parsed, raw: cleaned };
  } catch {
    return null;
  }
}

function extractFencedCodeBlocks(text: string): FencedCodeBlock[] {
  const out: FencedCodeBlock[] = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const lang = match[1]?.trim();
    const code = match[2] ?? '';
    if (!code.trim()) continue;
    out.push({ lang, code });
  }
  return out;
}

function extractJsonObjects(text: string): string[] {
  // Finds balanced {...} blocks and keeps only parseable JSON objects.
  const candidates: string[] = [];
  const maxCandidates = 10;
  const maxLen = 25000;

  for (let i = 0; i < text.length && candidates.length < maxCandidates; i += 1) {
    if (text[i] !== '{') continue;
    const slice = text.slice(i, i + maxLen);
    const balanced = findBalancedJsonObject(slice);
    if (!balanced) continue;
    candidates.push(balanced);
    i += balanced.length - 1;
  }

  return candidates;
}

function findBalancedJsonObject(text: string): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (!started) {
      if (ch === '{') {
        started = true;
        depth = 1;
      } else {
        continue;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;

    if (started && depth === 0) {
      return text.slice(0, i + 1);
    }
  }

  return null;
}

function extractMarkdownSection(markdown: string, headingNames: string[]): string | null {
  const lines = markdown.split('\n');
  const normalizedTargets = headingNames.map((h) => normalizeHeading(h));

  let startIdx = -1;
  let startLevel = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    const title = normalizeHeading(m[2]);

    if (normalizedTargets.some((t) => title === t || title.startsWith(t))) {
      startIdx = i + 1;
      startLevel = level;
      break;
    }
  }

  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+/.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    if (level <= startLevel) {
      endIdx = i;
      break;
    }
  }

  const section = lines.slice(startIdx, endIdx).join('\n').trim();
  return section || null;
}

function normalizeHeading(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[`_*]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

