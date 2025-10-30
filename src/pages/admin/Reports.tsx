import { ArrowLeft, BarChart3, FileText, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Reports() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-gray-100" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports</h1>
            <p className="text-sm text-gray-700 dark:text-gray-400 mt-1">
              Generate and schedule system reports and analytics
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-8 shadow-sm dark:shadow-none">
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <BarChart3 className="w-16 h-16 text-violet-600 dark:text-violet-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Report Generation</h2>
            <p className="text-gray-700 dark:text-gray-400 max-w-md">
              System reports and analytics generation will be available here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}