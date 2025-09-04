import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TestTube,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trophy,
  Target,
  Zap,
  Clock,
  Activity,
  TrendingUp,
  Award,
  Shield,
  Star,
  Flame,
  Settings,
  Info,
  ChevronRight
} from 'lucide-react';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  completed: boolean;
  passed: boolean;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: any;
  unlocked: boolean;
  progress: number;
  total: number;
}

interface TestingLabProps {
  workflow: any;
}

const TestingLab: React.FC<TestingLabProps> = ({ workflow }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState({
    level: 3,
    xp: 750,
    nextLevelXp: 1000,
    totalPoints: 2450,
    testsRun: 42,
    successRate: 88,
    streak: 5
  });
  
  const [scenarios] = useState<TestScenario[]>([
    {
      id: '1',
      name: 'Basic Trigger Test',
      description: 'Test if the workflow triggers correctly',
      difficulty: 'easy',
      points: 10,
      completed: true,
      passed: true
    },
    {
      id: '2',
      name: 'Condition Validation',
      description: 'Verify all conditions work as expected',
      difficulty: 'medium',
      points: 25,
      completed: true,
      passed: true
    },
    {
      id: '3',
      name: 'Action Execution',
      description: 'Ensure actions execute properly',
      difficulty: 'easy',
      points: 15,
      completed: false,
      passed: false
    },
    {
      id: '4',
      name: 'Edge Case Handling',
      description: 'Test workflow with edge cases',
      difficulty: 'hard',
      points: 50,
      completed: false,
      passed: false
    },
    {
      id: '5',
      name: 'Performance Test',
      description: 'Verify workflow performance under load',
      difficulty: 'hard',
      points: 75,
      completed: false,
      passed: false
    }
  ]);
  
  const [achievements] = useState<Achievement[]>([
    {
      id: '1',
      name: 'First Steps',
      description: 'Run your first test',
      icon: Trophy,
      unlocked: true,
      progress: 1,
      total: 1
    },
    {
      id: '2',
      name: 'Bug Hunter',
      description: 'Find 10 issues',
      icon: Target,
      unlocked: false,
      progress: 7,
      total: 10
    },
    {
      id: '3',
      name: 'Perfect Score',
      description: 'Pass all tests in a workflow',
      icon: Star,
      unlocked: false,
      progress: 3,
      total: 5
    },
    {
      id: '4',
      name: 'Speed Runner',
      description: 'Complete 5 tests in under 1 minute',
      icon: Zap,
      unlocked: true,
      progress: 5,
      total: 5
    },
    {
      id: '5',
      name: 'Stress Tester',
      description: 'Run 100 total tests',
      icon: Shield,
      unlocked: false,
      progress: 42,
      total: 100
    }
  ]);

  const runTest = async (scenario: TestScenario) => {
    setIsRunning(true);
    setCurrentTest(scenario.id);
    
    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const passed = Math.random() > 0.3;
    const result = {
      id: Date.now().toString(),
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed,
      executionTime: Math.floor(Math.random() * 500) + 100,
      timestamp: new Date().toISOString()
    };
    
    setTestResults(prev => [result, ...prev]);
    
    // Update player stats
    if (passed) {
      setPlayerStats(prev => ({
        ...prev,
        xp: prev.xp + scenario.points,
        totalPoints: prev.totalPoints + scenario.points,
        testsRun: prev.testsRun + 1,
        streak: prev.streak + 1
      }));
    } else {
      setPlayerStats(prev => ({
        ...prev,
        testsRun: prev.testsRun + 1,
        streak: 0
      }));
    }
    
    setIsRunning(false);
    setCurrentTest(null);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'hard': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const xpProgress = (playerStats.xp / playerStats.nextLevelXp) * 100;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Testing Laboratory</h2>
            <p className="text-gray-400">Test your workflows and earn achievements</p>
          </div>
          
          {/* Player Level */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#37bd7e] to-purple-600 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{playerStats.level}</span>
                </div>
                {playerStats.streak > 3 && (
                  <Flame className="absolute -top-1 -right-1 w-6 h-6 text-orange-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Level {playerStats.level} Tester</p>
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#37bd7e] to-blue-500 transition-all duration-500"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{playerStats.xp}/{playerStats.nextLevelXp} XP</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Total Points</p>
              <p className="text-xl font-bold text-[#37bd7e]">{playerStats.totalPoints}</p>
            </div>
            <Trophy className="w-6 h-6 text-[#37bd7e]" />
          </div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Tests Run</p>
              <p className="text-xl font-bold text-blue-400">{playerStats.testsRun}</p>
            </div>
            <Activity className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Success Rate</p>
              <p className="text-xl font-bold text-purple-400">{playerStats.successRate}%</p>
            </div>
            <TrendingUp className="w-6 h-6 text-purple-400" />
          </div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Current Streak</p>
              <p className="text-xl font-bold text-orange-400">{playerStats.streak}</p>
            </div>
            <Flame className="w-6 h-6 text-orange-400" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Test Scenarios */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Test Scenarios</h3>
          
          {!workflow ? (
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-8 text-center">
              <TestTube className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Select a workflow to start testing</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scenarios.map((scenario) => (
                <motion.div
                  key={scenario.id}
                  whileHover={{ scale: 1.01 }}
                  className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4 hover:border-[#37bd7e]/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        scenario.completed
                          ? scenario.passed ? 'bg-green-600/20' : 'bg-red-600/20'
                          : 'bg-gray-700'
                      }`}>
                        {scenario.completed ? (
                          scenario.passed ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )
                        ) : (
                          <TestTube className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium">{scenario.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(scenario.difficulty)}`}>
                            {scenario.difficulty}
                          </span>
                          <span className="text-xs text-gray-500">+{scenario.points} pts</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{scenario.description}</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => runTest(scenario)}
                      disabled={isRunning}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                        isRunning && currentTest === scenario.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#37bd7e] hover:bg-[#37bd7e]/90 text-white'
                      } ${isRunning && currentTest !== scenario.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isRunning && currentTest === scenario.id ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Run Test
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          
          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Results</h3>
              <div className="space-y-2">
                {testResults.slice(0, 5).map((result) => (
                  <div
                    key={result.id}
                    className="bg-gray-800/30 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {result.passed ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <p className="text-sm text-white">{result.scenarioName}</p>
                        <p className="text-xs text-gray-400">{result.executionTime}ms</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${
                      result.passed ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {result.passed ? 'Passed' : 'Failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Achievements */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Achievements</h3>
          <div className="space-y-3">
            {achievements.map((achievement) => {
              const Icon = achievement.icon;
              const progress = (achievement.progress / achievement.total) * 100;
              
              return (
                <div
                  key={achievement.id}
                  className={`bg-gray-900/50 backdrop-blur-xl border rounded-lg p-4 transition-all ${
                    achievement.unlocked
                      ? 'border-[#37bd7e]/30'
                      : 'border-gray-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      achievement.unlocked
                        ? 'bg-[#37bd7e]/20'
                        : 'bg-gray-700'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        achievement.unlocked ? 'text-[#37bd7e]' : 'text-gray-500'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-sm font-medium ${
                        achievement.unlocked ? 'text-white' : 'text-gray-400'
                      }`}>
                        {achievement.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">{achievement.description}</p>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                          <span>{achievement.progress}/{achievement.total}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              achievement.unlocked
                                ? 'bg-[#37bd7e]'
                                : 'bg-gray-600'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Tips */}
          <div className="mt-6 p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-1">Pro Tip</h4>
                <p className="text-xs text-gray-300">
                  Run tests in sequence to build up your streak multiplier and earn bonus points!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestingLab;