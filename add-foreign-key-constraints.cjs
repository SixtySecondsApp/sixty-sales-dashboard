const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function addForeignKeyConstraints() {
  console.log('Adding foreign key constraints to meetings table...');

  const constraints = [
    {
      name: 'fk_meetings_created_by',
      sql: `ALTER TABLE meetings ADD CONSTRAINT fk_meetings_created_by FOREIGN KEY (created_by) REFERENCES profiles(id);`
    },
    {
      name: 'fk_meetings_deal_id',
      sql: `ALTER TABLE meetings ADD CONSTRAINT fk_meetings_deal_id FOREIGN KEY (deal_id) REFERENCES deals(id);`
    },
    {
      name: 'fk_meetings_company_id', 
      sql: `ALTER TABLE meetings ADD CONSTRAINT fk_meetings_company_id FOREIGN KEY (company_id) REFERENCES companies(id);`
    },
    {
      name: 'fk_meetings_contact_id',
      sql: `ALTER TABLE meetings ADD CONSTRAINT fk_meetings_contact_id FOREIGN KEY (contact_id) REFERENCES contacts(id);`
    }
  ];

  for (const constraint of constraints) {
    try {
      console.log(`Adding constraint: ${constraint.name}`);
      
      // Try to execute raw SQL using rpc
      const { data, error } = await supabase.rpc('exec', {
        sql: constraint.sql
      });

      if (error) {
        console.log(`Error adding ${constraint.name}:`, error.message);
        if (error.message.includes('already exists')) {
          console.log(`Constraint ${constraint.name} already exists - skipping`);
        }
      } else {
        console.log(`Successfully added constraint: ${constraint.name}`);
      }
    } catch (err) {
      console.log(`Exception adding ${constraint.name}:`, err.message);
    }
  }

  // Test if relationships now work
  console.log('\nTesting relationship...');
  try {
    const { data, error } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        profiles:created_by(id, first_name, last_name)
      `)
      .limit(1);

    if (error) {
      console.log('Relationship test error:', error);
    } else {
      console.log('Relationship test successful:', data);
    }
  } catch (err) {
    console.log('Relationship test exception:', err.message);
  }
}

addForeignKeyConstraints().then(() => {
  console.log('Foreign key constraint process complete');
  process.exit(0);
}).catch(err => {
  console.error('Process failed:', err);
  process.exit(1);
});