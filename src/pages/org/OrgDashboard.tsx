/**
 * OrgDashboard - Organization Admin Dashboard (Tier 2)
 *
 * Hub for organization administrators to manage their team,
 * branding, and organization settings.
 */

import { Link } from 'react-router-dom';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import {
  Users,
  Palette,
  Building,
  ArrowRight,
  Crown,
  Shield,
  UserCheck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function OrgDashboard() {
  const { currentOrg, members } = useOrg();
  const { isOrgOwner, isOrgAdmin, isPlatformAdmin } = useUserPermissions();

  // Get role badge
  const getRoleBadge = () => {
    if (isPlatformAdmin) {
      return (
        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
          <Shield className="w-3 h-3 mr-1" />
          Platform Admin
        </Badge>
      );
    }
    if (isOrgOwner) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
          <Crown className="w-3 h-3 mr-1" />
          Owner
        </Badge>
      );
    }
    if (isOrgAdmin) {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
          <UserCheck className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      );
    }
    return null;
  };

  const adminCards = [
    {
      title: 'Team Management',
      description: 'Invite members, manage roles, and remove users from your organization',
      icon: Users,
      href: '/org/team',
      stats: members ? `${members.length} member${members.length !== 1 ? 's' : ''}` : null,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Organization Branding',
      description: 'Customize your organization\'s logo and visual identity',
      icon: Palette,
      href: '/org/branding',
      stats: null,
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Building className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Organization Settings
              </h1>
              {currentOrg && (
                <p className="text-gray-600 dark:text-gray-400">
                  {currentOrg.name}
                </p>
              )}
            </div>
            <div className="ml-auto">
              {getRoleBadge()}
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your organization's team and branding settings.
          </p>
        </div>

        {/* Admin Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {adminCards.map((card) => (
            <Link key={card.href} to={card.href} className="group">
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl ${card.color}`}>
                      <card.icon className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="text-lg mt-4">{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                {card.stats && (
                  <CardContent className="pt-0">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {card.stats}
                    </div>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>

        {/* Info Card for non-owners */}
        {!isOrgOwner && !isPlatformAdmin && (
          <Card className="mt-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Admin Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                As an organization admin, you can manage team members and branding.
                Contact the organization owner for billing or subscription changes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
