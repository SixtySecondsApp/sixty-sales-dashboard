import pkg from 'pg';

const { Client } = pkg;

// Database connection string - fallback to the working connection if env var not set
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

// Create a new connection for each request (better for serverless)
export async function getDbClient() {
  console.log('Creating new database client...');
  
  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set and no fallback available');
    throw new Error('Database configuration missing');
  }

  console.log('Using database URL length:', DATABASE_URL.length);

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    // Add connection timeout settings
    connectionTimeoutMillis: 10000, // 10 seconds
    query_timeout: 15000, // 15 seconds
    statement_timeout: 15000, // 15 seconds
    idle_in_transaction_session_timeout: 15000 // 15 seconds
  });
  
  try {
    console.log('Attempting to connect to database...');
    await client.connect();
    console.log('🔗 Connected to Neon database successfully');
    return client;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Helper function to execute queries with proper cleanup
export async function executeQuery(query, params = []) {
  console.log('Executing query:', query.substring(0, 100) + '...');
  let client;
  
  try {
    client = await getDbClient();
    const result = await client.query(query, params);
    console.log('Query executed successfully, rows:', result.rows.length);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    // Always close the connection
    if (client) {
      try {
        await client.end();
        console.log('Database connection closed');
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
}

// Helper function to handle API responses
export function apiResponse(data, error = null, status = 200) {
  return new Response(
    JSON.stringify({
      data,
      error: error?.message || error,
      count: Array.isArray(data) ? data.length : (data ? 1 : 0)
    }),
    {
      status: error ? 500 : status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

// Handle CORS preflight requests
export function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  return null;
} 