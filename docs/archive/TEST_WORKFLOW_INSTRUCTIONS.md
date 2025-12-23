# Test Workflow Instructions

## Fix for Database Error

To fix the "test_scenarios" column error, you need to add the column to your database:

### Quick Fix (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run this simple SQL command:
   ```sql
   ALTER TABLE public.user_automation_rules 
   ADD COLUMN IF NOT EXISTS test_scenarios JSONB DEFAULT '[]'::jsonb;
   ```
4. Verify it worked by checking the table structure

### Alternative: Using Migration File
1. Use the SQL file: `APPLY_TEST_SCENARIOS_FIX.sql`
2. Copy its contents and run in Supabase SQL Editor

The column has already been uncommented in the code, so workflows should save properly after adding the column.

## Creating a Test Workflow

1. **Add a Form Node**:
   - Drag "Form Submission" from triggers panel to canvas
   - Click the form node to configure
   - Add fields:
     - Name (text, required)
     - Email (email, required)
     - Message (textarea, optional)
   - Save configuration

2. **Add an AI Agent Node**:
   - Drag "AI Agent" from AI nodes panel to canvas
   - Connect Form node to AI Agent (drag from form's output handle to AI input)
   - Click AI Agent to configure
   - In User Prompt, use variables:
     ```
     Process this form submission:
     Name: {{formData.fields.name}}
     Email: {{formData.fields.email}}
     Message: {{formData.fields.message}}
     
     Generate a personalized response.
     ```
   - Save configuration

3. **Add an Action Node** (optional):
   - Drag "Create Task" from actions panel
   - Connect AI Agent to Action node
   - Configure task creation

## Running the Workflow

1. **Manual Test**:
   - Click the green "Run" button in the toolbar
   - The workflow will execute with empty data
   - Click "Executions" to see the results

2. **Form Test**:
   - After configuring the form, note the test URL shown
   - Open the test URL in a new tab
   - Fill and submit the form
   - Return to workflow canvas and click "Executions"
   - You'll see the form submission data flowing through nodes

## Viewing Execution Data

In the Execution Viewer:
- Click on each node to expand and see input/output
- Click the copy button next to any value to use it as a variable
- The data flows from Form → AI Agent → Action

## Troubleshooting

If the Run button doesn't work:
1. Make sure you have at least one node in the canvas
2. Check browser console for errors
3. Ensure nodes are properly connected with edges

If you see database errors:
1. Run the migration script as described above
2. Refresh the page after migration

## Variable Mapping Examples

- Form field: `{{formData.fields.name}}`
- AI response: `{{nodes.[nodeId].output.response}}`
- Trigger data: `{{triggerData.submittedAt}}`

The execution viewer shows all available variables - click any value to copy its path!