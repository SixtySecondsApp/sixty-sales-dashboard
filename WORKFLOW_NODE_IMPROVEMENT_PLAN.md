# Workflow Node Improvement Plan

## 1. Architecture & Standards

### Single Source of Truth for Defaults
**Current State**: Node defaults are defined in `nodeFactory.ts` (initial creation) AND in Config Modals (fallback state).
**Recommendation**: Move all default configurations to the `NodeRegistry` definitions.
- **Action**: Update `src/components/workflows/utils/nodeRegistry.ts` to include a `defaultData` property for each node type.
- **Action**: Update `nodeFactory.ts` to read from the registry.
- **Action**: Update Config Modals to use registry defaults as fallbacks.

### Standardized Configuration UI
**Current State**: Modals vary slightly in layout and behavior.
**Recommendation**: Create a `BaseConfigModal` wrapper component.
- **Features**: Standardized Header (Icon + Title + Close), Tabs navigation, Footer (Cancel/Save), and Error display.
- **Benefit**: Consistent UX and easier maintenance.

### Real-time Validation
**Current State**: Validation mostly happens on "Save".
**Recommendation**: Use a form library (e.g., `react-hook-form` + `zod`) or enhance local state validation to show inline errors immediately.

---

## 2. Per-Node Specific Improvements

### 🤖 AI Agent Node (`AIAgentNode` / `AIAgentConfigModal`)
- **UX**: Add a "Test Prompt" button to run a quick completion with dummy data without leaving the modal.
- **Validation**: Warn if `maxTokens` is too low for the selected model.
- **Feature**: Add "Cost Estimation" based on selected model and token limits.
- **Fix**: Ensure `VariablePicker` is available for all text fields (System Prompt, User Prompt).

### 🧠 Custom GPT Node (`CustomGPTNode` / `CustomGPTConfigModal`)
- **UX**: Improve "File Upload" section. Show upload progress and better file previews.
- **Validation**: Check if the selected Assistant actually supports the enabled tools (e.g., don't allow checking "Code Interpreter" if the Assistant doesn't have it).
- **Security**: Move API key checks to server-side/edge function proxies to avoid client-side env var dependencies.

### 👔 Assistant Manager Node (`AssistantManagerNode` / `AssistantManagerConfigModal`)
- **UX**: Add a "Sync" button to fetch current state from OpenAI to ensure the config is up-to-date.
- **Feature**: Allow selecting existing Vector Stores from a dropdown instead of just ID input.

### 📝 Form Node (`FormNode` / `FormConfigModal`)
- **UX**: Embed the `FormPreview` component directly into a "Preview" tab in the modal.
- **Feature**: Add "Conditional Logic" for fields (show/hide based on other fields).
- **Validation**: Ensure field names are unique and valid variable identifiers.

### 🔌 Standard Nodes (Trigger, Condition, Action)
- **Current State**: Configured via inline popovers or `WorkflowCanvas` logic.
- **Recommendation**: Create a `StandardNodeConfigModal` for these.
    - **Trigger**: Dropdown for event type, filter configuration.
    - **Action**: Action type selector, param configuration fields.
    - **Condition**: Visual rule builder (Field -> Operator -> Value).

### ☁️ Google Integrations (`GoogleEmailNode`, `GoogleDocsNode`)
- **Current State**: No dedicated config modal found.
- **Action**: Create `GoogleIntegrationConfigModal`.
    - **Email**: To, Subject, Body (HTML editor), Attachments.
    - **Docs**: Template selector, Output path, Variable mapping.

### 📊 Fathom Integrations (`FathomWebhookNode`, `MeetingUpsertNode`)
- **Current State**: Likely hardcoded or minimal config.
- **Action**: Create `FathomNodeConfigModal`.
    - **Webhook**: Secret management, payload filtering.
    - **Meeting Upsert**: Field mapping configuration.

---

## 3. Prioritized Roadmap

### Phase 1: Foundations (High Priority)
1.  [ ] **Refactor Defaults**: Implement `defaultData` in `NodeRegistry` and update `nodeFactory`.
2.  [ ] **Base Modal**: Create `BaseConfigModal` component.
3.  [ ] **Standard Config**: Create `StandardNodeConfigModal` to replace inline/hardcoded editing for basic nodes.

### Phase 2: AI Enhancements (Medium Priority)
4.  [ ] **AI Agent UX**: Add "Test Prompt" and cost estimation.
5.  [ ] **Custom GPT UX**: Improve file handling and validation.

### Phase 3: Integrations (Lower Priority)
6.  [ ] **Google Configs**: Create dedicated modals for Google nodes.
7.  [ ] **Fathom Configs**: Create dedicated modals for Fathom nodes.
8.  [ ] **Form Logic**: Add conditional fields to Form Node.
