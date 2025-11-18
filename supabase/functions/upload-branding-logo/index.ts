import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { S3Client } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadRequest {
  image_data: string // base64 encoded image
  file_name: string // e.g., "lightLogo-1234567890.png"
  type: 'lightLogo' | 'darkLogo' | 'icon'
}

/**
 * Upload Branding Logo Edge Function
 * 
 * Uploads branding logos (light mode, dark mode, icon) to S3 in the "erg logos" folder.
 * 
 * Required Environment Variables:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_S3_BUCKET (S3 bucket name)
 * - AWS_REGION (optional, defaults to eu-west-2)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image_data, file_name, type }: UploadRequest = await req.json()
    
    if (!image_data || !file_name || !type) {
      return new Response(
        JSON.stringify({ error: 'image_data, file_name, and type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate type
    if (!['lightLogo', 'darkLogo', 'icon'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be lightLogo, darkLogo, or icon' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // S3 configuration
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
    const awsRegion = Deno.env.get('AWS_REGION') || 'eu-west-2'
    const awsBucket = Deno.env.get('AWS_S3_BUCKET') || 'user-upload'

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      return new Response(
        JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert base64 to buffer
    const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

    // Determine content type from file extension
    const fileExt = file_name.split('.').pop()?.toLowerCase()
    let contentType = 'image/png'
    if (fileExt === 'jpg' || fileExt === 'jpeg') {
      contentType = 'image/jpeg'
    } else if (fileExt === 'svg') {
      contentType = 'image/svg+xml'
    } else if (fileExt === 'gif') {
      contentType = 'image/gif'
    } else if (fileExt === 'webp') {
      contentType = 'image/webp'
    }

    // S3 file path: erg logos/{type}/{file_name}
    const s3Key = `erg logos/${type}/${file_name}`
    
    const s3Client = new S3Client({
      endPoint: `s3.${awsRegion}.amazonaws.com`,
      region: awsRegion,
      accessKey: awsAccessKeyId,
      secretKey: awsSecretAccessKey,
      bucket: awsBucket,
      useSSL: true,
    })

    // Upload to S3
    await s3Client.putObject(s3Key, imageBuffer, {
      metadata: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })

    // Construct public S3 URL
    const s3Url = `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/${s3Key}`

    return new Response(
      JSON.stringify({ 
        success: true,
        url: s3Url,
        type: type,
        file_name: file_name
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

