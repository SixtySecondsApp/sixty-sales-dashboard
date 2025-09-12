import { ArrowLeft, BarChart3, FileText, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Reports() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Reports</h1>
              <p className="text-sm text-gray-400 mt-1">
                Generate and schedule system reports and analytics
              </p>
            </div>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-8">
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <BarChart3 className="w-16 h-16 text-violet-500 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Report Generation</h2>
              <p className="text-gray-400 max-w-md">
                System reports and analytics generation will be available here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}