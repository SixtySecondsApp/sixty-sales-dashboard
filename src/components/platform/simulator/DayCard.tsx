/**
 * DayCard Component
 * Displays information about a specific day in the trial timeline
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  Mail,
  Home,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrialDayData } from '../simulator/types';

interface DayCardProps {
  day: number;
  data: TrialDayData;
  isExpanded: boolean;
  onToggle: () => void;
  currentDay: number;
}

export function DayCard({ day, data, isExpanded, onToggle, currentDay }: DayCardProps) {
  const isPast = day < currentDay;
  const isCurrent = day === currentDay;
  const isFuture = day > currentDay;

  return (
    <Card
      className={cn(
        'transition-all duration-200 w-full overflow-x-hidden',
        isCurrent && 'ring-2 ring-blue-500 dark:ring-blue-400',
        isPast && 'opacity-75',
        isFuture && 'opacity-50'
      )}
    >
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-lg">
                {day === 0 ? 'Day 0 - Signup' : `Day ${day}`}
              </CardTitle>
              {isCurrent && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                  Current
                </Badge>
              )}
              {isPast && (
                <Badge variant="outline" className="bg-gray-500/10 text-gray-600 dark:text-gray-400">
                  Past
                </Badge>
              )}
            </div>
            <CardDescription>{data.title}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-4 pt-0 overflow-hidden">
              {/* Trial Status */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  Trial Status
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Days Remaining:</span>
                    <span className="ml-2 font-medium">{data.trialStatus.daysRemaining}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Is Trialing:</span>
                    <span className="ml-2 font-medium">
                      {data.trialStatus.isTrialing ? (
                        <CheckCircle2 className="w-4 h-4 inline text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 inline text-red-500" />
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Has Expired:</span>
                    <span className="ml-2 font-medium">
                      {data.trialStatus.hasExpired ? (
                        <AlertCircle className="w-4 h-4 inline text-red-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 inline text-green-500" />
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Has Payment:</span>
                    <span className="ml-2 font-medium">
                      {data.trialStatus.hasPaymentMethod ? (
                        <CreditCard className="w-4 h-4 inline text-green-500" />
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Emails Sent */}
              {data.emails.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Emails Sent ({data.emails.length})
                  </h4>
                  <div className="space-y-2">
                    {data.emails.map((email, idx) => (
                      <div
                        key={idx}
                        className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{email.subject}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Type: {email.type}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {email.templateId ? 'Template' : 'System'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Screens/Routes */}
              {data.screens.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    User Experience
                  </h4>
                  <div className="space-y-2">
                    {data.screens.map((screen, idx) => (
                      <div
                        key={idx}
                        className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{screen.route}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {screen.description}
                            </p>
                            {screen.components && screen.components.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {screen.components.map((comp, compIdx) => (
                                  <Badge key={compIdx} variant="outline" className="text-xs">
                                    {comp}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Features Available */}
              {data.features.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Features Available</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.features.map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {data.notes && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-900 dark:text-amber-200">{data.notes}</p>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

