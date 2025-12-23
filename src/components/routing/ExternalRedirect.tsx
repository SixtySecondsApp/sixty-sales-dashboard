import { useEffect } from 'react';

interface ExternalRedirectProps {
  url: string;
}

/**
 * ExternalRedirect - Redirects to an external URL
 * Used for routing to external services like Google Calendar, Gmail, etc.
 */
export const ExternalRedirect: React.FC<ExternalRedirectProps> = ({ url }) => {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      <p className="text-gray-500">Redirecting to Google...</p>
    </div>
  );
};

export default ExternalRedirect;
