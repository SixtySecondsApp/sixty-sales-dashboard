# Testing API Name Functionality

## Manual Testing Steps

### 1. Database Verification
Run `verify_api_name_works.sql` in Supabase SQL Editor to verify:
- ✅ Column exists
- ✅ Index exists
- ✅ All sources have api_name populated
- ✅ No duplicates
- ✅ Format is correct

### 2. UI Testing - View Existing Sources

1. Navigate to `/admin/booking-sources`
2. Check that the table displays:
   - Name column (with icon)
   - **API Name column** (in monospace code format)
   - Category, Icon, Sort Order, Status, Actions
3. Verify all existing sources show their `api_name` in the table

### 3. UI Testing - Edit Existing Source

1. Click "Edit" on an existing source (e.g., "Facebook Ads")
2. Verify:
   - ✅ Name field is populated
   - ✅ **API Name field is populated** (e.g., "facebook_ads")
   - ✅ API name field is in monospace font
   - ✅ API name does NOT auto-change when you edit the name
3. Try to change API name to invalid format (e.g., "Facebook Ads")
   - ✅ Should show error: "API name must be lowercase with underscores only"
4. Change API name to valid format (e.g., "fb_ads")
5. Save
   - ✅ Should save successfully
   - ✅ Table should show updated api_name

### 4. UI Testing - Create New Source

1. Click "Add Source"
2. Type name: "Test Source"
3. Verify:
   - ✅ API Name auto-generates to "test_source"
   - ✅ API name field is editable
4. Try invalid API name formats:
   - "Test Source" → Should auto-correct to "test_source"
   - "test-source" → Should auto-correct to "test_source"
   - "TEST_SOURCE" → Should auto-correct to "test_source"
5. Try to save without API name:
   - ✅ Should show error: "API name is required"
6. Fill in all required fields and save:
   - ✅ Should create successfully
   - ✅ New source appears in table with correct api_name

### 5. API Testing - Query by api_name

Test in browser console or API client:

```typescript
// Test query by api_name
const { data, error } = await supabase
  .from('booking_sources')
  .select('*')
  .eq('api_name', 'facebook_ads')
  .single();

console.log(data); // Should return Facebook Ads source
```

### 6. Edge Cases

1. **Duplicate API Name**:
   - Try to create two sources with same api_name
   - ✅ Should show error: "A source with this API name already exists"

2. **Special Characters in Name**:
   - Create source: "Test & Demo (2024)"
   - ✅ API name should auto-generate to "test_demo_2024"

3. **Empty/Whitespace**:
   - Try to save with only spaces in api_name
   - ✅ Should be trimmed and validated

## Expected Results

✅ All existing sources have api_name populated  
✅ UI displays api_name in table  
✅ Auto-generation works for new sources  
✅ API name stays stable when editing existing sources  
✅ Validation prevents invalid formats  
✅ Database constraints prevent duplicates  
✅ Queries by api_name work correctly  

## Issues to Watch For

❌ If api_name column doesn't exist → Run migration  
❌ If api_name is NULL for existing sources → Run UPDATE statement  
❌ If validation doesn't work → Check regex pattern  
❌ If auto-generation doesn't work → Check generateApiName function  


