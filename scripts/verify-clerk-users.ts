/**
 * Script to verify all existing Clerk users' email addresses
 *
 * This is needed because users were migrated/created without going through
 * the normal email verification flow, and Clerk requires verified emails.
 *
 * Usage: npx tsx scripts/verify-clerk-users.ts
 */

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'sk_test_Hkz302OhvczwM5caN2Ionvsw95AHS3lWkl1OaVshvQ';
const CLERK_API_BASE = 'https://api.clerk.com/v1';

interface ClerkUser {
  id: string;
  email_addresses: Array<{
    id: string;
    email_address: string;
    verification: {
      status: string;
    } | null;
  }>;
  primary_email_address_id: string | null;
}

interface ClerkListResponse {
  data: ClerkUser[];
  total_count: number;
}

async function fetchAllUsers(): Promise<ClerkUser[]> {
  const users: ClerkUser[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `${CLERK_API_BASE}/users?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch users: ${response.status} - ${error}`);
    }

    const data: ClerkUser[] = await response.json();

    if (data.length === 0) break;

    users.push(...data);
    offset += limit;

    if (data.length < limit) break;
  }

  return users;
}

async function verifyEmailAddress(emailAddressId: string, emailAddress: string): Promise<boolean> {
  // First, try to prepare verification (this might not be needed but let's be safe)
  // Then attempt to verify using the admin endpoint

  const response = await fetch(
    `${CLERK_API_BASE}/email_addresses/${emailAddressId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        verified: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`  ❌ Failed to verify ${emailAddress}: ${error}`);
    return false;
  }

  return true;
}

async function main() {
  console.log('🔍 Fetching all Clerk users...\n');

  try {
    const users = await fetchAllUsers();
    console.log(`📊 Found ${users.length} users\n`);

    let verified = 0;
    let alreadyVerified = 0;
    let failed = 0;
    let noEmail = 0;

    for (const user of users) {
      const primaryEmail = user.email_addresses.find(
        (e) => e.id === user.primary_email_address_id
      );

      if (!primaryEmail) {
        console.log(`⚠️  User ${user.id}: No primary email address`);
        noEmail++;
        continue;
      }

      const isVerified = primaryEmail.verification?.status === 'verified';

      if (isVerified) {
        console.log(`✅ ${primaryEmail.email_address}: Already verified`);
        alreadyVerified++;
        continue;
      }

      console.log(`🔄 ${primaryEmail.email_address}: Verifying...`);

      const success = await verifyEmailAddress(primaryEmail.id, primaryEmail.email_address);

      if (success) {
        console.log(`  ✅ Verified successfully`);
        verified++;
      } else {
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Total users: ${users.length}`);
    console.log(`   Already verified: ${alreadyVerified}`);
    console.log(`   Newly verified: ${verified}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   No email: ${noEmail}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
