# Administrative Guide - Revenue Split & Security Features

Comprehensive guide for administrators managing the Sixty Sales Dashboard's advanced features.

## 🔐 Admin Access & Setup

### Enabling Admin Access
1. **Database Setup**: Ensure `is_admin` column exists in `profiles` table
2. **User Configuration**: Set `is_admin = true` for admin users
3. **Verification**: Admin users will see additional options in the interface

### Admin Identification
```sql
-- Check admin status
SELECT email, is_admin FROM profiles WHERE is_admin = true;

-- Grant admin access
UPDATE profiles SET is_admin = true WHERE email = 'admin@company.com';
```

## 💰 Revenue Split Management

### What are Revenue Splits?
Revenue splits allow administrators to track deals with both:
- **One-off Revenue**: Single payment amount
- **Monthly Recurring Revenue (MRR)**: Ongoing subscription value

### Business Rules
- **LTV Calculation**: `(Monthly MRR × 3) + One-off Revenue`
- **Split Definition**: Deal with BOTH one-off AND monthly revenue > 0
- **Admin Only**: Only administrators can create or modify revenue splits

### Creating Split Deals

#### Via QuickAdd Interface
1. Click "Quick Add" button
2. Select "Add Sale" or "Add Proposal"
3. **Admin Section Appears**: Revenue split fields visible to admins only
4. Enter both one-off and monthly amounts
5. System automatically calculates total deal value

#### Via Deal Wizard  
1. Click "Create Deal"
2. Complete standard deal information
3. **Revenue Split Section**: Available in admin view
4. Configure one-off and MRR amounts
5. Deal marked as "split" when both values present

### Split Deal Restrictions
- **Deletion Protection**: Non-admins cannot delete split deals
- **Edit Protection**: Non-admins cannot modify split deal revenue
- **Ownership Override**: Admin permissions supersede ownership

## 🛡️ Security & Permissions

### Permission Matrix

| Action | Admin | Standard User | Notes |
|--------|-------|---------------|-------|
| Create revenue splits | ✅ | ❌ | Admin only feature |
| Edit split deals | ✅ | ❌ | Revenue data protected |
| Delete split deals | ✅ | ❌ | Financial data protected |
| Delete own non-split deals | ✅ | ✅ | Standard ownership rules |
| View audit logs | ✅ | ❌ | Admin oversight only |
| User impersonation | ✅ | ❌ | Support functionality |

### UI Security Indicators
- **Admin Badge**: Visible admin status indicator
- **Revenue Split Sections**: Green highlighting for admin-only areas
- **Warning Messages**: Non-admin users see permission warnings
- **Protected Actions**: Disabled buttons for unauthorized actions

## 📊 Admin Dashboard Features

### Enhanced Analytics
Administrators get access to:
- **Revenue Split Analytics**: Breakdown of one-off vs. recurring revenue
- **MRR Tracking**: Monthly recurring revenue trending
- **Deal Value Analysis**: Comprehensive financial reporting
- **User Activity Monitoring**: Cross-user activity visibility

### Audit Logging
Every admin action creates an audit trail:
- **Revenue Split Creation**: Who, what, when details
- **Deal Modifications**: Before/after value tracking
- **Permission Changes**: User access modifications
- **Bulk Operations**: Import and data management actions

### Administrative Controls
- **User Management**: View and manage user accounts
- **Pipeline Configuration**: Advanced stage management
- **Data Import**: Bulk data operations
- **System Health**: Performance and security monitoring

## 🔧 Implementation Examples

### Checking Admin Status (Frontend)
```typescript
import { canSplitDeals, canDeleteDeal } from '@/lib/utils/adminUtils';

// Check if user can split deals
const userCanSplit = canSplitDeals(userData);

// Check if user can delete a specific deal
const canDelete = canDeleteDeal(deal, userData);

// Render admin-only sections
{canSplitDeals(userData) && (
  <div className="admin-revenue-split">
    {/* Admin-only revenue split controls */}
  </div>
)}
```

### API Permission Validation (Backend)
```javascript
// Validate admin access for revenue operations
function validateAdminAccess(user) {
  if (!user?.is_admin) {
    throw new Error('Admin privileges required for revenue operations');
  }
}

// Create split deal with admin validation  
async function createSplitDeal(dealData, user) {
  if (dealData.one_off_revenue || dealData.monthly_mrr) {
    validateAdminAccess(user);
  }
  // Proceed with deal creation
}
```

## 🚨 Common Admin Scenarios

### Scenario 1: Revenue Split Creation
**User**: Admin wants to create a £50k deal with £10k upfront and £2k/month
**Process**:
1. Use QuickAdd → "Add Sale"
2. Enter one-off revenue: £10,000
3. Enter monthly MRR: £2,000
4. System calculates LTV: £16,000 (2k×3 + 10k)
5. Deal marked as "split" automatically

### Scenario 2: Non-Admin Attempts Split
**User**: Standard user tries to create revenue split
**System Response**:
1. Revenue split fields not visible in UI
2. Warning message displayed
3. Standard amount field available only
4. No split deal creation possible

### Scenario 3: Split Deal Protection
**User**: Non-admin tries to delete valuable split deal
**System Response**:
1. Delete button disabled for split deals
2. Error message if attempted via API
3. Admin notification of attempt (optional)
4. Deal remains protected

## 🔍 Troubleshooting

### Common Issues

#### "Cannot see revenue split options"
**Cause**: User not marked as admin
**Solution**: 
```sql
UPDATE profiles SET is_admin = true WHERE email = 'user@company.com';
```

#### "Split deal won't delete"
**Cause**: Split deals protected from non-admin deletion
**Solution**: Admin must delete, or remove split status first

#### "Revenue calculations incorrect"
**Cause**: Business rule misunderstanding
**Solution**: Verify LTV = (MRR × 3) + One-off formula

### Validation Errors
- **"Admin privileges required"**: User lacks admin access
- **"Cannot modify split deal"**: Non-admin attempting edit
- **"Invalid revenue split"**: Both one-off and MRR required

## 📋 Admin Checklist

### New Admin Setup
- [ ] Database `is_admin` flag set to `true`
- [ ] User can see admin sections in UI
- [ ] Revenue split functionality accessible
- [ ] Audit logging working correctly
- [ ] Permission restrictions enforced

### Regular Admin Tasks
- [ ] Review audit logs for suspicious activity
- [ ] Monitor revenue split deal creation
- [ ] Verify financial calculations accuracy
- [ ] Check system performance metrics
- [ ] Validate security policy enforcement

## 🔮 Advanced Features

### Bulk Operations
Admins can perform bulk operations:
- **Data Import**: CSV import with validation
- **Deal Updates**: Batch modifications
- **User Management**: Multi-user permission changes

### API Integration
Admin endpoints for:
- Revenue analytics export
- Audit log retrieval
- System health monitoring
- User activity reporting

### Future Enhancements
- **Role-based permissions**: Granular permission system
- **Approval workflows**: Multi-step approval for large deals
- **Advanced reporting**: Custom dashboard creation
- **Integration hub**: Third-party system connections

---

## 🆘 Support & Escalation

For admin-related issues:
1. **Check Audit Logs**: Review system activity
2. **Validate Permissions**: Confirm admin status
3. **Test Functionality**: Use admin test scenarios
4. **Review Security**: Ensure proper access controls

**Emergency Contacts**: Refer to system administration documentation for escalation procedures.