import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  FileText,
  Download,
  RotateCcw,
  Users,
  Trash2,
  Target,
  Calendar,
  Phone,
  PoundSterling,
  CheckSquare,
  Building2,
  Zap,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';
import { useDeals } from '@/lib/hooks/useDeals';
import { useContacts } from '@/lib/hooks/useContacts';
import { useCompanies } from '@/lib/hooks/useCompanies';
import { useTasks } from '@/lib/hooks/useTasks';
import { useActivities } from '@/lib/hooks/useActivities';
import { useDealsActions } from '@/lib/hooks/useDealsActions';
import { useActivitiesActions } from '@/lib/hooks/useActivitiesActions';
import { cleanupAllTestData, cleanupTestDataByIds, getTestDataCounts } from '@/lib/utils/testCleanup';

interface TestResult {
  function: string;
  operation: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message?: string;
  duration?: number;
  data?: any;
  error?: any;
}

interface FunctionTestSuiteProps {
  onClose?: () => void;
}

export const FunctionTestSuite: React.FC<FunctionTestSuiteProps> = ({ onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isQuickAddTesting, setIsQuickAddTesting] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [createdIds, setCreatedIds] = useState<Record<string, string[]>>({});
  const cleanupDataRef = useRef<Record<string, string[]>>({});
  
  const { userData } = useUser();
  const { deals, createDeal, updateDeal, deleteDeal, moveDealToStage } = useDeals();
  const { contacts, createContact, updateContact, deleteContact } = useContacts();
  const { companies, createCompany, updateCompany, deleteCompany } = useCompanies();
  const { tasks, createTask, updateTask, deleteTask } = useTasks();
  const { activities, addActivity, addActivityAsync, updateActivity, removeActivity } = useActivities();
  
  // QuickAdd specific hooks
  const { findDealsByClient } = useDealsActions();
  const { addActivity: addActivityViaQuickAdd } = useActivitiesActions();

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Cleanup any remaining test data when component unmounts
      const remainingData = cleanupDataRef.current;
      if (Object.keys(remainingData).length > 0) {
        console.log('🧹 Function Test Suite unmounting - cleaning up remaining test data...', remainingData);
        
        // Perform cleanup without waiting (fire and forget)
        Object.entries(remainingData).forEach(([entityType, ids]) => {
          ids.forEach(async (id) => {
            try {
              await performCleanupOperation(entityType, id);
              console.log(`🧹 Cleaned up ${entityType}: ${id.substring(0, 8)}... on unmount`);
            } catch (error) {
              console.warn(`⚠️ Failed to cleanup ${entityType} on unmount:`, error);
            }
          });
        });
      }
    };
  }, []);

  // Test data generators
  const generateTestData = (functionType: string, operation: string) => {
    const timestamp = Date.now();
    const testData: Record<string, any> = {
      contact: {
        create: {
          first_name: `TestContact`,
          last_name: `Func_${timestamp}`,
          email: `test_func_${timestamp}@example.com`,
          phone: '+1234567890',
          title: 'Test Function Contact',
          company: `Test Company ${timestamp}`,
          company_website: `https://testfunc${timestamp}.com`
        },
        update: {
          phone: '+9876543210',
          title: 'Updated Function Contact'
        }
      },
      company: {
        create: {
          name: `Test Function Company ${timestamp}`,
          domain: `testfunc${timestamp}.com`,
          industry: 'Technology',
          size: 'medium',
          website: `https://testfunc${timestamp}.com`,
          owner_id: userData?.id // Required field
        },
        update: {
          size: 'large',
          industry: 'Finance'
        }
      },
      deal: {
        create: {
          name: `Test Function Deal ${timestamp}`,
          company: `Test Function Company ${timestamp}`,
          contact_name: 'TestContact Function',
          contact_email: `test_func_${timestamp}@example.com`,
          value: Math.floor(Math.random() * 100000) + 10000,
          expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          owner_id: userData?.id, // Required field
          stage_id: 'default-stage-id' // Will be set to actual stage in execution
        },
        update: {
          value: 75000,
          notes: 'Updated deal value through function test'
        }
      },
      task: {
        create: {
          title: `Test Function Task ${timestamp}`,
          description: 'This is a test task created by Function Test Suite',
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          priority: 'high',
          status: 'pending',
          task_type: 'follow_up',
          contact_email: `test_func_${timestamp}@example.com`,
          assigned_to: userData?.id // Assign to current user
        },
        update: {
          status: 'completed',
          priority: 'medium'
        }
      },
      meeting: {
        create: {
          type: 'meeting',
          client_name: `Test Function Client ${timestamp}`,
          contact_name: 'TestContact Function',
          contact_email: `test_func_${timestamp}@example.com`,
          details: 'Discovery Call',
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'completed'
        },
        update: {
          status: 'completed',
          details: 'Updated Discovery Call'
        }
      },
      proposal: {
        create: {
          type: 'proposal',
          client_name: `Test Function Client ${timestamp}`,
          contact_name: 'TestContact Function',
          contact_email: `test_func_${timestamp}@example.com`,
          details: 'Proposal sent via email',
          date: new Date().toISOString(),
          status: 'completed'
        },
        update: {
          status: 'completed',
          details: 'Updated proposal details'
        }
      },
      sale: {
        create: {
          type: 'sale',
          client_name: `Test Function Client ${timestamp}`,
          contact_name: 'TestContact Function',
          contact_email: `test_func_${timestamp}@example.com`,
          amount: 50000,
          date: new Date().toISOString(),
          status: 'completed'
        },
        update: {
          amount: 75000,
          notes: 'Updated sale amount'
        }
      },
      outbound: {
        create: {
          type: 'outbound',
          client_name: `Test Function Client ${timestamp}`,
          contact_name: 'TestContact Function',
          contact_email: `test_func_${timestamp}@example.com`,
          details: 'Cold outbound call',
          outbound_type: 'Call',
          outbound_count: 1,
          date: new Date().toISOString(),
          status: 'completed'
        },
        update: {
          outbound_count: 2,
          details: 'Follow-up outbound call'
        }
      }
    };

    return testData[functionType]?.[operation] || {};
  };

  // Function to perform cleanup operations
  const performCleanupOperation = async (entityType: string, id: string) => {
    let result: any;
    switch (entityType) {
      case 'contact':
        result = await deleteContact(id);
        break;
      case 'company':
        result = await deleteCompany(id);
        break;
      case 'deal':
        result = await deleteDeal(id);
        break;
      case 'task':
        // deleteTask doesn't return boolean, it throws on error or completes successfully
        await deleteTask(id);
        result = true;
        break;
      case 'activity':
        // Use direct delete function instead of mutation for cleanup
        const { error } = await supabase.from('activities').delete().eq('id', id);
        if (error) throw error;
        result = true;
        break;
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    // Check if cleanup actually succeeded
    if (result === false) {
      throw new Error(`Cleanup operation for ${entityType} ${id} returned false - deletion failed`);
    }
    
    return result;
  };

  // Get pipeline stages for testing stage transitions
  const getPipelineStages = async () => {
    try {
      const { data: stages, error } = await supabase
        .from('deal_stages')
        .select('*')
        .order('order_position');
      
      if (error) throw error;
      return stages || [];
    } catch (error) {
      console.error('Failed to get deal stages:', error);
      return [];
    }
  };

  // Test operations for different function types
  const runFunctionTest = async (functionType: string, operation: string, data?: any, id?: string): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      switch (functionType) {
        case 'contact':
          if (operation === 'create') result = await createContact(data);
          else if (operation === 'update') result = await updateContact(id!, data);
          else if (operation === 'delete') {
            result = await deleteContact(id!);
            // Check if delete actually succeeded
            if (result === false) {
              throw new Error('Delete operation returned false - deletion failed');
            }
          }
          else if (operation === 'bulk_create') {
            const contacts = [data, { ...data, email: `bulk_${Date.now()}@example.com` }];
            result = await Promise.all(contacts.map(c => createContact(c)));
          }
          break;
          
        case 'company':
          if (operation === 'create') result = await createCompany(data);
          else if (operation === 'update') result = await updateCompany(id!, data);
          else if (operation === 'delete') {
            result = await deleteCompany(id!);
            // Check if delete actually succeeded
            if (result === false) {
              throw new Error('Delete operation returned false - deletion failed');
            }
          }
          break;
          
        case 'deal':
          if (operation === 'create') {
            // Get the first available stage for deal creation
            const stages = await getPipelineStages();
            if (stages.length > 0) {
              data.stage_id = stages[0].id; // Use the first stage
            }
            result = await createDeal(data);
          }
          else if (operation === 'update') result = await updateDeal(id!, data);
          else if (operation === 'delete') {
            result = await deleteDeal(id!);
            // Check if delete actually succeeded
            if (result === false) {
              throw new Error('Delete operation returned false - deletion failed');
            }
          }
          else if (operation === 'move_stage') {
            const stages = await getPipelineStages();
            if (stages.length > 1) {
              const targetStage = stages.find(s => s.name === 'Opportunity') || stages[1];
              result = await moveDealToStage(id!, targetStage.id);
            }
          }
          break;
          
        case 'task':
          if (operation === 'create') result = await createTask(data);
          else if (operation === 'update') result = await updateTask(id!, data);
          else if (operation === 'delete') {
            // deleteTask doesn't return boolean, it throws on error or completes successfully
            await deleteTask(id!);
            result = true;
          }
          break;
          
        case 'meeting':
        case 'proposal':
        case 'sale':
        case 'outbound':
          if (operation === 'create') {
            result = await addActivityAsync(data);
          }
          else if (operation === 'update') result = await updateActivity(id!, data);
          else if (operation === 'delete') result = await removeActivity(id!);
          break;
          
        default:
          throw new Error(`Unknown function type: ${functionType}`);
      }

      const duration = Date.now() - startTime;
      
      return {
        function: functionType,
        operation,
        status: 'success',
        message: `${operation} successful`,
        duration,
        data: result
      };
    } catch (error: any) {
      return {
        function: functionType,
        operation,
        status: 'failed',
        message: error.message || 'Unknown error',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  // Performance benchmark test
  const runPerformanceBenchmark = async (): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const operations = [];
      const timestamp = Date.now();
      
      // Create 10 contacts rapidly
      for (let i = 0; i < 10; i++) {
        operations.push(createContact({
          first_name: `Perf`,
          last_name: `Test_${timestamp}_${i}`,
          email: `perf_test_${timestamp}_${i}@example.com`,
          title: 'Performance Test Contact'
        }));
      }
      
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      // Cleanup performance test data
      await Promise.all(results.map(contact => {
        if (contact?.id) {
          return deleteContact(contact.id);
        }
      }));
      
      return {
        function: 'performance',
        operation: 'bulk_create',
        status: 'success',
        message: `Created and cleaned up ${results.length} records in ${duration}ms`,
        duration,
        data: { count: results.length, avgTimePerRecord: duration / results.length }
      };
    } catch (error: any) {
      return {
        function: 'performance',
        operation: 'bulk_create',
        status: 'failed',
        message: error.message || 'Performance test failed',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  // Company-contact linking test
  const runCompanyContactLinkingTest = async (): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const timestamp = Date.now();
      
      // Create contact with company website - should auto-create company and link
      const contact = await createContact({
        first_name: 'LinkTest',
        last_name: `Contact_${timestamp}`,
        email: `linktest_${timestamp}@testcompany${timestamp}.com`,
        title: 'Company Linking Test',
        company_website: `https://testcompany${timestamp}.com`,
        owner_id: userData?.id // Required for company auto-creation
      });
      
      // Check if company was created and linked
      if (!contact.company_id) {
        throw new Error('Contact was not linked to a company despite providing website');
      }
      
      // Fetch the linked company to verify it was created properly
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', contact.company_id)
        .single();
      
      if (companyError || !company) {
        throw new Error('Linked company was not found in database');
      }
      
      // Verify company details
      if (!company.domain?.includes(`testcompany${timestamp}.com`)) {
        throw new Error('Company domain does not match expected domain from website');
      }
      
      // Cleanup
      await deleteContact(contact.id);
      await deleteCompany(company.id);
      
      const duration = Date.now() - startTime;
      
      return {
        function: 'company_linking',
        operation: 'auto_create_test',
        status: 'success',
        message: `Company auto-created and linked successfully. Domain: ${company.domain}`,
        duration,
        data: { contact: contact.id, company: company.id, domain: company.domain }
      };
    } catch (error: any) {
      return {
        function: 'company_linking',
        operation: 'auto_create_test',
        status: 'failed',
        message: error.message || 'Company linking test failed',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  // Data integrity check
  const runDataIntegrityCheck = async (): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const timestamp = Date.now();
      
      // Create linked data to test relationships
      const contact = await createContact({
        first_name: 'Integrity',
        last_name: `Test_${timestamp}`,
        email: `integrity_test_${timestamp}@example.com`,
        title: 'Data Integrity Test',
        owner_id: userData?.id
      });
      
      if (!contact) {
        throw new Error('Failed to create contact for integrity test');
      }
      
      const company = await createCompany({
        name: `Integrity Test Company ${timestamp}`,
        domain: `integrity${timestamp}.com`,
        owner_id: userData?.id
      });
      
      if (!company) {
        throw new Error('Failed to create company for integrity test');
      }
      
      // Get pipeline stages for deal creation
      const stages = await getPipelineStages();
      if (stages.length === 0) {
        throw new Error('No pipeline stages available for deal creation');
      }
      
      // Extract the actual company object from the API response
      const actualCompany = company.data?.data || company.data || company;
      
      const deal = await createDeal({
        name: `Integrity Test Deal ${timestamp}`,
        company: actualCompany.name,
        contact_name: contact.first_name + ' ' + contact.last_name,
        contact_email: contact.email,
        value: 25000,
        expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        owner_id: userData?.id,
        stage_id: stages[0].id
      });
      
      if (!deal || deal === false) {
        throw new Error(`Failed to create deal for integrity test. Deal result: ${JSON.stringify(deal)}`);
      }
      
      const task = await createTask({
        title: `Integrity Test Task ${timestamp}`,
        description: 'Data integrity test task',
        contact_email: contact.email,
        deal_id: deal.id,
        assigned_to: userData?.id
      });
      
      if (!task) {
        throw new Error('Failed to create task for integrity test');
      }
      
      // Cleanup
      await deleteTask(task.id);
      await deleteDeal(deal.id);
      await deleteCompany(company.id);
      await deleteContact(contact.id);
      
      const duration = Date.now() - startTime;
      
      return {
        function: 'integrity',
        operation: 'relationship_test',
        status: 'success',
        message: `Data relationships created and cleaned successfully`,
        duration,
        data: { contact: contact.id, company: company.id, deal: deal.id, task: task.id }
      };
    } catch (error: any) {
      return {
        function: 'integrity',
        operation: 'relationship_test',
        status: 'failed',
        message: error.message || 'Data integrity test failed',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  // Error handling test
  const runErrorHandlingTest = async (): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const errors = [];
      
      // Test invalid email
      try {
        await createContact({
          first_name: 'Error',
          last_name: 'Test',
          email: 'invalid-email',
          title: 'Error Test'
        });
      } catch (error) {
        errors.push('Invalid email handled correctly');
      }
      
      // Test missing required fields
      try {
        await createDeal({
          name: '',
          company: '',
          contact_email: '',
          value: 0
        });
      } catch (error) {
        errors.push('Missing required fields handled correctly');
      }
      
      // Test delete non-existent record
      try {
        await deleteContact('non-existent-id');
      } catch (error) {
        errors.push('Non-existent record deletion handled correctly');
      }
      
      const duration = Date.now() - startTime;
      
      return {
        function: 'error_handling',
        operation: 'validation_test',
        status: 'success',
        message: `Error handling tests completed: ${errors.join(', ')}`,
        duration,
        data: { validationErrors: errors.length }
      };
    } catch (error: any) {
      return {
        function: 'error_handling',
        operation: 'validation_test',
        status: 'failed',
        message: error.message || 'Error handling test failed',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  // Enhanced cleanup function using the new utility
  const cleanupTestData = async (testIds: Record<string, string[]>) => {
    try {
      // Use the comprehensive cleanup utility
      const result = await cleanupTestDataByIds(testIds);
      
      const cleanupResults: string[] = [];
      
      // Format results for display
      Object.entries(result.deletedCounts).forEach(([entityType, count]) => {
        if (count > 0) {
          cleanupResults.push(`✅ Cleaned up ${count} ${entityType}`);
        }
      });
      
      // Add error messages
      result.errors.forEach(error => {
        cleanupResults.push(`⚠️ Failed to cleanup ${error.table}: ${error.error}`);
      });
      
      if (cleanupResults.length === 0) {
        cleanupResults.push('✅ No cleanup needed - all items already cleaned');
      }
      
      return cleanupResults;
    } catch (error) {
      return [`❌ Cleanup failed: ${(error as Error).message}`];
    }
  };

  // Comprehensive test data cleanup function
  const performCompleteCleanup = async (): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      // Get current test data counts
      const counts = await getTestDataCounts();
      const totalItems = Object.values(counts).reduce((sum, count) => sum + count, 0);
      
      if (totalItems === 0) {
        return {
          function: 'cleanup',
          operation: 'complete_cleanup',
          status: 'success',
          message: '✅ Database already clean - no test data found',
          duration: Date.now() - startTime
        };
      }
      
      // Perform comprehensive cleanup
      const result = await cleanupAllTestData();
      
      if (result.success) {
        const deletedTotal = Object.values(result.deletedCounts).reduce((sum, count) => sum + count, 0);
        return {
          function: 'cleanup',
          operation: 'complete_cleanup',
          status: 'success',
          message: `✅ Cleaned up ${deletedTotal} test items: ${Object.entries(result.deletedCounts).map(([k,v]) => `${v} ${k}`).join(', ')}`,
          duration: Date.now() - startTime,
          data: result
        };
      } else {
        return {
          function: 'cleanup',
          operation: 'complete_cleanup',
          status: 'failed',
          message: `⚠️ Cleanup had ${result.errors.length} errors: ${result.errors.map(e => e.error).join('; ')}`,
          duration: Date.now() - startTime,
          data: result
        };
      }
    } catch (error) {
      return {
        function: 'cleanup',
        operation: 'complete_cleanup',
        status: 'failed',
        message: `❌ Cleanup failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
        error
      };
    }
  };

  // QuickAdd specific test functions
  const runQuickAddMeetingTest = async (): Promise<TestResult> => {
    const startTime = Date.now();
    const timestamp = Date.now();
    
    try {
      const meetingData = {
        type: 'meeting' as const,
        client_name: `QA Meeting Client ${timestamp}`,
        details: 'QuickAdd meeting test',
        date: new Date().toISOString(),
        status: 'completed',
        contactIdentifier: `qa_meeting_${timestamp}@example.com`,
        contactIdentifierType: 'email'
      };
      
      const result = await addActivityViaQuickAdd(meetingData);
      
      if (result) {
        // Track for cleanup
        if (!cleanupDataRef.current.activity) cleanupDataRef.current.activity = [];
        cleanupDataRef.current.activity.push(result.id);
        
        return {
          function: 'quickadd',
          operation: 'meeting',
          status: 'success',
          message: `Meeting created via QuickAdd (ID: ${result.id.substring(0, 8)}...)`,
          duration: Date.now() - startTime,
          data: result
        };
      }
      throw new Error('No result returned from createActivity');
    } catch (error: any) {
      return {
        function: 'quickadd',
        operation: 'meeting',
        status: 'failed',
        message: error.message || 'QuickAdd meeting creation failed',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  const runQuickAddOutboundTest = async (): Promise<TestResult> => {
    const startTime = Date.now();
    const timestamp = Date.now();
    
    try {
      const outboundData = {
        type: 'outbound' as const,
        client_name: `QA Outbound Client ${timestamp}`,
        details: 'QuickAdd outbound test call',
        date: new Date().toISOString(),
        status: 'completed',
        quantity: 1,
        contactIdentifier: `qa_outbound_${timestamp}@example.com`,
        contactIdentifierType: 'email'
      };
      
      const result = await addActivityViaQuickAdd(outboundData);
      
      if (result) {
        // Track for cleanup
        if (!cleanupDataRef.current.activity) cleanupDataRef.current.activity = [];
        cleanupDataRef.current.activity.push(result.id);
        
        return {
          function: 'quickadd',
          operation: 'outbound',
          status: 'success',
          message: `Outbound created via QuickAdd (ID: ${result.id.substring(0, 8)}...)`,
          duration: Date.now() - startTime,
          data: result
        };
      }
      throw new Error('No result returned from createActivity');
    } catch (error: any) {
      return {
        function: 'quickadd',
        operation: 'outbound',
        status: 'failed',
        message: error.message || 'QuickAdd outbound creation failed',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  const runQuickAddProposalTest = async (): Promise<TestResult> => {
    const startTime = Date.now();
    const timestamp = Date.now();
    
    try {
      const proposalData = {
        type: 'proposal' as const,
        client_name: `QA Proposal Client ${timestamp}`,
        details: 'QuickAdd proposal test',
        amount: 5000,
        date: new Date().toISOString(),
        status: 'completed',
        contactIdentifier: `qa_proposal_${timestamp}@example.com`,
        contactIdentifierType: 'email'
      };
      
      const result = await addActivityViaQuickAdd(proposalData);
      
      if (result) {
        // Track for cleanup
        if (!cleanupDataRef.current.activity) cleanupDataRef.current.activity = [];
        cleanupDataRef.current.activity.push(result.id);
        
        return {
          function: 'quickadd',
          operation: 'proposal',
          status: 'success',
          message: `Proposal created via QuickAdd (ID: ${result.id.substring(0, 8)}...)`,
          duration: Date.now() - startTime,
          data: result
        };
      }
      throw new Error('No result returned from createActivity');
    } catch (error: any) {
      return {
        function: 'quickadd',
        operation: 'proposal',
        status: 'failed',
        message: error.message || 'QuickAdd proposal creation failed',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  const runQuickAddSaleTest = async (): Promise<TestResult> => {
    const startTime = Date.now();
    const timestamp = Date.now();
    
    try {
      const saleData = {
        type: 'sale' as const,
        client_name: `QA Sale Client ${timestamp}`,
        details: 'QuickAdd sale test',
        amount: 10000,
        date: new Date().toISOString(),
        status: 'completed',
        contactIdentifier: `qa_sale_${timestamp}@example.com`,
        contactIdentifierType: 'email'
      };
      
      const result = await addActivityViaQuickAdd(saleData);
      
      if (result) {
        // Track for cleanup
        if (!cleanupDataRef.current.activity) cleanupDataRef.current.activity = [];
        cleanupDataRef.current.activity.push(result.id);
        
        return {
          function: 'quickadd',
          operation: 'sale',
          status: 'success',
          message: `Sale created via QuickAdd (ID: ${result.id.substring(0, 8)}...)`,
          duration: Date.now() - startTime,
          data: result
        };
      }
      throw new Error('No result returned from createActivity');
    } catch (error: any) {
      return {
        function: 'quickadd',
        operation: 'sale',
        status: 'failed',
        message: error.message || 'QuickAdd sale creation failed',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  const runQuickAddWithDealTest = async (): Promise<TestResult> => {
    const startTime = Date.now();
    const timestamp = Date.now();
    
    try {
      const clientName = `QA Deal Client ${timestamp}`;
      
      // Get user ID and first available stage
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const stages = await getPipelineStages();
      if (stages.length === 0) throw new Error('No pipeline stages available');
      
      // First create a deal
      const dealData = {
        name: `QA Deal ${timestamp}`,
        company: clientName,
        contact_name: `QA Contact ${timestamp}`,
        value: 15000,
        stage_id: stages[0].id,
        owner_id: user.id,
        one_off_revenue: 15000,
        monthly_mrr: 0
      };
      
      const deal = await createDeal(dealData);
      
      if (deal) {
        // Track for cleanup
        if (!cleanupDataRef.current.deal) cleanupDataRef.current.deal = [];
        cleanupDataRef.current.deal.push(deal.id);
        
        // Now create an activity linked to this deal
        const activityData = {
          type: 'meeting' as const,
          client_name: clientName,
          details: 'QuickAdd meeting linked to deal',
          date: new Date().toISOString(),
          status: 'completed',
          deal_id: deal.id,
          contactIdentifier: `qa_deal_${timestamp}@example.com`,
          contactIdentifierType: 'email'
        };
        
        const activity = await addActivityViaQuickAdd(activityData);
        
        if (activity) {
          // Track for cleanup
          if (!cleanupDataRef.current.activity) cleanupDataRef.current.activity = [];
          cleanupDataRef.current.activity.push(activity.id);
          
          return {
            function: 'quickadd',
            operation: 'deal_with_activity',
            status: 'success',
            message: `Deal and linked activity created (Deal: ${deal.id.substring(0, 8)}..., Activity: ${activity.id.substring(0, 8)}...)`,
            duration: Date.now() - startTime,
            data: { deal, activity }
          };
        }
        throw new Error('Failed to create linked activity');
      }
      throw new Error('Failed to create deal');
    } catch (error: any) {
      return {
        function: 'quickadd',
        operation: 'deal_with_activity',
        status: 'failed',
        message: error.message || 'QuickAdd deal with activity creation failed',
        duration: Date.now() - startTime,
        error
      };
    }
  };

  // Run all QuickAdd tests
  const runQuickAddTests = async () => {
    if (!userData) {
      toast.error('Please log in to run QuickAdd tests');
      return;
    }

    setIsQuickAddTesting(true);
    setResults([]);
    setProgress(0);
    
    const quickAddTests = [
      { name: 'Meeting', test: runQuickAddMeetingTest },
      { name: 'Outbound', test: runQuickAddOutboundTest },
      { name: 'Proposal', test: runQuickAddProposalTest },
      { name: 'Sale', test: runQuickAddSaleTest },
      { name: 'Deal with Activity', test: runQuickAddWithDealTest }
    ];
    
    const totalTests = quickAddTests.length;
    let completedTests = 0;
    const allResults: TestResult[] = [];

    // Run each QuickAdd test
    for (const testCase of quickAddTests) {
      setResults(prev => [...prev, { 
        function: 'quickadd', 
        operation: testCase.name.toLowerCase().replace(' ', '_'), 
        status: 'running' 
      }]);
      
      try {
        console.log(`🧪 Starting QuickAdd test: ${testCase.name}`);
        const result = await testCase.test();
        console.log(`✅ QuickAdd test ${testCase.name} completed:`, result);
        allResults.push(result);
        setResults([...allResults]);
        
        completedTests++;
        setProgress((completedTests / totalTests) * 100);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ QuickAdd test ${testCase.name} failed with error:`, error);
        const errorResult = {
          function: 'quickadd',
          operation: testCase.name.toLowerCase().replace(' ', '_'),
          status: 'failed' as const,
          message: `Test error: ${(error as Error).message}`,
          duration: 0,
          error
        };
        allResults.push(errorResult);
        setResults([...allResults]);
        
        completedTests++;
        setProgress((completedTests / totalTests) * 100);
        
        // Continue with next test even if this one failed
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    setIsQuickAddTesting(false);
    
    const successCount = allResults.filter(r => r.status === 'success').length;
    const failedCount = allResults.filter(r => r.status === 'failed').length;
    
    if (failedCount === 0) {
      toast.success(`All QuickAdd tests passed! ${successCount} successful`);
    } else {
      toast.warning(`QuickAdd tests completed: ${successCount} passed, ${failedCount} failed`);
    }
  };

  // Run all tests (both function tests and QuickAdd tests)
  const runAllTests = async () => {
    if (!userData) {
      toast.error('Please log in to run tests');
      return;
    }

    setIsRunningAll(true);
    setResults([]);
    setProgress(0);
    
    try {
      // Run the main function test logic (80% of total progress)
      await runFunctionTestLogic(0.8);
      
      // Add a separator result
      setResults(prev => [...prev, {
        function: 'separator',
        operation: 'quickadd_start',
        status: 'success',
        message: '--- Starting QuickAdd Tests ---'
      }]);
      
      // Then run QuickAdd tests
      const quickAddTests = [
        { name: 'Meeting', test: runQuickAddMeetingTest },
        { name: 'Outbound', test: runQuickAddOutboundTest },
        { name: 'Proposal', test: runQuickAddProposalTest },
        { name: 'Sale', test: runQuickAddSaleTest },
        { name: 'Deal with Activity', test: runQuickAddWithDealTest }
      ];
      
      let quickAddProgress = 0;
      const quickAddTotal = quickAddTests.length;
      
      for (const testCase of quickAddTests) {
        try {
          console.log(`🧪 Starting QuickAdd test (All Tests): ${testCase.name}`);
          setResults(prev => [...prev, { 
            function: 'quickadd', 
            operation: testCase.name.toLowerCase().replace(' ', '_'), 
            status: 'running' 
          }]);
          
          const result = await testCase.test();
          console.log(`✅ QuickAdd test ${testCase.name} completed (All Tests):`, result);
          setResults(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = result;
            return updated;
          });
          
          quickAddProgress++;
          // Update progress to show QuickAdd portion (assuming function tests took 80% of progress)
          setProgress(80 + (quickAddProgress / quickAddTotal) * 20);
          
          // Small delay between tests
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`❌ QuickAdd test ${testCase.name} failed in All Tests with error:`, error);
          const errorResult = {
            function: 'quickadd',
            operation: testCase.name.toLowerCase().replace(' ', '_'),
            status: 'failed' as const,
            message: `Test error: ${(error as Error).message}`,
            duration: 0,
            error
          };
          setResults(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = errorResult;
            return updated;
          });
          
          quickAddProgress++;
          setProgress(80 + (quickAddProgress / quickAddTotal) * 20);
          
          // Continue with next test even if this one failed
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      setProgress(100);
      
      // Final results counting - use a timeout to ensure state is updated
      setTimeout(() => {
        setResults(currentResults => {
          const allResults = currentResults.filter(r => r.function !== 'separator');
          const successCount = allResults.filter(r => r.status === 'success').length;
          const failedCount = allResults.filter(r => r.status === 'failed').length;
          
          if (failedCount === 0) {
            toast.success(`All tests passed! ${successCount} successful tests completed`);
          } else {
            toast.warning(`All tests completed: ${successCount} passed, ${failedCount} failed`);
          }
          
          return currentResults;
        });
      }, 100);
      
    } catch (error) {
      toast.error('Error running all tests');
      console.error('All tests error:', error);
    } finally {
      setIsRunningAll(false);
    }
  };
  
  // Extracted function test logic for reuse
  const runFunctionTestLogic = async (progressMultiplier = 1.0) => {
    const functionTypes = ['contact', 'company', 'deal', 'task', 'meeting', 'proposal', 'sale', 'outbound'];
    const operations = ['create', 'update', 'delete'];
    const specialTests = ['bulk_create', 'move_stage', 'performance', 'company_linking', 'integrity', 'error_handling'];
    
    const totalTests = (functionTypes.length * operations.length) + specialTests.length + 1;
    let completedTests = 0;
    const testDataToCleanup: Record<string, string[]> = { contact: [], company: [], deal: [], task: [], activity: [] };
    const allResults: TestResult[] = [];

    // Clear existing cleanup data
    cleanupDataRef.current = { ...testDataToCleanup };

    // Run CRUD tests for each function type
    for (const functionType of functionTypes) {
      const createData = generateTestData(functionType, 'create');
      
      // Create operation
      setResults(prev => [...prev, { function: functionType, operation: 'create', status: 'running' }]);
      const createResult = await runFunctionTest(functionType, 'create', createData);
      allResults.push(createResult);
      setResults([...allResults]);
      completedTests++;
      setProgress((completedTests / totalTests) * 100 * progressMultiplier);

      // Track created items for cleanup and further testing
      let createdId: string | null = null;
      if (createResult.status === 'success' && createResult.data) {
        if (Array.isArray(createResult.data)) {
          createdId = createResult.data[0]?.id;
          createResult.data.forEach((item: any) => {
            if (item?.id) {
              testDataToCleanup[functionType]?.push(item.id);
              cleanupDataRef.current[functionType]?.push(item.id);
            }
          });
        } else if (typeof createResult.data === 'object' && createResult.data?.id) {
          createdId = createResult.data.id;
          testDataToCleanup[functionType]?.push(createResult.data.id);
          cleanupDataRef.current[functionType]?.push(createResult.data.id);
        }
      }

      if (createdId && createResult.status === 'success') {
        // Update operation
        const updateData = generateTestData(functionType, 'update');
        setResults(prev => [...prev, { function: functionType, operation: 'update', status: 'running' }]);
        const updateResult = await runFunctionTest(functionType, 'update', updateData, createdId);
        allResults.push(updateResult);
        setResults([...allResults]);
        completedTests++;
        setProgress((completedTests / totalTests) * 100 * progressMultiplier);

        // Delete operation
        setResults(prev => [...prev, { function: functionType, operation: 'delete', status: 'running' }]);
        const deleteResult = await runFunctionTest(functionType, 'delete', null, createdId);
        allResults.push(deleteResult);
        setResults([...allResults]);
        
        // If delete was successful, remove from cleanup lists
        if (deleteResult.status === 'success') {
          testDataToCleanup[functionType] = testDataToCleanup[functionType].filter(id => id !== createdId);
          cleanupDataRef.current[functionType] = cleanupDataRef.current[functionType].filter(id => id !== createdId);
        }
        
        completedTests++;
        setProgress((completedTests / totalTests) * 100 * progressMultiplier);
      } else {
        // Skip update and delete if create failed
        completedTests += 2;
        setProgress((completedTests / totalTests) * 100 * progressMultiplier);
        allResults.push(
          { function: functionType, operation: 'update', status: 'skipped', message: 'Skipped due to create failure' },
          { function: functionType, operation: 'delete', status: 'skipped', message: 'Skipped due to create failure' }
        );
        setResults([...allResults]);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Run special tests...
    const specialTestMethods = [
      { name: 'bulk_create', method: async () => {
        const bulkData = generateTestData('contact', 'create');
        return await runFunctionTest('contact', 'bulk_create', bulkData);
      }},
      { name: 'move_stage', method: async () => {
        if (testDataToCleanup['deal'].length > 0) {
          return await runFunctionTest('deal', 'move_stage', null, testDataToCleanup['deal'][0]);
        } else {
          return { function: 'deal', operation: 'move_stage', status: 'skipped', message: 'No deals available for stage testing' };
        }
      }},
      { name: 'performance', method: runPerformanceBenchmark },
      { name: 'company_linking', method: runCompanyContactLinkingTest },
      { name: 'integrity', method: runDataIntegrityCheck },
      { name: 'error_handling', method: runErrorHandlingTest }
    ];

    for (const testMethod of specialTestMethods) {
      setResults(prev => [...prev, { function: testMethod.name, operation: 'test', status: 'running' }]);
      const result = await testMethod.method();
      allResults.push(result);
      setResults([...allResults]);
      completedTests++;
      setProgress((completedTests / totalTests) * 100 * progressMultiplier);
    }

    // Final cleanup
    const remainingCleanup = Object.values(testDataToCleanup).flat().filter(Boolean);
    if (remainingCleanup.length > 0) {
      allResults.push({
        function: 'cleanup',
        operation: 'final_cleanup',
        status: 'running',
        message: `Cleaning up ${remainingCleanup.length} remaining test records...`
      });
      setResults([...allResults]);
      
      const cleanupResults = await cleanupTestData(testDataToCleanup);
      
      allResults[allResults.length - 1] = {
        function: 'cleanup',
        operation: 'final_cleanup',
        status: 'success',
        message: `Cleanup completed: ${cleanupResults.filter(r => r.includes('✅')).length}/${cleanupResults.length} successful`,
        data: { cleanupResults }
      };
      setResults([...allResults]);
      
      cleanupDataRef.current = {};
    }
  };

  // Main test suite runner
  const runCompleteTestSuite = async () => {
    if (!userData) {
      toast.error('Please log in to run function tests');
      return;
    }

    setIsRunning(true);
    setResults([]);
    setProgress(0);
    setCreatedIds({});

    try {
      await runFunctionTestLogic();
      
      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;
      
      if (failedCount === 0) {
        toast.success(`All function tests passed! ${successCount} successful, ${skippedCount} skipped`);
      } else {
        toast.warning(`Function tests completed: ${successCount} passed, ${failedCount} failed, ${skippedCount} skipped`);
      }
    } catch (error) {
      toast.error('Error running function tests');
      console.error('Function test error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const downloadResults = () => {
    // Separate results by test type
    const functionResults = results.filter(r => r.function !== 'quickadd' && r.function !== 'separator');
    const quickAddResults = results.filter(r => r.function === 'quickadd');
    const allTestResults = results.filter(r => r.function !== 'separator');
    
    const testType = quickAddResults.length > 0 && functionResults.length > 0 ? 'All Tests' :
                    quickAddResults.length > 0 ? 'QuickAdd Tests' : 'Function Tests';
    
    const report = {
      timestamp: new Date().toISOString(),
      testType: testType,
      user: userData?.email || 'Unknown',
      summary: {
        total: allTestResults.length,
        success: allTestResults.filter(r => r.status === 'success').length,
        failed: allTestResults.filter(r => r.status === 'failed').length,
        skipped: allTestResults.filter(r => r.status === 'skipped').length,
        avgDuration: allTestResults.reduce((acc, r) => acc + (r.duration || 0), 0) / allTestResults.length
      },
      breakdown: {
        functionTests: {
          total: functionResults.length,
          success: functionResults.filter(r => r.status === 'success').length,
          failed: functionResults.filter(r => r.status === 'failed').length,
          skipped: functionResults.filter(r => r.status === 'skipped').length,
        },
        quickAddTests: {
          total: quickAddResults.length,
          success: quickAddResults.filter(r => r.status === 'success').length,
          failed: quickAddResults.filter(r => r.status === 'failed').length,
          skipped: quickAddResults.filter(r => r.status === 'skipped').length,
        }
      },
      results: results
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `function-test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetTests = () => {
    setResults([]);
    setProgress(0);
    setCreatedIds({});
    setIsRunning(false);
    setIsQuickAddTesting(false);
    setIsRunningAll(false);
    cleanupDataRef.current = {};
  };

  const manualCleanup = async () => {
    const currentCleanupData = { ...cleanupDataRef.current };
    const totalItems = Object.values(currentCleanupData).flat().filter(Boolean).length;
    
    if (totalItems === 0) {
      toast.info('No test data to clean up');
      return;
    }

    try {
      const cleanupResults = await cleanupTestData(currentCleanupData);
      cleanupDataRef.current = {};
      
      const successCount = cleanupResults.filter(r => r.includes('✅')).length;
      if (successCount > 0) {
        toast.success(`🧹 Manually cleaned up ${successCount} test records`);
      } else {
        toast.warning('⚠️ Some cleanup operations may have failed');
      }
      
      console.log('Manual cleanup results:', cleanupResults);
    } catch (error) {
      toast.error('Failed to perform manual cleanup');
      console.error('Manual cleanup error:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'skipped':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getFunctionIcon = (functionType: string) => {
    switch (functionType) {
      case 'contact':
        return <Users className="h-4 w-4" />;
      case 'company':
        return <Building2 className="h-4 w-4" />;
      case 'deal':
        return <Target className="h-4 w-4" />;
      case 'task':
        return <CheckSquare className="h-4 w-4" />;
      case 'meeting':
        return <Calendar className="h-4 w-4" />;
      case 'proposal':
        return <FileText className="h-4 w-4" />;
      case 'sale':
        return <PoundSterling className="h-4 w-4" />;
      case 'outbound':
        return <Phone className="h-4 w-4" />;
      case 'performance':
        return <BarChart3 className="h-4 w-4" />;
      case 'company_linking':
        return <Building2 className="h-4 w-4" />;
      case 'integrity':
        return <CheckCircle className="h-4 w-4" />;
      case 'error_handling':
        return <AlertTriangle className="h-4 w-4" />;
      case 'cleanup':
        return <Trash2 className="h-4 w-4" />;
      case 'quickadd':
        return <Zap className="h-4 w-4" />;
      case 'separator':
        return <div className="h-4 w-4" />; // Empty div for separator
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getOperationBadgeClass = (operation: string) => {
    switch (operation) {
      case 'create':
      case 'bulk_create':
        return 'bg-green-500/20 text-green-400';
      case 'update':
      case 'move_stage':
        return 'bg-amber-500/20 text-amber-400';
      case 'delete':
      case 'final_cleanup':
        return 'bg-red-500/20 text-red-400';
      case 'benchmark':
      case 'test':
        return 'bg-purple-500/20 text-purple-400';
      case 'auto_create_test':
        return 'bg-cyan-500/20 text-cyan-400';
      default:
        return 'bg-blue-500/20 text-blue-400';
    }
  };

  const totalCleanupItems = Object.values(cleanupDataRef.current).flat().filter(Boolean).length;

  return (
    <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-800/50 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-sm rounded-xl border border-blue-500/20">
            <Target className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-100">Function Test Suite</h3>
            <p className="text-sm text-gray-400">Comprehensive testing for CRUD operations, QuickAdd functions, and pipeline operations</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-800/50">
            ✕
          </Button>
        )}
      </div>

      {!userData && (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-sm text-amber-400">⚠️ Please log in to run function tests</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <Button
          onClick={runCompleteTestSuite}
          disabled={isRunning || isQuickAddTesting || isRunningAll || !userData}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running Function Tests...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Function Tests
            </>
          )}
        </Button>
        
        <Button
          onClick={runQuickAddTests}
          disabled={isRunning || isQuickAddTesting || isRunningAll || !userData}
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
        >
          {isQuickAddTesting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running QuickAdd Tests...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Run QuickAdd Tests
            </>
          )}
        </Button>
        
        <Button
          onClick={runAllTests}
          disabled={isRunning || isQuickAddTesting || isRunningAll || !userData}
          className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
        >
          {isRunningAll ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running All Tests...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run All Tests
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          onClick={resetTests}
          disabled={isRunning || isQuickAddTesting || isRunningAll}
          className="bg-gray-800/50 hover:bg-gray-700/50 border-gray-700/50"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        
        {results.length > 0 && (
          <Button
            variant="outline"
            onClick={downloadResults}
            className="bg-gray-800/50 hover:bg-gray-700/50 border-gray-700/50"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        )}

        <Button
          variant="outline"
          onClick={async () => {
            setIsRunning(true);
            try {
              const cleanupResult = await performCompleteCleanup();
              if (cleanupResult.status === 'success') {
                toast.success(`🧹 ${cleanupResult.message}`);
                cleanupDataRef.current = {}; // Clear tracking
              } else {
                toast.error(`❌ Cleanup failed: ${cleanupResult.message}`);
              }
            } catch (error) {
              toast.error(`❌ Cleanup error: ${(error as Error).message}`);
            } finally {
              setIsRunning(false);
            }
          }}
          disabled={isRunning || isQuickAddTesting || isRunningAll}
          className="bg-orange-800/50 hover:bg-orange-700/50 border-orange-700/50 text-orange-300"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clean All Test Data
        </Button>

        {totalCleanupItems > 0 && (
          <Button
            variant="outline"
            onClick={manualCleanup}
            disabled={isRunning || isQuickAddTesting || isRunningAll}
            className="bg-red-800/50 hover:bg-red-700/50 border-red-700/50 text-red-300 hover:text-red-200"
            title={`Clean up ${totalCleanupItems} test records`}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup ({totalCleanupItems})
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {(isRunning || isQuickAddTesting || isRunningAll) && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>
              {isRunningAll ? 'All Tests Progress' : 
               isQuickAddTesting ? 'QuickAdd Testing Progress' : 
               'Function Testing Progress'}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-gray-700/50" />
        </div>
      )}

      {/* Test Results */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {results.map((result, index) => {
              // Handle separator display
              if (result.function === 'separator') {
                return (
                  <motion.div
                    key={`separator-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center py-4"
                  >
                    <div className="flex items-center gap-4 w-full">
                      <div className="h-px bg-gradient-to-r from-transparent to-blue-500/50 flex-1" />
                      <span className="text-sm font-medium text-blue-400 bg-gray-900/50 px-3 py-1 rounded-full border border-blue-500/30">
                        {result.message}
                      </span>
                      <div className="h-px bg-gradient-to-l from-transparent to-blue-500/50 flex-1" />
                    </div>
                  </motion.div>
                );
              }
              
              return (
                <motion.div
                  key={`${result.function}-${result.operation}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between p-3 bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex items-center gap-2">
                      {getFunctionIcon(result.function)}
                      <span className="text-sm font-medium text-gray-200 capitalize">{result.function}</span>
                      <Badge className={cn("text-xs", getOperationBadgeClass(result.operation))}>
                        {result.operation.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {result.duration && (
                      <span className="text-xs text-gray-400">{result.duration}ms</span>
                    )}
                    {result.message && result.status === 'failed' && (
                      <span className="text-xs text-red-400 max-w-xs truncate" title={result.message}>
                        {result.message}
                      </span>
                    )}
                    {result.message && result.status === 'success' && (
                      <span className="text-xs text-green-400 max-w-xs truncate" title={result.message}>
                        {result.message}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Summary */}
      {results.length > 0 && !isRunning && !isQuickAddTesting && !isRunningAll && (
        <div className="mt-6 p-4 bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700/50">
          {(() => {
            const validResults = results.filter(r => r.function !== 'separator');
            const functionResults = validResults.filter(r => r.function !== 'quickadd');
            const quickAddResults = validResults.filter(r => r.function === 'quickadd');
            const hasQuickAdd = quickAddResults.length > 0;
            const hasFunction = functionResults.length > 0;
            
            return (
              <>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-400">
                      {validResults.filter(r => r.status === 'success').length}
                    </div>
                    <div className="text-xs text-gray-400">Passed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">
                      {validResults.filter(r => r.status === 'failed').length}
                    </div>
                    <div className="text-xs text-gray-400">Failed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {validResults.filter(r => r.status === 'skipped').length}
                    </div>
                    <div className="text-xs text-gray-400">Skipped</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-300">
                      {validResults.length > 0 ? Math.round(validResults.reduce((acc, r) => acc + (r.duration || 0), 0) / validResults.length) : 0}ms
                    </div>
                    <div className="text-xs text-gray-400">Avg Time</div>
                  </div>
                </div>
                
                {hasQuickAdd && hasFunction && (
                  <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-400">Function Tests</div>
                        <div className="text-sm text-gray-400 mt-1">
                          {functionResults.filter(r => r.status === 'success').length} passed, {functionResults.filter(r => r.status === 'failed').length} failed
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-400">QuickAdd Tests</div>
                        <div className="text-sm text-gray-400 mt-1">
                          {quickAddResults.filter(r => r.status === 'success').length} passed, {quickAddResults.filter(r => r.status === 'failed').length} failed
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};