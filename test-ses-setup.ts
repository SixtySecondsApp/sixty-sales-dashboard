/**
 * Test AWS SES Setup
 * 
 * Verifies AWS SES configuration and credentials
 * Run with: deno run --allow-net --allow-env test-ses-setup.ts
 */

import { crypto } from 'https://deno.land/std@0.190.0/crypto/mod.ts';

const AWS_REGION = Deno.env.get('AWS_REGION') || 'eu-west-2';
const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');

/**
 * Create HMAC-SHA256 signature
 */
async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(data)
  );
  return new Uint8Array(signature);
}

/**
 * Create SHA-256 hash
 */
async function sha256(data: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(data)
  );
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert bytes to hex string
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * AWS Signature V4 signing
 */
async function signAWSRequest(
  method: string,
  url: URL,
  body: string,
  region: string,
  service: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<Headers> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  
  const host = url.host;
  const canonicalUri = url.pathname;
  const canonicalQueryString = '';
  
  const payloadHash = await sha256(body);
  
  const canonicalHeaders = 
    `content-type:application/x-www-form-urlencoded\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n`;
  
  const signedHeaders = 'content-type;host;x-amz-date';
  
  const canonicalRequest = 
    `${method}\n` +
    `${canonicalUri}\n` +
    `${canonicalQueryString}\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  
  const stringToSign = 
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${await sha256(canonicalRequest)}`;
  
  // Create signing key
  const kDate = await hmacSha256(
    new TextEncoder().encode('AWS4' + secretAccessKey),
    dateStamp
  );
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  
  // Create signature
  const signature = toHex(await hmacSha256(kSigning, stringToSign));
  
  const authorizationHeader = 
    `${algorithm} ` +
    `Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;
  
  const headers = new Headers();
  headers.set('Content-Type', 'application/x-www-form-urlencoded');
  headers.set('Host', host);
  headers.set('X-Amz-Date', amzDate);
  headers.set('Authorization', authorizationHeader);
  
  return headers;
}

/**
 * Test 1: Check AWS credentials are set
 */
function testCredentials(): { success: boolean; message: string } {
  if (!AWS_ACCESS_KEY_ID) {
    return { success: false, message: '❌ AWS_ACCESS_KEY_ID is not set' };
  }
  if (!AWS_SECRET_ACCESS_KEY) {
    return { success: false, message: '❌ AWS_SECRET_ACCESS_KEY is not set' };
  }
  return { 
    success: true, 
    message: `✅ AWS credentials configured (Region: ${AWS_REGION}, Access Key: ${AWS_ACCESS_KEY_ID.substring(0, 8)}...)` 
  };
}

/**
 * Test 2: Get SES account sending quota and statistics
 */
async function testSESAccountStatus(): Promise<{ success: boolean; message: string; data?: any }> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return { success: false, message: 'AWS credentials not configured' };
  }

  const url = new URL(`https://email.${AWS_REGION}.amazonaws.com/`);
  
  const params = new URLSearchParams();
  params.set('Action', 'GetSendQuota');
  params.set('Version', '2010-12-01');
  
  const body = params.toString();
  
  const headers = await signAWSRequest(
    'POST',
    url,
    body,
    AWS_REGION,
    'ses',
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY
  );
  
  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body,
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      return { 
        success: false, 
        message: `❌ SES API Error (${response.status}): ${responseText.substring(0, 200)}` 
      };
    }
    
    // Parse XML response
    const max24HourSendMatch = responseText.match(/<Max24HourSend>([^<]+)<\/Max24HourSend>/);
    const maxSendRateMatch = responseText.match(/<MaxSendRate>([^<]+)<\/MaxSendRate>/);
    const sentLast24HoursMatch = responseText.match(/<SentLast24Hours>([^<]+)<\/SentLast24Hours>/);
    
    const quota = {
      max24HourSend: max24HourSendMatch ? max24HourSendMatch[1] : 'unknown',
      maxSendRate: maxSendRateMatch ? maxSendRateMatch[1] : 'unknown',
      sentLast24Hours: sentLast24HoursMatch ? sentLast24HoursMatch[1] : 'unknown',
    };
    
    return { 
      success: true, 
      message: `✅ SES Account Status:\n   - Max 24h Send: ${quota.max24HourSend}\n   - Max Send Rate: ${quota.maxSendRate}/sec\n   - Sent Last 24h: ${quota.sentLast24Hours}`,
      data: quota
    };
  } catch (error) {
    return { 
      success: false, 
      message: `❌ Failed to connect to SES: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Test 3: Verify email address (if in sandbox mode)
 */
async function testVerifyEmailAddress(email: string): Promise<{ success: boolean; message: string }> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return { success: false, message: 'AWS credentials not configured' };
  }

  const url = new URL(`https://email.${AWS_REGION}.amazonaws.com/`);
  
  const params = new URLSearchParams();
  params.set('Action', 'GetIdentityVerificationAttributes');
  params.set('Version', '2010-12-01');
  params.set('Identities.member.1', email);
  
  const body = params.toString();
  
  const headers = await signAWSRequest(
    'POST',
    url,
    body,
    AWS_REGION,
    'ses',
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY
  );
  
  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body,
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      return { 
        success: false, 
        message: `❌ Failed to check verification status: ${responseText.substring(0, 200)}` 
      };
    }
    
    // Check if email is verified
    const verificationStatusMatch = responseText.match(/<VerificationStatus>([^<]+)<\/VerificationStatus>/);
    const status = verificationStatusMatch ? verificationStatusMatch[1] : 'unknown';
    
    if (status === 'Success') {
      return { success: true, message: `✅ Email ${email} is verified` };
    } else if (status === 'Pending') {
      return { success: false, message: `⚠️ Email ${email} verification is pending (check your email)` };
    } else {
      return { success: false, message: `❌ Email ${email} is not verified (Status: ${status})` };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `❌ Failed to check verification: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🧪 Testing AWS SES Setup\n');
  console.log('='.repeat(50));
  
  // Test 1: Credentials
  console.log('\n1️⃣ Checking AWS Credentials...');
  const credTest = testCredentials();
  console.log(credTest.message);
  
  if (!credTest.success) {
    console.log('\n❌ Cannot proceed without AWS credentials');
    Deno.exit(1);
  }
  
  // Test 2: SES Account Status
  console.log('\n2️⃣ Checking SES Account Status...');
  const statusTest = await testSESAccountStatus();
  console.log(statusTest.message);
  
  // Test 3: Verify sender email
  console.log('\n3️⃣ Checking Sender Email Verification...');
  const senderEmail = 'app@use60.com';
  const verifyTest = await testVerifyEmailAddress(senderEmail);
  console.log(verifyTest.message);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Summary:');
  console.log(`   Credentials: ${credTest.success ? '✅' : '❌'}`);
  console.log(`   SES Status: ${statusTest.success ? '✅' : '❌'}`);
  console.log(`   Email Verified: ${verifyTest.success ? '✅' : '⚠️'}`);
  
  if (credTest.success && statusTest.success) {
    console.log('\n✅ SES setup is working! You can send emails.');
    if (!verifyTest.success) {
      console.log('⚠️ Note: If your account is in sandbox mode, you must verify recipient emails too.');
    }
  } else {
    console.log('\n❌ SES setup has issues. Please check the errors above.');
    Deno.exit(1);
  }
}

// Run tests
if (import.meta.main) {
  main().catch(console.error);
}
