export default function handler(request, response) {
  return response.status(200).json({
    message: 'API is working',
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method
  });
} 