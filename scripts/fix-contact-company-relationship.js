import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

// Supabase client with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Direct database client
const dbUrl = process.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL;
const client = new Client({
  connectionString: dbUrl,
});

async function fixContactCompanyRelationship() {
  try {
    console.log('🔧 Checking and fixing contact-company relationship...');
    
    await client.connect();
    
    // Step 1: Check if companies table exists
    console.log('\n📊 Checking if companies table exists...');
    const companiesExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'companies'
      );
    `);
    
    if (!companiesExists.rows[0].exists) {
      console.log('❌ Companies table does not exist. Creating it...');
      
      const createCompaniesTable = `
        CREATE TABLE companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          domain TEXT UNIQUE,
          industry TEXT,
          size TEXT CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
          website TEXT,
          address TEXT,
          phone TEXT,
          description TEXT,
          linkedin_url TEXT,
          owner_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX idx_companies_domain ON companies(domain);
        CREATE INDEX idx_companies_name ON companies(name);
        CREATE INDEX idx_companies_owner_id ON companies(owner_id);
      `;
      
      await client.query(createCompaniesTable);
      console.log('✅ Companies table created');
    } else {
      console.log('✅ Companies table exists');
    }

    // Step 2: Check if contacts table has company_id column
    console.log('\n🔍 Checking contacts table structure...');
    const contactsColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      AND table_schema = 'public'
      AND column_name IN ('company_id', 'full_name', 'title', 'linkedin_url', 'is_primary', 'owner_id');
    `);
    
    console.table(contactsColumns.rows);
    
    const hasCompanyId = contactsColumns.rows.some(col => col.column_name === 'company_id');
    
    if (!hasCompanyId) {
      console.log('❌ Contacts table missing company_id column. Adding it...');
      
      const addContactsColumns = `
        ALTER TABLE contacts 
        ADD COLUMN IF NOT EXISTS company_id UUID,
        ADD COLUMN IF NOT EXISTS title TEXT,
        ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
        ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS owner_id UUID;

        -- Add full_name computed column if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'contacts' AND column_name = 'full_name'
          ) THEN
            ALTER TABLE contacts 
            ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
              CASE 
                WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN 
                  first_name || ' ' || last_name
                WHEN first_name IS NOT NULL THEN first_name
                WHEN last_name IS NOT NULL THEN last_name
                ELSE NULL
              END
            ) STORED;
          END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON contacts(owner_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_full_name ON contacts(full_name);
      `;
      
      await client.query(addContactsColumns);
      console.log('✅ Added missing columns to contacts table');
    } else {
      console.log('✅ Contacts table has company_id column');
    }

    // Step 3: Check and add foreign key constraint
    console.log('\n🔗 Checking foreign key relationships...');
    const foreignKeys = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'contacts'
        AND kcu.column_name = 'company_id';
    `);
    
    if (foreignKeys.rows.length === 0) {
      console.log('❌ Foreign key constraint missing. Adding it...');
      
      try {
        await client.query(`
          ALTER TABLE contacts 
          ADD CONSTRAINT fk_contacts_company_id 
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
        `);
        console.log('✅ Foreign key constraint added');
      } catch (err) {
        console.log('⚠️ Could not add foreign key constraint:', err.message);
        console.log('   This might be due to existing data inconsistencies');
      }
    } else {
      console.log('✅ Foreign key constraint exists');
      console.table(foreignKeys.rows);
    }

    // Step 4: Test the relationship with Supabase
    console.log('\n🧪 Testing Supabase relationship...');
    
    try {
      const { data: testContact, error: testError } = await supabase
        .from('contacts')
        .select(`
          *,
          companies(*)
        `)
        .limit(1)
        .single();
      
      if (testError) {
        console.log('❌ Supabase relationship test failed:', testError.message);
        console.log('   Using manual joins as fallback');
      } else {
        console.log('✅ Supabase relationship working!');
        console.log('   Sample data:', {
          contact: testContact?.email,
          company: testContact?.companies?.name
        });
      }
    } catch (err) {
      console.log('⚠️ Relationship test error:', err.message);
    }

    // Step 5: Insert some sample companies if none exist
    console.log('\n🏢 Checking if companies need sample data...');
    const { data: existingCompanies, error: companiesError } = await supabase
      .from('companies')
      .select('*', { count: 'exact' });
    
    if (!companiesError && existingCompanies && existingCompanies.length === 0) {
      console.log('🌱 Inserting sample companies...');
      
      const sampleCompanies = [
        {
          name: 'Tech Solutions Inc.',
          domain: 'techsolutions.com',
          industry: 'Technology',
          size: 'medium'
        },
        {
          name: 'ICSC Enterprise',
          domain: 'icsc.com',
          industry: 'Enterprise Software',
          size: 'large'
        },
        {
          name: 'Channel Sales Pro',
          domain: 'channelsales.com',
          industry: 'Sales',
          size: 'small'
        }
      ];
      
      const { error: insertError } = await supabase
        .from('companies')
        .insert(sampleCompanies);
      
      if (insertError) {
        console.log('❌ Failed to insert sample companies:', insertError.message);
      } else {
        console.log('✅ Sample companies inserted');
      }
    }

    console.log('\n🎉 Relationship check and fix complete!');
    console.log('💡 If the issue persists, try:');
    console.log('   1. Restart your development server');
    console.log('   2. Clear browser cache');
    console.log('   3. Check Supabase dashboard for schema refresh');
    
  } catch (error) {
    console.error('❌ Fix script failed:', error);
  } finally {
    await client.end();
  }
}

// Run the fix
fixContactCompanyRelationship(); 