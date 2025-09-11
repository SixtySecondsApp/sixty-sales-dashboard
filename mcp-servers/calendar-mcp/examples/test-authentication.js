#!/usr/bin/env node

/**
 * Google Calendar MCP Server - Authentication Test Example
 * 
 * This script demonstrates how to test the authentication flow
 * with the Google Calendar MCP server.
 */

const EXAMPLE_TOOLS = [
  {
    name: "calendar_get_auth_url",
    description: "Step 1: Get the OAuth URL to authenticate with Google"
  },
  {
    name: "calendar_authenticate", 
    args: { code: "4/0AdQt8qh..." },
    description: "Step 2: Complete authentication with authorization code"
  },
  {
    name: "calendar_check_auth",
    description: "Step 3: Verify authentication status"
  },
  {
    name: "calendar_create_event",
    args: {
      summary: "Test Meeting",
      startDateTime: "2024-01-15T09:00:00Z",
      endDateTime: "2024-01-15T10:00:00Z",
      description: "A test meeting created via MCP",
      attendees: [
        { email: "test@example.com", displayName: "Test User" }
      ],
      createMeetLink: true
    },
    description: "Step 4: Create a test calendar event"
  },
  {
    name: "calendar_list_events",
    args: {
      timeMin: "2024-01-01T00:00:00Z",
      timeMax: "2024-01-31T23:59:59Z",
      maxResults: 10
    },
    description: "Step 5: List upcoming events"
  }
];

console.log("📅 Google Calendar MCP Server - Test Examples");
console.log("============================================");
console.log("");

console.log("🔧 Setup Instructions:");
console.log("1. Copy .env.example to .env");
console.log("2. Add your Google OAuth credentials to .env");
console.log("3. Start the MCP server: npm start");
console.log("4. Use these tool examples to test functionality:");
console.log("");

EXAMPLE_TOOLS.forEach((tool, index) => {
  console.log(`${index + 1}. ${tool.name}`);
  console.log(`   Description: ${tool.description}`);
  
  if (tool.args) {
    console.log("   Example arguments:");
    console.log("   " + JSON.stringify(tool.args, null, 2).split('\n').join('\n   '));
  }
  
  console.log("");
});

console.log("🚀 Authentication Flow:");
console.log("1. Call calendar_get_auth_url");
console.log("2. Visit the returned URL in your browser");
console.log("3. Grant permissions to your app");
console.log("4. Copy the authorization code");
console.log("5. Call calendar_authenticate with the code");
console.log("6. Use any other calendar tools!");
console.log("");

console.log("💡 Pro Tips:");
console.log("- Store tokens securely for production use");
console.log("- Use refresh tokens for long-lived applications");
console.log("- Handle authentication errors gracefully");
console.log("- Test with different calendar scenarios");
console.log("");

console.log("📚 Available Tools: " + EXAMPLE_TOOLS.length + " calendar operations");
console.log("🔗 Documentation: See README.md for complete API reference");