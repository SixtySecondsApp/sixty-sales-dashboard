import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface SettingsPageWrapperProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function SettingsPageWrapper({
  title,
  description,
  children,
}: SettingsPageWrapperProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/settings')}
            className="group -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Settings
          </Button>

          {/* Page Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1E293B] dark:text-white">
              {title}
            </h1>
            <p className="text-[#64748B] dark:text-gray-400 mt-2">
              {description}
            </p>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800/50 rounded-xl p-6 sm:p-8 backdrop-blur-xl">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
