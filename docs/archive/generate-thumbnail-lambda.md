import json
import subprocess
import os
import tempfile
import boto3
import logging
import uuid
import hashlib
from urllib.parse import urlparse, quote
from datetime import datetime
from PIL import Image

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    """
    Generate a thumbnail from a Fathom video share URL.

    Expected event:
    {
        "fathom_url": "https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf",
        "timestamp": "00:00:10",  # Optional, default is 10 seconds
        "width": 1280,            # Optional, default is 1280
        "height": 720,            # Optional, default is 720
        "output_bucket": "my-bucket",  # Optional S3 bucket for output
        "output_key": "thumbnails/thumb.jpg"  # Optional S3 key
    }
    """
    try:
        # Parse the request body - handle both direct invocation and HTTP API
        if 'body' in event and isinstance(event['body'], str):
            # HTTP API event - body is a JSON string
            try:
                body = json.loads(event['body'])
            except (json.JSONDecodeError, TypeError):
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'Invalid JSON in request body'})
                }
        else:
            # Direct invocation or parsed body
            body = event

        # Extract parameters from body
        fathom_url = body.get('fathom_url')
        if not fathom_url:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'fathom_url is required'})
            }

        timestamp = body.get('timestamp', '00:00:10')
        width = body.get('width', 1280)
        height = body.get('height', 720)
        output_bucket = body.get('output_bucket') or os.environ.get('OUTPUT_BUCKET')

        # Generate unique filename using timestamp and UUID
        unique_id = str(uuid.uuid4())[:8]
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_key = f"thumbnails/{timestamp_str}_{unique_id}.jpg"

        # Validate and transform the Fathom URL
        video_url = transform_fathom_url(fathom_url)
        logger.info(f"Transformed URL: {video_url}")

        # Create temporary directory for output
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = os.path.join(temp_dir, 'thumb.jpg')

            # Run ffmpeg to extract thumbnail
            # Apply darkening filter: brightness -0.15 (darkens by ~15%)
            ffmpeg_cmd = [
                '/opt/ffmpeg',
                '-ss', timestamp,
                '-i', video_url,
                '-frames:v', '1',
                '-vf', f'scale={width}:{height}:force_original_aspect_ratio=decrease,eq=brightness=-0.15',
                '-y',  # Overwrite output file
                output_path
            ]

            logger.info(f"Running ffmpeg command: {' '.join(ffmpeg_cmd)}")

            result = subprocess.run(
                ffmpeg_cmd,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                logger.error(f"FFmpeg error: {result.stderr}")
                return {
                    'statusCode': 500,
                    'body': json.dumps({'error': f'FFmpeg failed: {result.stderr}'})
                }

            # Read the generated thumbnail
            with open(output_path, 'rb') as f:
                thumbnail_data = f.read()

            # If output bucket is specified, upload to S3
            s3_url = None
            http_url = None
            if output_bucket:
                try:
                    s3_client.put_object(
                        Bucket=output_bucket,
                        Key=output_key,
                        Body=thumbnail_data,
                        ContentType='image/jpeg'
                    )
                    s3_url = f"s3://{output_bucket}/{output_key}"
                    # Generate HTTP URL for public access
                    http_url = f"https://{output_bucket}.s3.eu-west-2.amazonaws.com/{output_key}"
                    logger.info(f"Uploaded thumbnail to {s3_url}")
                    logger.info(f"Public HTTP URL: {http_url}")
                except Exception as e:
                    logger.error(f"Failed to upload to S3: {str(e)}")
                    return {
                        'statusCode': 500,
                        'body': json.dumps({'error': f'S3 upload failed: {str(e)}'})
                    }

            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Thumbnail generated successfully',
                    'thumbnail_size': len(thumbnail_data),
                    's3_location': s3_url,
                    'http_url': http_url,
                    'fathom_url': fathom_url,
                    'video_url': video_url
                })
            }

    except subprocess.TimeoutExpired:
        logger.error("FFmpeg process timed out")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'FFmpeg process timed out'})
        }
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': f'Unexpected error: {str(e)}'})
        }

def transform_fathom_url(fathom_url):
    """
    Transform a Fathom share URL to the m3u8 video URL format.

    Input:  https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf
    Output: https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf/video.m3u8
    """
    # Remove trailing slashes
    fathom_url = fathom_url.rstrip('/')

    # Check if URL already has /video.m3u8
    if fathom_url.endswith('/video.m3u8'):
        return fathom_url

    # Add /video.m3u8
    return f"{fathom_url}/video.m3u8"
