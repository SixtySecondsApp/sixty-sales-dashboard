import { toast } from 'sonner';
import { useDeals } from '@/lib/hooks/useDeals';
import { useActivities } from '@/lib/hooks/useActivities';
import { supabase } from '@/lib/supabase/clientV2';
import { WizardState } from '../types';
import logger from '@/lib/utils/logger';
import { ensureDealEntities } from '@/lib/services/entityResolutionService';

interface UseDealCreationOptions {
  userData: any;
  actionType: 'deal' | 'proposal' | 'sale' | 'meeting';
  stages: any[] | null;
  defaultStage: any;
}

export function useDealCreation({ userData, actionType, stages, defaultStage }: UseDealCreationOptions) {
  const { createDeal } = useDeals(userData?.id);
  const { addActivityAsync, addSale } = useActivities();

  const handleCreateDeal = async (
    wizard: WizardState,
    setWizard: (wizard: WizardState) => void,
    setIsLoading: (loading: boolean) => void,
    onDealCreated?: (deal: any) => void
  ) => {
    if (!wizard.selectedContact) {
      toast.error('Please select a contact first');
      return;
    }

    if (!wizard.dealData.name || !wizard.dealData.company) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      setIsLoading(true);

      // Ensure company and contact exist with auto-enrichment and fuzzy matching
      logger.log('🎯 Resolving entities for deal creation...');

      let companyId: string;
      let contactId: string;

      try {
        const { companyId: resolvedCompanyId, contactId: resolvedContactId, isNewCompany, isNewContact } =
          await ensureDealEntities({
            contact_email: wizard.selectedContact.email,
            contact_name: wizard.selectedContact.full_name,
            company: wizard.dealData.company,
            owner_id: userData?.id || ''
          });

        companyId = resolvedCompanyId;
        contactId = resolvedContactId;

        // Show feedback to user
        if (isNewCompany) {
          logger.log('✨ Auto-created company from domain, enriching in background...');
          toast.success('Company auto-created and enriching...', { duration: 3000 });
        }
        if (isNewContact) {
          logger.log('✨ Auto-created contact record');
          toast.success('Contact auto-created', { duration: 2000 });
        }
      } catch (entityError) {
        logger.error('❌ Entity resolution failed:', entityError);
        toast.error('Failed to resolve company/contact. Please try again.');
        setIsLoading(false);
        return;
      }

      // Set stage based on action type
      let stageId;
      if (actionType === 'sale') {
        const signedStage = stages?.find(s => s.name === 'Signed');
        if (signedStage) {
          stageId = signedStage.id;
        } else {
          // Fallback to default stage if Signed not found
          stageId = wizard.dealData.stage_id || defaultStage?.id;
        }
      } else if (actionType === 'meeting') {
        const sqlStage = stages?.find(s => s.name === 'SQL' || s.name === 'sql');
        if (sqlStage) {
          stageId = sqlStage.id;
        } else {
          // Fallback to default stage if SQL not found
          stageId = wizard.dealData.stage_id || defaultStage?.id;
        }
      } else {
        stageId = wizard.dealData.stage_id || defaultStage?.id;
      }

      const dealData = {
        name: wizard.dealData.name,
        company: wizard.dealData.company,
        // Entity resolution ensures these FKs are always set
        company_id: companyId,
        primary_contact_id: contactId,
        contact_name: wizard.selectedContact.full_name,
        contact_email: wizard.selectedContact.email,
        contact_phone: wizard.selectedContact.phone || wizard.dealData.contact_phone,
        value: wizard.dealData.value,
        description: wizard.dealData.description,
        stage_id: stageId,
        owner_id: userData?.id || '',
        expected_close_date: wizard.dealData.expected_close_date || null,
        probability: actionType === 'sale' ? 100 : (defaultStage?.default_probability || 10),
        status: 'active',
        // For sales, set the revenue fields based on the actual revenue split
        ...(actionType === 'sale' && {
          one_off_revenue: wizard.dealData.oneOffRevenue || 0,
          monthly_mrr: wizard.dealData.monthlyMrr || 0,
          annual_value: wizard.dealData.monthlyMrr ? (wizard.dealData.monthlyMrr * 12) : null
        })
      };

      logger.log('📝 Creating deal with data:', dealData);
      const newDeal = await createDeal(dealData);
      logger.log('📦 Deal creation result:', newDeal);
      
      if (newDeal && newDeal.id) {
        // Deal created successfully
        logger.log('✅ Deal created successfully with ID:', newDeal.id);
        
        // Create an activity for deal creation, proposal, or sale
        if (actionType === 'deal' || actionType === 'proposal' || actionType === 'sale') {
          try {
            // IMPORTANT: Wait for database transaction to fully commit
            // This is critical to avoid foreign key constraint violations
            logger.log('⏳ Waiting for deal transaction to commit...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Now verify deal exists in database before creating activity
            let dealVerified = false;
            let attempts = 0;
            const maxAttempts = 10; // Increased attempts
            
            logger.log('🔍 Verifying deal exists in database before creating activity...');
            
            while (!dealVerified && attempts < maxAttempts) {
              attempts++;
              
              try {
                // Use a fresh supabase instance to avoid cache issues
                const { data: dealExists, error: verifyError } = await supabase
                  .from('deals')
                  .select('id, name, created_at')
                  .eq('id', newDeal.id)
                  .single(); // Use single() instead of maybeSingle() to get better error info
                
                if (verifyError) {
                  logger.log(`⚠️ Verification attempt ${attempts}/${maxAttempts} - Deal not found yet:`, verifyError.message);
                  
                  // Wait before next attempt with exponential backoff
                  if (attempts < maxAttempts) {
                    const waitTime = Math.min(1000 * Math.pow(1.5, attempts), 5000);
                    logger.log(`⏳ Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                  }
                } else if (dealExists && dealExists.id) {
                  dealVerified = true;
                  logger.log(`✅ Deal verified in database after ${attempts} attempt(s):`, {
                    id: dealExists.id,
                    name: dealExists.name,
                    created: dealExists.created_at
                  });
                  break; // Exit the loop immediately
                }
              } catch (err) {
                logger.log(`⚠️ Verification attempt ${attempts} error:`, err);
                if (attempts < maxAttempts) {
                  const waitTime = Math.min(1000 * Math.pow(1.5, attempts), 5000);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                }
              }
            }
            
            if (!dealVerified) {
              logger.error('❌ Could not verify deal in database after maximum attempts');
              logger.log('⚠️ Skipping activity creation to avoid foreign key error');
              toast.warning('Deal created successfully, but proposal activity could not be added. You can add it manually from the deal details.');
              return; // Skip activity creation entirely
            }
            
            // Now create the activity - deal has been verified
            // For sales, we create a sale activity instead
            if (actionType === 'sale') {
              logger.log('💰 Creating sale activity for verified deal...');
              
              try {
                // Calculate total amount using same business logic as QuickAdd
                const totalAmount = (wizard.dealData.monthlyMrr * 3) + wizard.dealData.oneOffRevenue;
                
                await addSale({
                  client_name: wizard.dealData.company || wizard.dealData.name,
                  amount: totalAmount,
                  details: `Sale closed: ${wizard.dealData.name}`,
                  saleType: wizard.dealData.saleType as 'one-off' | 'subscription' | 'lifetime',
                  date: new Date().toISOString(),
                  deal_id: newDeal.id,
                  contactIdentifier: wizard.selectedContact?.email,
                  contactIdentifierType: wizard.selectedContact?.email ? 'email' : 'unknown',
                  oneOffRevenue: wizard.dealData.oneOffRevenue,
                  monthlyMrr: wizard.dealData.monthlyMrr
                });
                logger.log('✅ Sale activity created successfully for deal:', newDeal.id);
              } catch (error) {
                logger.error('❌ Failed to create sale activity:', error);
                // Continue anyway - deal was created successfully
              }
            } else {
              // Original logic for deal and proposal
              const activityType = actionType === 'proposal' ? 'proposal' : 'meeting';
              const activityDetails = actionType === 'proposal' 
                ? `Proposal sent: ${wizard.dealData.name}`
                : `New deal created: ${wizard.dealData.name}`;
              
              logger.log(`📝 Creating ${activityType} activity for verified deal...`);
              
              try {
                // Calculate total amount using same business logic as QuickAdd for proposals
                const proposalAmount = (wizard.dealData.monthlyMrr * 3) + wizard.dealData.oneOffRevenue;
                
                await addActivityAsync({
                  type: activityType as 'proposal' | 'meeting',
                  client_name: wizard.dealData.company || wizard.dealData.name,
                  details: activityDetails,
                  amount: proposalAmount || wizard.dealData.value,
                  priority: 'high',
                  date: new Date().toISOString(),
                  status: 'completed',
                  deal_id: newDeal.id,
                  contactIdentifier: wizard.selectedContact?.email,
                  contactIdentifierType: wizard.selectedContact?.email ? 'email' : 'unknown',
                  ...(activityType === 'proposal' && {
                    oneOffRevenue: wizard.dealData.oneOffRevenue,
                    monthlyMrr: wizard.dealData.monthlyMrr
                  })
                });
                logger.log(`✅ ${activityType} activity created successfully for deal:`, newDeal.id);
              } catch (error) {
                logger.error(`❌ Failed to create ${activityType} activity:`, error);
                // Continue anyway - deal was created successfully
              }
            }
          } catch (outerError) {
            // This catch handles any unexpected errors in the entire verification/creation flow
            logger.error('Unexpected error in proposal activity flow:', outerError);
            toast.warning('Deal created successfully. Proposal activity may need to be added manually.');
          }
        }
        
        setWizard({ ...wizard, step: 'success' });
        
        // Show appropriate success message based on action type
        if (actionType === 'proposal') {
          toast.success('Deal and proposal created successfully!');
        } else if (actionType === 'sale') {
          toast.success('Sale recorded successfully! 🎉');
        } else {
          toast.success('Deal created successfully!');
        }
        
        if (onDealCreated) {
          onDealCreated(newDeal);
        }
        
        return newDeal;
      } else {
        // Deal creation failed - no deal returned
        logger.error('❌ Deal creation failed - no deal returned. Response:', newDeal);
        toast.error('Failed to create deal - please check the console for details');
      }
    } catch (error) {
      logger.error('Error creating deal:', error);
      toast.error('Failed to create deal. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleCreateDeal
  };
}