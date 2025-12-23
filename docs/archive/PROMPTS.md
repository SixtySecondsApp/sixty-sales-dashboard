# AI Prompts Documentation

Complete documentation of all AI prompts and functions used throughout the Sixty Sales Dashboard application.

## Source Code Location

All prompts are now centralized in the `src/lib/prompts/` folder with configurable models and type-safe templates:

```
src/lib/prompts/
├── index.ts                 # Central exports, model configuration, utilities
├── suggestNextActions.ts    # Suggest Next Actions prompts
├── transcriptAnalysis.ts    # Transcript Analysis prompts
├── emailAnalysis.ts         # Email Analysis prompts
├── writingStyle.ts          # Writing Style Analysis prompts
├── proposalGeneration.ts    # All Proposal Generation prompts
└── workflowEngine.ts        # Workflow Engine dynamic prompts
```

### Using the Prompts Module

```typescript
import {
  // Templates
  suggestNextActionsTemplate,
  transcriptAnalysisTemplate,
  emailAnalysisTemplate,
  writingStyleTemplate,
  focusAreasTemplate,
  goalsTemplate,
  sowTemplate,
  htmlProposalTemplate,

  // Model configuration
  DEFAULT_MODELS,
  FEATURE_MODEL_DEFAULTS,
  getModelForFeature,

  // Utilities
  interpolatePrompt,
  buildPromptConfig,
} from '@/lib/prompts';

// Build a complete prompt config
const config = buildPromptConfig(suggestNextActionsTemplate, {
  activityType: 'meeting',
  activityTitle: 'Q4 Strategy Discussion',
  contentSection: 'Full Meeting Transcript:\n...',
});

// Use the config with your AI provider
const response = await aiProvider.complete({
  systemPrompt: config.systemPrompt,
  userPrompt: config.userPrompt,
  model: config.model,
  temperature: config.temperature,
  maxTokens: config.maxTokens,
});
```

---

## Table of Contents

1. [Meeting & Activity Analysis](#1-meeting--activity-analysis)
   - [Suggest Next Actions](#11-suggest-next-actions)
   - [Transcript Analysis (Action Items)](#12-transcript-analysis-action-items)
2. [Email Analysis](#2-email-analysis)
   - [Analyze Email](#21-analyze-email)
   - [Writing Style Analysis](#22-writing-style-analysis)
3. [Proposal Generation](#3-proposal-generation)
   - [Analyze Focus Areas](#31-analyze-focus-areas)
   - [Generate Goals](#32-generate-goals)
   - [Generate Statement of Work (SOW)](#33-generate-statement-of-work-sow)
   - [Generate HTML Proposal](#34-generate-html-proposal)
   - [Generate Email Proposal](#35-generate-email-proposal)
   - [Generate Markdown Proposal](#36-generate-markdown-proposal)
4. [AI Provider Service (Workflow Engine)](#4-ai-provider-service-workflow-engine)
5. [Configuration Reference](#5-configuration-reference)

---

## 1. Meeting & Activity Analysis

### 1.1 Suggest Next Actions

**Source File**: `src/lib/prompts/suggestNextActions.ts`

**Edge Function**: `supabase/functions/suggest-next-actions/index.ts`

**Purpose**: Analyzes sales activities (meetings, calls, emails, proposals) to generate intelligent next-action suggestions with reasoning.

**Default Model Configuration**:
```typescript
{
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.7,
  maxTokens: 2048,
}
```

**API Endpoint**: `POST /functions/v1/suggest-next-actions`

#### Template Export

```typescript
import { suggestNextActionsTemplate } from '@/lib/prompts';

// Template structure
suggestNextActionsTemplate = {
  id: 'suggest-next-actions',
  name: 'Suggest Next Actions',
  featureKey: 'suggest_next_actions',
  systemPrompt: SUGGEST_NEXT_ACTIONS_SYSTEM_PROMPT,
  userPrompt: SUGGEST_NEXT_ACTIONS_USER_PROMPT,
  variables: SUGGEST_NEXT_ACTIONS_VARIABLES,
  responseFormat: 'json',
  responseSchema: SUGGEST_NEXT_ACTIONS_RESPONSE_SCHEMA,
}
```

#### Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `activityType` | Activity type (meeting, activity, email, etc.) | Request |
| `activityTitle` | Activity/meeting title | Meetings/Activities |
| `companySection` | Company info (name, domain, size) | Companies |
| `dealSection` | Deal info (title, stage, value) | Deals |
| `contactSection` | Contact info (name, title) | Contacts |
| `contentSection` | Transcript/summary/notes | Meetings/Activities |
| `recentActivitiesSection` | Last 30 days of activities | Activities |
| `existingContextSection` | Existing suggestions/tasks | For deduplication |
| `exampleDeadline` | Example ISO date for JSON | Computed |

#### Expected JSON Response

```json
[
  {
    "task_category": "email",
    "title": "Send ROI calculator within 24 hours",
    "reasoning": "Customer expressed concerns about ROI during the call...",
    "urgency": "high",
    "recommended_deadline": "2025-11-28T00:00:00.000Z",
    "confidence_score": 0.85,
    "timestamp_seconds": 450
  }
]
```

---

### 1.2 Transcript Analysis (Action Items)

**Source File**: `src/lib/prompts/transcriptAnalysis.ts`

**Edge Function**: `supabase/functions/fathom-sync/aiAnalysis.ts`

**Purpose**: Extracts action items, analyzes talk time, and determines sentiment from meeting transcripts.

**Default Model Configuration**:
```typescript
{
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.5,
  maxTokens: 4096,
}
```

#### Template Export

```typescript
import { transcriptAnalysisTemplate } from '@/lib/prompts';
```

#### Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `meetingTitle` | Meeting title | Meetings |
| `meetingDate` | Meeting date (ISO format) | Meetings |
| `ownerEmail` | Meeting host email | Meetings |
| `transcript` | Full meeting transcript | Meetings |

#### Expected JSON Response

```json
{
  "actionItems": [
    {
      "title": "Send detailed pricing proposal with enterprise tier options",
      "assignedTo": "John Smith",
      "assignedToEmail": "john@company.com",
      "deadline": "2025-11-05",
      "category": "proposal",
      "priority": "high",
      "confidence": 0.95
    }
  ],
  "talkTime": {
    "repPct": 45.5,
    "customerPct": 54.5,
    "assessment": "Well-balanced conversation with good listening"
  },
  "sentiment": {
    "score": 0.75,
    "reasoning": "Positive and engaged conversation with strong interest",
    "keyMoments": [
      "Customer expressed enthusiasm about the product",
      "Pricing concerns were addressed satisfactorily"
    ]
  }
}
```

---

## 2. Email Analysis

### 2.1 Analyze Email

**Source File**: `src/lib/prompts/emailAnalysis.ts`

**Edge Function**: `supabase/functions/analyze-email/index.ts`

**Purpose**: Analyzes sales emails for CRM health tracking - extracts sentiment, topics, action items, and urgency.

**Default Model Configuration**:
```typescript
{
  model: 'claude-haiku-4-5-20251001',
  temperature: 0.3,
  maxTokens: 1024,
}
```

**API Endpoint**: `POST /functions/v1/analyze-email`

#### Template Export

```typescript
import { emailAnalysisTemplate } from '@/lib/prompts';
```

#### Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `subject` | Email subject line | Request |
| `body` | Email body content | Request |

#### Expected JSON Response

```json
{
  "sentiment_score": 0.5,
  "key_topics": ["pricing", "timeline"],
  "action_items": ["Schedule follow-up call"],
  "urgency": "medium",
  "response_required": true
}
```

---

### 2.2 Writing Style Analysis

**Source File**: `src/lib/prompts/writingStyle.ts`

**Edge Function**: `supabase/functions/analyze-writing-style/index.ts`

**Purpose**: Analyzes user's sent emails to extract their unique writing style for AI personalization.

**Default Model Configuration**:
```typescript
{
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.5,
  maxTokens: 2048,
}
```

**API Endpoint**: `POST /functions/v1/analyze-writing-style`

#### Template Export

```typescript
import { writingStyleTemplate } from '@/lib/prompts';
```

#### Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `emailCount` | Number of emails analyzed | Computed |
| `emailSamples` | Formatted email samples | Gmail API |

#### Expected JSON Response

```json
{
  "name": "Direct & Professional",
  "tone_description": "Clear, concise communication...",
  "tone": {
    "formality": 4,
    "directness": 4,
    "warmth": 3
  },
  "structure": {
    "avg_sentence_length": 15,
    "preferred_length": "moderate",
    "uses_bullets": true
  },
  "vocabulary": {
    "complexity": "professional",
    "common_phrases": ["I look forward to", "Please let me know"],
    "industry_terms": ["ROI", "pipeline"]
  },
  "greetings_signoffs": {
    "greetings": ["Hi", "Hello"],
    "signoffs": ["Best regards", "Thanks"]
  },
  "example_excerpts": ["I wanted to follow up on our conversation..."],
  "analysis_confidence": 0.85
}
```

---

## 3. Proposal Generation

**Source File**: `src/lib/prompts/proposalGeneration.ts`

**Edge Function**: `supabase/functions/generate-proposal/index.ts`

**Purpose**: Multi-step proposal generation system including focus area analysis, goals extraction, SOW generation, and full proposal creation.

**Default Models** (via OpenRouter):
```typescript
{
  proposal_focus_areas: { model: 'anthropic/claude-haiku-4.5', temperature: 0.5, maxTokens: 2048 },
  proposal_goals: { model: 'anthropic/claude-3-5-sonnet-20241022', temperature: 0.7, maxTokens: 4096 },
  proposal_sow: { model: 'anthropic/claude-3-5-sonnet-20241022', temperature: 0.7, maxTokens: 8192 },
  proposal_html: { model: 'anthropic/claude-3-5-sonnet-20241022', temperature: 0.7, maxTokens: 16384 },
}
```

**API Endpoint**: `POST /functions/v1/generate-proposal`

### 3.1 Analyze Focus Areas

**Action**: `analyze_focus_areas`

```typescript
import { focusAreasTemplate } from '@/lib/prompts';
```

#### Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `contactSection` | Client contact name | Request |
| `companySection` | Company name | Request |
| `transcriptsText` | Combined transcripts | Meetings |

#### Expected JSON Response

```json
{
  "focus_areas": [
    {
      "id": "focus-1",
      "title": "Revenue Growth Strategy",
      "description": "Focus on increasing quarterly revenue through new customer acquisition and upselling.",
      "category": "Strategy"
    }
  ]
}
```

---

### 3.2 Generate Goals

**Action**: `generate_goals`

```typescript
import { goalsTemplate } from '@/lib/prompts';
```

#### Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `goalsTemplate` | Example template | proposal_templates |
| `contactSection` | Client contact name | Request |
| `companySection` | Company name | Request |
| `transcriptsText` | Combined transcripts | Meetings |
| `focusAreasSection` | Focus areas to emphasize | Request |

---

### 3.3 Generate Statement of Work (SOW)

**Action**: `generate_sow`

```typescript
import { sowTemplate } from '@/lib/prompts';
```

#### Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `sowTemplate` | Example SOW template | proposal_templates |
| `contactSection` | Client contact name | Request |
| `companySection` | Company name | Request |
| `goals` | Goals & Objectives document | Previous step |
| `focusAreasSection` | Focus areas to emphasize | Request |
| `lengthGuidance` | Document length requirements | Request |

---

### 3.4 Generate HTML Proposal

**Action**: `generate_proposal`

```typescript
import { htmlProposalTemplate } from '@/lib/prompts';
```

#### Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `proposalTemplate` | Example HTML template | proposal_templates |
| `designSystemTemplate` | Design system guidelines | proposal_templates |
| `contactSection` | Client contact name | Request |
| `companySection` | Company name | Request |
| `goals` | Goals & Objectives document | Previous step |
| `focusAreasSection` | Focus areas to emphasize | Request |
| `lengthGuidance` | Document length requirements | Request |

---

### 3.5 Generate Email Proposal

**Action**: `generate_email`

```typescript
import { emailProposalTemplate } from '@/lib/prompts';
```

---

### 3.6 Generate Markdown Proposal

**Action**: `generate_markdown`

```typescript
import { markdownProposalTemplate } from '@/lib/prompts';
```

---

## 4. AI Provider Service (Workflow Engine)

**Source File**: `src/lib/prompts/workflowEngine.ts`

**Service File**: `src/lib/services/aiProvider.ts`

**Purpose**: Central service for AI provider integrations in the workflow automation system. Supports OpenAI, Anthropic, OpenRouter, and Google Gemini.

### Dynamic Prompt Enhancements

The workflow engine applies automatic prompt enhancements based on configuration:

```typescript
import {
  buildEnhancedSystemPrompt,
  buildEnhancedUserPrompt,
  CHAIN_OF_THOUGHT_ENHANCEMENT,
  CRM_ACCESS_ENHANCEMENT,
  TOOL_INSTRUCTIONS_TEMPLATE,
  MCP_INSTRUCTIONS_TEMPLATE,
  JSON_OUTPUT_INSTRUCTION,
} from '@/lib/prompts';

// Build enhanced prompts
const enhancedSystemPrompt = buildEnhancedSystemPrompt(
  baseSystemPrompt,
  config,
  toolDescriptions,
  mcpServerList
);

const enhancedUserPrompt = buildEnhancedUserPrompt(
  baseUserPrompt,
  config
);
```

### Enhancement Types

| Enhancement | When Applied |
|-------------|--------------|
| Chain of Thought | `config.chainOfThought = true` |
| CRM Access | Auto-detected CRM keywords in prompt |
| Tool Instructions | `config.enableTools = true` |
| MCP Server Access | `config.enableMCP = true` |
| JSON Output | `config.outputFormat = 'json'` |
| Few-Shot Examples | `config.fewShotExamples.length > 0` |

### Workflow Configuration

```typescript
interface WorkflowNodeConfig {
  modelProvider: 'openai' | 'anthropic' | 'openrouter' | 'gemini';
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  chainOfThought?: boolean;
  enableTools?: boolean;
  selectedTools?: string[];
  autoExecuteTools?: boolean;
  enableMCP?: boolean;
  selectedMCPServers?: string[];
  outputFormat?: 'text' | 'json' | 'markdown' | 'structured';
  jsonSchema?: string;
  fewShotExamples?: Array<{ input: string; output: string }>;
  retryOnError?: boolean;
  maxRetries?: number;
  extractionRules?: ExtractionRule[];
}
```

---

## 5. Configuration Reference

### Model Configuration

Models can be configured at three levels (in priority order):

1. **User Settings**: `user_ai_feature_settings` table
2. **System Config**: `system_config` table
3. **Hardcoded Defaults**: `FEATURE_MODEL_DEFAULTS` in `src/lib/prompts/index.ts`

### Default Models

```typescript
export const DEFAULT_MODELS = {
  HAIKU: 'claude-haiku-4-5-20251001',
  SONNET: 'claude-3-5-sonnet-20241022',
  OPUS: 'claude-3-opus-20240229',
  OPENROUTER_HAIKU: 'anthropic/claude-haiku-4.5',
  OPENROUTER_SONNET: 'anthropic/claude-3-5-sonnet-20241022',
};
```

### Feature Model Defaults

```typescript
export const FEATURE_MODEL_DEFAULTS = {
  suggest_next_actions: { model: HAIKU, temperature: 0.7, maxTokens: 2048 },
  transcript_analysis: { model: HAIKU, temperature: 0.5, maxTokens: 4096 },
  email_analysis: { model: HAIKU, temperature: 0.3, maxTokens: 1024 },
  writing_style: { model: SONNET, temperature: 0.5, maxTokens: 2048 },
  proposal_focus_areas: { model: OPENROUTER_HAIKU, temperature: 0.5, maxTokens: 2048 },
  proposal_goals: { model: OPENROUTER_SONNET, temperature: 0.7, maxTokens: 4096 },
  proposal_sow: { model: OPENROUTER_SONNET, temperature: 0.7, maxTokens: 8192 },
  proposal_html: { model: OPENROUTER_SONNET, temperature: 0.7, maxTokens: 16384 },
  workflow_default: { model: HAIKU, temperature: 0.7, maxTokens: 2048 },
};
```

### Environment Variables

| Variable | Description | Used By |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic/Claude API key | Edge functions |
| `OPENROUTER_API_KEY` | OpenRouter API key | Edge functions |
| `CLAUDE_MODEL` | Default Claude model ID | Edge functions |
| `VITE_OPENAI_API_KEY` | Client-side OpenAI key | Frontend |
| `VITE_ANTHROPIC_API_KEY` | Client-side Anthropic key | Frontend |
| `VITE_OPENROUTER_API_KEY` | Client-side OpenRouter key | Frontend |
| `VITE_GEMINI_API_KEY` | Client-side Gemini key | Frontend |

### Database Tables

#### `system_config`

| Key | Description | Default |
|-----|-------------|---------|
| `proposal_sow_model` | Model for SOW generation | `anthropic/claude-3-5-sonnet-20241022` |
| `proposal_proposal_model` | Model for proposal generation | `anthropic/claude-3-5-sonnet-20241022` |
| `proposal_focus_model` | Model for focus area extraction | `anthropic/claude-haiku-4.5` |
| `proposal_goals_model` | Model for goals generation | `anthropic/claude-3-5-sonnet-20241022` |

#### `proposal_templates`

| Type | Description |
|------|-------------|
| `goals` | Goals & Objectives template |
| `sow` | Statement of Work template |
| `proposal` | HTML Proposal template |
| `design_system` | Design system/CSS template |

#### `user_settings`

| Field | Description |
|-------|-------------|
| `ai_provider_keys` | JSON object with provider API keys |

#### `user_ai_feature_settings`

| Field | Description |
|-------|-------------|
| `user_id` | User identifier |
| `feature_key` | Feature identifier |
| `provider` | AI provider |
| `model` | Model identifier |
| `temperature` | Temperature setting |
| `max_tokens` | Max tokens setting |
| `is_enabled` | Feature enabled flag |

---

## Customization Guide

### Adding a New Prompt

1. Create a new file in `src/lib/prompts/` or add to existing file
2. Export the system prompt, user prompt, variables, and template
3. Add the feature key to `FEATURE_MODEL_DEFAULTS` in `index.ts`
4. Update the exports in `index.ts`

Example:

```typescript
// src/lib/prompts/myNewFeature.ts
import type { PromptTemplate, PromptVariable } from './index';

export const MY_FEATURE_SYSTEM_PROMPT = `You are...`;

export const MY_FEATURE_USER_PROMPT = `Analyze this: \${content}`;

export const MY_FEATURE_VARIABLES: PromptVariable[] = [
  {
    name: 'content',
    description: 'Content to analyze',
    type: 'string',
    required: true,
    source: 'request',
  },
];

export const myFeatureTemplate: PromptTemplate = {
  id: 'my-feature',
  name: 'My Feature',
  description: 'Description of what this does',
  featureKey: 'my_feature',
  systemPrompt: MY_FEATURE_SYSTEM_PROMPT,
  userPrompt: MY_FEATURE_USER_PROMPT,
  variables: MY_FEATURE_VARIABLES,
  responseFormat: 'json',
};
```

### Overriding Model Settings

```typescript
import { buildPromptConfig, myFeatureTemplate } from '@/lib/prompts';

// Use default model
const config = buildPromptConfig(myFeatureTemplate, variables);

// Override model settings
const customConfig = buildPromptConfig(myFeatureTemplate, variables, {
  model: 'gpt-4-turbo',
  temperature: 0.9,
  maxTokens: 4096,
});
```

---

*Last updated: November 2025*
