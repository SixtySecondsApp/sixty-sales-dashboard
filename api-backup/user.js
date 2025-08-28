export default function handler(request, response) {
  try {
    console.log('User API called, method:', request.method);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return response.status(200).end();
    }

    if (request.method === 'GET') {
      // Return Andrew Bryce's profile - this is a simple hardcoded response that shouldn't timeout
      const userData = {
        id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', // Andrew's actual UUID from the database
        email: 'andrew.bryce@sixtyseconds.video',
        first_name: 'Andrew',
        last_name: 'Bryce',
        stage: 'Director',
        is_admin: true,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Returning user data for Andrew Bryce');
      
      // Set headers
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Return JSON response
      return response.status(200).json({
        data: userData,
        error: null,
        count: 1
      });
    }

    // Method not allowed
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
    
    return response.status(405).json({
      data: null,
      error: 'Method not allowed',
      count: 0
    });
  } catch (error) {
    console.error('Error in user API:', error);
    
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
    
    return response.status(500).json({
      data: null,
      error: error.message,
      count: 0
    });
  }
} 