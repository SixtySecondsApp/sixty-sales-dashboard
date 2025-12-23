# Workflow Testing Guide

## Quick Start: Testing Form Submissions

### 1. Create a Workflow with Form Node

1. Navigate to the Workflows page
2. Click "Create Workflow" or open an existing workflow
3. Drag a "Form Trigger" node from the left sidebar onto the canvas
   - The form is **automatically configured** with test and production URLs
   - Default fields: Name and Email are pre-configured

### 2. Connect Nodes

1. Add other nodes (Action, Condition, etc.) to your workflow
2. Connect nodes by dragging from output to input handles
3. The workflow should start with your Form node

### 3. Enter Test Mode

1. Click the **"Test Mode"** button in the top-right toolbar
2. This opens the Workflow Test Mode panel showing:
   - Form URL with QR code
   - Execution history
   - Real-time logs

### 4. Submit Test Form

#### Option A: Direct Link
1. Click the form URL in the Test Mode panel
2. Fill out the form fields
3. Click Submit

#### Option B: QR Code (Mobile Testing)
1. Scan the QR code with your phone
2. Fill out the form on mobile
3. Submit

### 5. Monitor Execution

In the Test Mode panel, you'll see:
- **Overview Tab**: Recent executions with status
- **Logs Tab**: Real-time execution logs
- **Debug Tab**: Detailed execution data

### Debugging Form Submissions

If form submissions aren't being captured:

1. **Check Console Logs**
   - Open browser DevTools (F12)
   - Look for logs starting with `[WorkflowCanvas]` or `[WorkflowExecution]`
   - You should see:
     ```
     [WorkflowCanvas] Form submission event received: {...}
     [WorkflowCanvas] Found matching form node, triggering workflow execution
     [WorkflowExecution] Processing trigger data: {...}
     ```

2. **Verify Form Node Configuration**
   - Click on the Form node to open configuration
   - Check that test URL is generated
   - Ensure fields are configured

3. **Check Workflow Connections**
   - Form node should be the starting node (no incoming connections)
   - At least one outgoing connection to another node

4. **Test Mode Indicators**
   - Test Mode button should show "active" state
   - Execution panel should show "Listening" status

## Advanced Features

### Form Configuration

Click on any Form node to:
- Customize form title and description
- Add/remove/edit fields
- Set validation rules
- Configure authentication
- Set response messages

### Multiple Form Testing

You can have multiple Form nodes in a workflow:
- Each form gets unique test/production URLs
- Forms can trigger different workflow branches
- Use Router nodes to handle different form types

### Environment Management

The system supports three environments:
- **Build**: Development and testing
- **Staging**: Pre-production testing
- **Live**: Production environment

### Test Data Management

- Form submissions are stored with full context
- Variable interpolation supports `{{formData.fields.fieldName}}`
- Test executions are separate from production

## Troubleshooting

### Form Not Found Error
- Ensure the form node was properly created
- Check that form configurations were saved
- Verify the URL matches the form node's configuration

### Submissions Not Triggering
- Confirm Test Mode is active
- Check browser console for errors
- Verify workflow has at least one Form node
- Ensure nodes are properly connected

### Execution Failures
- Review logs in Test Mode panel
- Check node configurations
- Verify all required fields are filled
- Look for error messages in execution history

## Best Practices

1. **Always test in Test Mode first** before using production URLs
2. **Use meaningful form names** to identify them easily
3. **Add validation** to required fields
4. **Monitor execution logs** during testing
5. **Clear test data** periodically to avoid confusion

## Example Workflow

1. **Form Node** → Captures user submission
2. **Condition Node** → Routes based on form data
3. **Action Node** → Performs action (create task, send email)
4. **Router Node** → Handles multiple outcomes

## API Integration

Form submissions trigger events:
- `formSubmitted`: Production form submission
- `formTestSubmission`: Test form submission

These events include:
```javascript
{
  formId: "form-test-xxx",
  workflowId: "workflow-xxx",
  formData: {
    fields: { name: "...", email: "..." },
    submittedAt: "2024-01-08T...",
    submissionId: "sub-xxx"
  }
}
```

## Need Help?

- Check browser console for detailed logs
- Review the execution history in Test Mode
- Verify node connections and configurations
- Ensure Test Mode is active when testing