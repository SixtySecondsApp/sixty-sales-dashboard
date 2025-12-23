# Custom JSON Payload Testing Implementation

## 🎯 Overview

This implementation provides a comprehensive custom JSON payload testing feature for the workflow testing lab, allowing users to input their own JSON payloads to test workflows and see how each node responds.

## 📁 Files Created/Modified

### ✅ Phase 1: Core Engine Updates
**File**: `/src/lib/utils/workflowTestEngine.ts`
- Added `PayloadValidation` interface for validation results
- Added `validateCustomPayload(payload: any): PayloadValidation` method
- Added `startTestWithCustomPayload(payload: any)` method
- Enhanced `generateTestData()` to support custom payloads
- Added custom payload state management

### ✅ Phase 2: Payload Template System
**File**: `/src/lib/utils/testPayloadTemplates.ts` (NEW)
- Comprehensive template library with 15+ pre-built templates
- Categories: Fathom, CRM, Task Management, Generic Webhooks, General
- Template features: interpolation, variables, descriptions
- Helper functions for template management and filtering

**Template Categories**:
- **Fathom Webhooks**: Meeting summaries, transcripts, action items
- **CRM Operations**: Deal creation, stage changes, contact updates
- **Task Management**: Task creation, completion, overdue notifications
- **Generic Webhooks**: Form submissions, payments, API events
- **General Purpose**: Minimal and flexible test data

### ✅ Phase 3: Enhanced Testing UI
**File**: `/src/components/workflows/TestingLabCustomPayload.tsx` (NEW)
- Complete custom payload testing interface
- JSON editor with real-time validation and syntax highlighting
- Template management with category-based filtering
- Node response visualization with input/output inspection
- Payload history with localStorage persistence
- Import/Export functionality for JSON files
- Comprehensive error handling and user feedback

### ✅ Phase 4: Integration
**File**: `/src/pages/Workflows.tsx`
- Added testing mode selector (Real Executions vs Custom Payload)
- Integrated TestingLabCustomPayload component
- Enhanced testing tab with dual-mode interface
- Preserved existing TestingLabNew functionality

## 🎨 UI Layout Specification

```
┌──────────────────────────────────────────────────────────────┐
│  🧪 Workflow Testing Lab - Custom Payload Mode               │
├──────────────────────────────────────────────────────────────┤
│ Template: [Fathom Summary ▼] [📥 Import] [📤 Export] [🕒 History] │
├────────────────┬──────────────────┬──────────────────────────┤
│                │                  │ Node Responses           │
│ JSON Editor    │   Workflow       │ ═══════════════          │
│ ──────────     │   Visualization  │                          │
│ ✅ Valid JSON   │                  │ ▼ Fathom Webhook         │
│                │   ┌─────┐        │   📥 Input:              │
│ 1  {           │   │Hook │        │   { "id": "123"... }     │
│ 2    "id":     │   └──┬──┘        │   📤 Output:             │
│ 3    "fathom", │      │           │   { "processed": true }  │
│ 4    "type":   │   ┌──▼──┐        │   ⏱️ 125ms              │
│ 5    "summary" │   │Branch│       │                          │
│ 6    ...       │   └─────┘        │ ▼ Conditional Branch     │
│                │                  │   Decision: summary      │
│                │                  │   Branch taken: true     │
│                │                  │                          │
└────────────────┴──────────────────┴──────────────────────────┘
│ [🔍 Validate] [🎨 Format] [🗑️ Clear] [▶️ Test with Payload]    │
└──────────────────────────────────────────────────────────────┘
```

## 🔧 Key Features

### 1. JSON Editor with Validation
- Real-time JSON parsing and validation
- Line-specific error messages
- Syntax highlighting with monospace font
- Format JSON button for pretty-printing
- Copy and clear functionality

### 2. Template Management
- 15+ pre-built templates across 5 categories
- Category-based filtering and selection
- Template interpolation with variables
- Descriptions and usage guidance

### 3. Node Response Visualization
- Real-time data flow tracking
- Input/output data inspection for each node
- Execution timing and status indicators
- Collapsible response cards with JSON tree view
- Error display with detailed messages

### 4. Payload History
- Automatic saving of last 10 test payloads
- Timestamp and test result tracking
- Quick reload from history
- LocalStorage persistence across sessions

### 5. Import/Export
- Import JSON files from local filesystem
- Export test scenarios with metadata
- Shareable payload configurations
- Documentation support

### 6. Visual Workflow Execution
- Enhanced node visualization with status indicators
- Animated data flow along edges
- Real-time execution progress
- Node highlighting during active execution

## 📊 Template Examples

### Fathom Meeting Summary
```json
{
  "meeting_id": "fathom_123456",
  "title": "Sales Discovery Call - Acme Corp",
  "participants": [
    {"name": "John Smith", "email": "john@company.com", "role": "host"},
    {"name": "Sarah Johnson", "email": "sarah@acmecorp.com", "role": "guest"}
  ],
  "summary": "Discussed product requirements and budget.",
  "action_items": [
    {
      "text": "Send proposal with enterprise features",
      "assignee": "john@company.com",
      "due_date": "2024-01-18"
    }
  ],
  "sentiment": "positive"
}
```

### CRM Deal Created
```json
{
  "event_type": "deal_created",
  "deal_id": "deal_987654",
  "deal_name": "Enterprise Software License - TechCorp",
  "company_name": "TechCorp Solutions",
  "contact": {
    "name": "Alice Chen",
    "email": "alice@techcorp.com",
    "title": "VP of Engineering"
  },
  "value": {"amount": 75000, "currency": "USD"},
  "stage": "SQL",
  "source": "inbound_demo_request"
}
```

## 🚀 Usage Workflow

1. **Navigate**: Go to Workflows → Testing Lab → Custom Payload
2. **Select Template**: Choose from categorized templates or start blank
3. **Edit Payload**: Modify JSON with real-time validation feedback
4. **Test Workflow**: Execute with custom data and observe results
5. **Analyze**: Inspect node responses and data transformations
6. **Iterate**: Use history to re-test and compare scenarios

## 💡 Benefits

- **Debug Complex Scenarios**: Test edge cases and unusual data patterns
- **Rapid Iteration**: Quick testing without waiting for real events
- **Validate Logic**: Ensure conditional branches work with various inputs
- **Focus Testing**: Target specific workflow branches with crafted data
- **Document Examples**: Save example payloads as documentation
- **Pre-deployment Testing**: Validate thoroughly before production

## 🔧 Technical Implementation Details

### PayloadValidation Interface
```typescript
interface PayloadValidation {
  isValid: boolean;
  errors: Array<{line: number, message: string}>;
  warnings: string[];
}
```

### Template System
```typescript
interface PayloadTemplate {
  id: string;
  name: string;
  category: 'fathom' | 'crm' | 'task' | 'webhook' | 'general';
  description: string;
  payload: any;
  variables?: Array<{key: string, description: string}>;
}
```

### Node Response Tracking
```typescript
interface NodeResponseData {
  nodeId: string;
  nodeName: string;
  inputData: any;
  outputData: any;
  executionTime: number;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}
```

## 📈 Success Criteria

✅ Users can input any JSON and test their workflows  
✅ Real-time validation with helpful error messages  
✅ Templates accelerate testing common scenarios  
✅ Node responses clearly show data transformations  
✅ Payload history enables quick re-testing  
✅ UI is intuitive and responsive  
✅ Import/Export functionality for sharing  
✅ Production-ready with excellent UX  

## 🧪 Demo

A comprehensive demo is available at `/test-custom-payload-demo.html` showcasing:
- Feature overview and benefits
- UI layout and interaction patterns
- Template examples and usage scenarios
- Technical implementation details
- Step-by-step usage instructions

This implementation provides a complete, production-ready custom JSON payload testing system that enhances workflow development and debugging capabilities significantly.