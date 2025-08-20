import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkContactsStructure() {
  try {
    // Get a sample contact to see the actual columns
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching contact:', error);
      return;
    }
    
    if (contact) {
      console.log('Contact columns:', Object.keys(contact));
      console.log('\nSample contact:', contact);
    } else {
      console.log('No contacts found in the table');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkContactsStructure();