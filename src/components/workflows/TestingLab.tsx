import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  FileText,
  Database,
  Bell,
  CheckSquare
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { workflowRealtimeService } from '@/lib/services/workflowRealtimeService';
import { formatDistanceToNow } from 'date-fns';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  test_type: 'unit' | 'integration' | 'performance' | 'edge_case';
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  mockData: any;
  expectedResult?: any;
}

interface TestResult {
  id: string;
  scenario_id: string;
  workflow_id: string;
  status: 'passed' | 'failed' | 'skipped';
  execution_time_ms: number;
  actual_result?: any;
  error_message?: string;
  points_earned: number;
  executed_at: string;
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

interface PlayerStats {
  level: number;
  xp: number;
  next_level_xp: number;
  total_points: number;
  tests_run: number;
  success_rate: number;
  current_streak: number;
}

interface TestingLabProps {
  workflow: any;
}

const TestingLab: React.FC<TestingLabProps> = ({ workflow }) => {
  const { userData: user } = useUser();
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    level: 1,
    xp: 0,
    next_level_xp: 100,
    total_points: 0,
    tests_run: 0,
    success_rate: 0,
    current_streak: 0
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  // Generate test scenarios based on workflow type
  const generateTestScenarios = (): TestScenario[] => {
    if (!workflow) return [];

    const baseScenarios: TestScenario[] = [
      {
        id: 'basic_trigger',
        name: 'Basic Trigger Test',
        description: 'Test if the workflow triggers correctly with standard data',
        test_type: 'unit',
        difficulty: 'easy',
        points: 10,
        mockData: generateMockTriggerData(workflow.trigger_type, 'standard')
      },
      {
        id: 'condition_validation',
        name: 'Condition Validation',
        description: 'Verify conditions are evaluated correctly',
        test_type: 'integration',
        difficulty: 'medium',
        points: 25,
        mockData: generateMockTriggerData(workflow.trigger_type, 'conditions')
      },
      {
        id: 'action_execution',
        name: 'Action Execution',
        description: 'Ensure actions execute properly in test mode',
        test_type: 'integration',
        difficulty: 'easy',
        points: 15,
        mockData: generateMockTriggerData(workflow.trigger_type, 'actions')
      },
      {
        id: 'edge_cases',
        name: 'Edge Case Handling',
        description: 'Test with missing fields and boundary conditions',
        test_type: 'edge_case',
        difficulty: 'hard',
        points: 50,
        mockData: generateMockTriggerData(workflow.trigger_type, 'edge_cases')
      },
      {
        id: 'performance',
        name: 'Performance Test',
        description: 'Verify workflow completes within time limits',
        test_type: 'performance',
        difficulty: 'hard',
        points: 75,
        mockData: generateMockTriggerData(workflow.trigger_type, 'performance')
      }
    ];

    return baseScenarios;
  };

  const [scenarios, setScenarios] = useState<TestScenario[]>([]);

  useEffect(() => {
    if (workflow) {
      setScenarios(generateTestScenarios());
    }
    loadTestingData();
  }, [workflow]);

  const loadTestingData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load test results
      const { data: results } = await supabase
        .from('workflow_test_results')
        .select('*')
        .eq('executed_by', user.id)
        .order('executed_at', { ascending: false })
        .limit(50);

      if (results) {
        setTestResults(results.map(r => ({
          id: r.id,
          scenario_id: r.test_scenario,
          workflow_id: r.rule_id,
          status: r.status,
          execution_time_ms: r.execution_time_ms || 0,
          actual_result: r.actual_result,
          error_message: r.error_message,
          points_earned: r.points_awarded || 0,
          executed_at: r.executed_at
        })));
      }

      // Load achievements
      const { data: userAchievements } = await supabase
        .from('user_testing_achievements')
        .select('*')
        .eq('user_id', user.id);

      if (userAchievements) {
        setAchievements(userAchievements.map(a => ({
          id: a.id,
          name: a.achievement_name,
          description: a.description || '',
          icon: getAchievementIcon(a.achievement_type),
          unlocked: a.is_completed,
          progress: a.current_progress,
          total: a.required_progress
        })));
      }

      // Calculate player stats
      calculatePlayerStats(results || []);
      
    } catch (error) {
      console.error('Error loading testing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper Functions
  const generateMockTriggerData = (triggerType: string, scenario: string): any => {
    const baseData = {
      id: 'test-' + Date.now(),
      user_id: user?.id,
      created_at: new Date().toISOString()
    };

    switch (triggerType) {
      case 'deal_created':
        return {
          new: {
            ...baseData,
            company_name: scenario === 'edge_cases' ? '' : 'Test Company',
            contact_name: scenario === 'edge_cases' ? null : 'John Doe',
            stage: 'SQL',
            value: scenario === 'conditions' ? 15000 : scenario === 'edge_cases' ? -100 : 5000,
            monthly_value: scenario === 'conditions' ? 2000 : 0
          }
        };
      case 'stage_changed':
        return {
          old: { stage: 'SQL' },
          new: {
            ...baseData,
            stage: scenario === 'conditions' ? 'Opportunity' : 'Verbal',
            company_name: 'Test Company'
          }
        };
      case 'activity_created':
        return {
          new: {
            ...baseData,
            activity_type: scenario === 'conditions' ? 'meeting' : 'call',
            description: 'Test activity',
            deal_id: 'test-deal-123'
          }
        };
      case 'task_completed':
        return {
          old: { completed: false },
          new: {
            ...baseData,
            completed: true,
            title: 'Test task',
            priority: scenario === 'conditions' ? 'high' : 'medium'
          }
        };
      default:
        return { new: baseData };
    }
  };

  const getAchievementIcon = (type: string): any => {
    switch (type) {
      case 'first_test': return Trophy;
      case 'bug_hunter': return Target;
      case 'perfect_score': return Star;
      case 'speed_runner': return Zap;
      case 'stress_tester': return Shield;
      default: return Award;
    }
  };

  const calculatePlayerStats = (results: any[]) => {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.status === 'passed').length;
    const totalPoints = results.reduce((sum, r) => sum + (r.points_awarded || 0), 0);
    
    // Calculate level based on points
    const level = Math.floor(totalPoints / 100) + 1;
    const xp = totalPoints % 100;
    const nextLevelXp = 100;

    // Calculate streak
    let currentStreak = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'passed') {
        currentStreak++;
      } else {
        break;
      }
    }

    setPlayerStats({
      level,
      xp,
      next_level_xp: nextLevelXp,
      total_points: totalPoints,
      tests_run: totalTests,
      success_rate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
      current_streak: currentStreak
    });
  };

  const runTest = async (scenario: TestScenario) => {
    if (!workflow || !user) return;

    setIsRunning(true);
    setCurrentTest(scenario.id);
    
    try {
      // Execute the workflow using the execution engine
      const result = await workflowRealtimeService.testWorkflow(workflow.id, scenario.mockData);
      
      // Determine if test passed based on execution result
      const passed = result.success && !result.error_message;
      const pointsEarned = passed ? scenario.points : Math.floor(scenario.points * 0.1); // Partial points for attempts

      // Create test result record
      const testResult: TestResult = {
        id: Date.now().toString(),
        scenario_id: scenario.id,
        workflow_id: workflow.id,
        status: passed ? 'passed' : 'failed',
        execution_time_ms: result.execution_time_ms,
        actual_result: result.result_data,
        error_message: result.error_message,
        points_earned: pointsEarned,
        executed_at: new Date().toISOString()
      };

      // Save test result to database
      await supabase.from('workflow_test_results').insert({
        rule_id: workflow.id,
        template_id: workflow.template_id,
        test_scenario: scenario.id,
        test_type: scenario.test_type,
        status: testResult.status,
        execution_time_ms: testResult.execution_time_ms,
        test_data: scenario.mockData,
        expected_result: scenario.expectedResult,
        actual_result: testResult.actual_result,
        error_message: testResult.error_message,
        points_awarded: pointsEarned,
        difficulty: scenario.difficulty,
        executed_by: user.id
      });

      // Update UI state
      setTestResults(prev => [testResult, ...prev]);

      // Update achievements and player stats
      await updateAchievements(testResult);
      await loadTestingData(); // Refresh all data

      console.log(`🧪 Test ${passed ? 'PASSED' : 'FAILED'}: ${scenario.name}`, result);

    } catch (error) {
      console.error('Test execution failed:', error);
      
      const testResult: TestResult = {
        id: Date.now().toString(),
        scenario_id: scenario.id,
        workflow_id: workflow.id,
        status: 'failed',
        execution_time_ms: 0,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        points_earned: 0,
        executed_at: new Date().toISOString()
      };

      setTestResults(prev => [testResult, ...prev]);
    } finally {
      setIsRunning(false);
      setCurrentTest(null);
    }
  };

  const updateAchievements = async (testResult: TestResult) => {
    if (!user) return;

    // Check and update various achievements
    const achievementUpdates = [];

    // First test achievement
    if (playerStats.tests_run === 0) {
      achievementUpdates.push({
        user_id: user.id,
        achievement_type: 'first_test',
        achievement_name: 'First Steps',
        description: 'Run your first test',
        current_progress: 1,
        required_progress: 1,
        is_completed: true,
        points_awarded: 50,
        earned_at: new Date().toISOString()
      });
    }

    // Perfect score achievement
    const recentResults = testResults.slice(0, 5);
    if (recentResults.length === 5 && recentResults.every(r => r.status === 'passed')) {
      achievementUpdates.push({
        user_id: user.id,
        achievement_type: 'perfect_score',
        achievement_name: 'Perfect Score',
        description: 'Pass 5 tests in a row',
        current_progress: 5,
        required_progress: 5,
        is_completed: true,
        points_awarded: 100
      });
    }

    // Save achievements
    for (const achievement of achievementUpdates) {
      await supabase
        .from('user_testing_achievements')
        .upsert(achievement, { onConflict: 'user_id,achievement_type' });
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'hard': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]"></div>
      </div>
    );
  }

  const xpProgress = (playerStats.xp / playerStats.next_level_xp) * 100;

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
                {playerStats.current_streak > 3 && (
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
                <p className="text-xs text-gray-500 mt-1">{playerStats.xp}/{playerStats.next_level_xp} XP</p>
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
              <p className="text-xl font-bold text-[#37bd7e]">{playerStats.total_points}</p>
            </div>
            <Trophy className="w-6 h-6 text-[#37bd7e]" />
          </div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Tests Run</p>
              <p className="text-xl font-bold text-blue-400">{playerStats.tests_run}</p>
            </div>
            <Activity className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Success Rate</p>
              <p className="text-xl font-bold text-purple-400">{playerStats.success_rate}%</p>
            </div>
            <TrendingUp className="w-6 h-6 text-purple-400" />
          </div>
        </div>
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Current Streak</p>
              <p className="text-xl font-bold text-orange-400">{playerStats.current_streak}</p>
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
                      {(() => {
                        const lastResult = testResults.find(r => r.scenario_id === scenario.id && r.workflow_id === workflow?.id);
                        const isPassed = lastResult?.status === 'passed';
                        const hasTested = !!lastResult;
                        
                        return (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            hasTested
                              ? isPassed ? 'bg-green-600/20' : 'bg-red-600/20'
                              : 'bg-gray-700'
                          }`}>
                            {hasTested ? (
                              isPassed ? (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-400" />
                              )
                            ) : (
                              <TestTube className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        );
                      })()}
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
                {testResults.slice(0, 5).map((result) => {
                  const scenario = scenarios.find(s => s.id === result.scenario_id);
                  return (
                    <div
                      key={result.id}
                      className="bg-gray-800/30 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {result.status === 'passed' ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <div>
                          <p className="text-sm text-white">{scenario?.name || result.scenario_id}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-400">{result.execution_time_ms}ms</p>
                            {result.points_earned > 0 && (
                              <span className="text-xs text-[#37bd7e]">+{result.points_earned} pts</span>
                            )}
                          </div>
                          {result.error_message && (
                            <p className="text-xs text-red-400 mt-1">{result.error_message}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium ${
                          result.status === 'passed' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {result.status === 'passed' ? 'Passed' : 'Failed'}
                        </span>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(result.executed_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
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