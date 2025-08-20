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

async function populateContactNames() {
  try {
    console.log('Fetching contacts with missing first_name/last_name...');
    
    // Get all contacts where first_name or last_name is null but full_name exists
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, full_name, first_name, last_name')
      .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.')
      .not('full_name', 'is', null)
      .not('full_name', 'eq', '');
    
    if (fetchError) {
      console.error('Error fetching contacts:', fetchError);
      return;
    }
    
    console.log(`Found ${contacts?.length || 0} contacts to update`);
    
    if (!contacts || contacts.length === 0) {
      console.log('No contacts need updating');
      return;
    }
    
    // Update each contact
    for (const contact of contacts) {
      if (!contact.full_name) continue;
      
      const nameParts = contact.full_name.split(' ').filter(p => p.length > 0);
      let firstName = contact.first_name || '';
      let lastName = contact.last_name || '';
      
      if (nameParts.length > 0 && !firstName) {
        firstName = nameParts[0];
      }
      
      if (nameParts.length > 1 && !lastName) {
        lastName = nameParts.slice(1).join(' ');
      }
      
      if (firstName || lastName) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ 
            first_name: firstName || null,
            last_name: lastName || null
          })
          .eq('id', contact.id);
        
        if (updateError) {
          console.error(`Error updating contact ${contact.id}:`, updateError);
        } else {
          console.log(`Updated contact ${contact.id}: ${firstName} ${lastName}`);
        }
      }
    }
    
    // Also update contacts that have first_name/last_name but no full_name
    console.log('\nUpdating full_name for contacts with first_name/last_name...');
    
    const { data: contactsWithNames, error: fetchError2 } = await supabase
      .from('contacts')
      .select('id, full_name, first_name, last_name')
      .or('full_name.is.null,full_name.eq.')
      .or('first_name.neq.,last_name.neq.');
    
    if (fetchError2) {
      console.error('Error fetching contacts:', fetchError2);
      return;
    }
    
    console.log(`Found ${contactsWithNames?.length || 0} contacts to update full_name`);
    
    for (const contact of contactsWithNames || []) {
      if (contact.full_name) continue;
      
      const fullName = [contact.first_name, contact.last_name]
        .filter(n => n && n.length > 0)
        .join(' ')
        .trim();
      
      if (fullName && fullName !== contact.full_name) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ full_name: fullName })
          .eq('id', contact.id);
        
        if (updateError) {
          console.error(`Error updating contact ${contact.id}:`, updateError);
        } else {
          console.log(`Updated contact ${contact.id} full_name: ${fullName}`);
        }
      }
    }
    
    console.log('\nMigration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

populateContactNames();