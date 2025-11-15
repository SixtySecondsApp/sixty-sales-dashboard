import { createClient } from '@supabase/supabase-js';

// Check the actual schema of the deals table
async function checkDealsSchema() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  try {
    // Get a sample deal to see what columns exist
    const { data: deals, error } = await supabase
      .from('deals')
      .select('*')
      .limit(1);
    
    if (error) {
      return;
    }
    
    if (deals && deals.length > 0) {
      const columns = Object.keys(deals[0]).sort();
             columns.forEach((column, index) => {
       });
      if (columns.includes('expected_close_date')) {
      } else {
        // Check for similar columns
        const dateColumns = columns.filter(col => 
          col.includes('date') || col.includes('close')
        );
        if (dateColumns.length > 0) {
          dateColumns.forEach(col => {
          });
        }
      }
    } else {
    }

    // Try to get table info using raw SQL query if possible
    try {
      const { data: columns, error: schemaError } = await supabase
        .rpc('sql', {
          query: `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'deals' 
            ORDER BY ordinal_position;
          `
        });
      
      if (schemaError) {
      } else if (columns) {
        columns.forEach(col => {
        });
      }
    } catch (rpcError) {
    }
    
  } catch (error) {
  }
}

// Run the check
checkDealsSchema(); 