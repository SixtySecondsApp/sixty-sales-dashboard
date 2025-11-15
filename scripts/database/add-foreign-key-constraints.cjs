const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function addForeignKeyConstraints() {
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
      // Try to execute raw SQL using rpc
      const { data, error } = await supabase.rpc('exec', {
        sql: constraint.sql
      });

      if (error) {
        if (error.message.includes('already exists')) {
        }
      } else {
      }
    } catch (err) {
    }
  }

  // Test if relationships now work
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
    } else {
    }
  } catch (err) {
  }
}

addForeignKeyConstraints().then(() => {
  process.exit(0);
}).catch(err => {
  process.exit(1);
});