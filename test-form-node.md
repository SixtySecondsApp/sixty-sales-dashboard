# Form Node Test Checklist

## 1. Form Node Creation
- [ ] Navigate to /workflows page
- [ ] Open the node library panel
- [ ] Find "Form Submission" in the Triggers section
- [ ] Drag and drop the Form Submission trigger to the canvas
- [ ] Verify that a blue gradient form node appears

## 2. Form Configuration
- [ ] Click on the form node
- [ ] Verify that the FormConfigModal opens
- [ ] Check that the modal has 3 tabs: Configuration, Form Fields, Response Settings

## 3. Add Form Fields
- [ ] Switch to the "Form Fields" tab
- [ ] Click "Add Field" button
- [ ] Add a text field with label "Name"
- [ ] Add an email field with label "Email"
- [ ] Add a select field with options
- [ ] Mark some fields as required

## 4. Preview Form
- [ ] Click the "Preview Form" button
- [ ] Verify that the form preview shows all configured fields
- [ ] Test filling out the form with sample data
- [ ] Click "Fill Sample Data" to test auto-population
- [ ] Submit the form and verify success message

## 5. Variable Integration
- [ ] After form submission in preview, check the available variables section
- [ ] Verify variables are in format: {{formData.fields.fieldName}}
- [ ] Test copying variables using the copy button

## 6. Save Configuration
- [ ] Click "Save Configuration" in the modal
- [ ] Verify that the form node shows the field count badge
- [ ] Verify that the form title is displayed on the node

## 7. Connect to AI Node
- [ ] Add an AI Agent node to the canvas
- [ ] Connect the form node to the AI node
- [ ] In the AI node configuration, use form variables in the prompt
- [ ] Example: "Process submission from {{formData.fields.name}} with email {{formData.fields.email}}"

## Expected Results
- Form node should integrate seamlessly with the workflow canvas
- Configuration should be persisted when saving
- Variables should be available for use in connected nodes
- Preview should accurately represent the configured form