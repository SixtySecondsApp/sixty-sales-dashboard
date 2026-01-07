/**
 * EmailActionCenter
 *
 * Unified email action center for reviewing, editing, and sending AI-generated email drafts.
 * Supports both HITL approval records and notification-based email actions.
 */

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Send,
  X,
  CheckCircle2,
  Edit,
  Clock,
  User,
  Building2,
  Calendar,
  Loader2,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { toast } from 'sonner';
import {
  useEmailActions,
  useEmailAction,
  useApproveEmailAction,
  useRejectEmailAction,
} from '@/lib/hooks/useEmailActions';
import { formatDistanceToNow } from 'date-fns';
import { TipTapEditor } from '@/components/email/TipTapEditor';

export default function EmailActionCenter() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { data: actions, isLoading } = useEmailActions();
  const { data: selectedAction } = useEmailAction(id);
  const approveMutation = useApproveEmailAction();
  const rejectMutation = useRejectEmailAction();

  const [editedContent, setEditedContent] = useState<{
    to: string;
    subject: string;
    body: string;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Filter actions by status
  const pendingActions = useMemo(
    () => actions?.filter(a => a.status === 'pending') || [],
    [actions]
  );
  const completedActions = useMemo(
    () => actions?.filter(a => a.status !== 'pending') || [],
    [actions]
  );

  // Initialize edited content when action is selected
  useEffect(() => {
    if (selectedAction && !editedContent && !isEditing) {
      setEditedContent({
        to: selectedAction.emailContent.to,
        subject: selectedAction.emailContent.subject,
        body: selectedAction.emailContent.body,
      });
    }
  }, [selectedAction, editedContent, isEditing]);

  const handleSelectAction = (actionId: string) => {
    navigate(`/email-actions/${actionId}`);
    setIsEditing(false);
    setEditedContent(null);
  };

  const handleApprove = async () => {
    if (!id) return;

    const content = isEditing && editedContent ? editedContent : undefined;
    await approveMutation.mutateAsync({ actionId: id, editedContent: content });
    
    // Navigate back to list after successful send
    navigate('/email-actions');
    setIsEditing(false);
    setEditedContent(null);
  };

  const handleReject = async () => {
    if (!id) return;
    await rejectMutation.mutateAsync(id);
    navigate('/email-actions');
  };

  const handleEdit = () => {
    if (!selectedAction) return;
    setIsEditing(true);
    setEditedContent({
      to: selectedAction.emailContent.to,
      subject: selectedAction.emailContent.subject,
      body: selectedAction.emailContent.body,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'default', label: 'Pending' },
      approved: { variant: 'secondary', label: 'Approved' },
      sent: { variant: 'secondary', label: 'Sent' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      expired: { variant: 'outline', label: 'Expired' },
    };

    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Mail className="w-6 h-6" />
                Email Action Center
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Review and send AI-generated email drafts
              </p>
            </div>
            {pendingActions.length > 0 && (
              <Badge variant="default" className="text-sm px-3 py-1">
                {pendingActions.length} pending
              </Badge>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Panel - Actions List */}
            <ResizablePanel defaultSize={40} minSize={30} maxSize={60}>
              <div className="h-full border-r border-gray-200 dark:border-gray-800 flex flex-col">
                <Tabs defaultValue="pending" className="h-full flex flex-col">
                  <div className="px-4 pt-4 border-b border-gray-200 dark:border-gray-800">
                    <TabsList>
                      <TabsTrigger value="pending">
                        Pending ({pendingActions.length})
                      </TabsTrigger>
                      <TabsTrigger value="completed">
                        Completed ({completedActions.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="pending" className="flex-1 m-0 p-0">
                    <ScrollArea className="h-full">
                      {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : pendingActions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                          <Mail className="w-12 h-12 text-muted-foreground mb-4" />
                          <p className="text-sm text-muted-foreground">
                            No pending email actions
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 space-y-2">
                          {pendingActions.map((action) => (
                            <Card
                              key={action.id}
                              className={cn(
                                'cursor-pointer transition-all hover:shadow-md',
                                id === action.id && 'ring-2 ring-primary'
                              )}
                              onClick={() => handleSelectAction(action.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                      <p className="font-medium text-sm truncate">
                                        {action.title}
                                      </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate mb-2">
                                      To: {action.emailContent.recipientName || action.emailContent.to}
                                    </p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {action.emailContent.subject}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      {getStatusBadge(action.status)}
                                      <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(action.created_at), {
                                          addSuffix: true,
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="completed" className="flex-1 m-0 p-0">
                    <ScrollArea className="h-full">
                      {completedActions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                          <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
                          <p className="text-sm text-muted-foreground">
                            No completed actions
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 space-y-2">
                          {completedActions.map((action) => (
                            <Card
                              key={action.id}
                              className={cn(
                                'cursor-pointer transition-all hover:shadow-md opacity-75',
                                id === action.id && 'ring-2 ring-primary opacity-100'
                              )}
                              onClick={() => handleSelectAction(action.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                      <p className="font-medium text-sm truncate">
                                        {action.title}
                                      </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate mb-2">
                                      To: {action.emailContent.recipientName || action.emailContent.to}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      {getStatusBadge(action.status)}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel - Email Detail */}
            <ResizablePanel defaultSize={60} minSize={40}>
              <ScrollArea className="h-full">
                {!selectedAction ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <Mail className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Select an email action</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose an email from the list to review and send
                    </p>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-semibold mb-1">
                          {selectedAction.title}
                        </h2>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(selectedAction.status)}
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(selectedAction.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Original Email Context */}
                    {selectedAction.originalEmail && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Original Email</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">From</Label>
                            <p className="text-sm">
                              {selectedAction.originalEmail.fromName || selectedAction.originalEmail.from}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Subject</Label>
                            <p className="text-sm">{selectedAction.originalEmail.subject}</p>
                          </div>
                          {selectedAction.originalEmail.snippet && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Preview</Label>
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {selectedAction.originalEmail.snippet}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Linked Entities */}
                    {(selectedAction.contactId || selectedAction.dealId || selectedAction.meetingId) && (
                      <div className="flex flex-wrap gap-2">
                        {selectedAction.contactId && (
                          <Badge variant="outline" className="gap-1">
                            <User className="w-3 h-3" />
                            Contact
                          </Badge>
                        )}
                        {selectedAction.dealId && (
                          <Badge variant="outline" className="gap-1">
                            <Building2 className="w-3 h-3" />
                            Deal
                          </Badge>
                        )}
                        {selectedAction.meetingId && (
                          <Badge variant="outline" className="gap-1">
                            <Calendar className="w-3 h-3" />
                            Meeting
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Email Editor */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Email Draft</CardTitle>
                          {!isEditing && selectedAction.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleEdit}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="to">To</Label>
                          {isEditing ? (
                            <Input
                              id="to"
                              value={editedContent?.to || ''}
                              onChange={(e) =>
                                setEditedContent({
                                  ...editedContent!,
                                  to: e.target.value,
                                })
                              }
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-sm mt-1">
                              {selectedAction.emailContent.recipientName || selectedAction.emailContent.to}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="subject">Subject</Label>
                          {isEditing ? (
                            <Input
                              id="subject"
                              value={editedContent?.subject || ''}
                              onChange={(e) =>
                                setEditedContent({
                                  ...editedContent!,
                                  subject: e.target.value,
                                })
                              }
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-sm mt-1">
                              {selectedAction.emailContent.subject}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="body">Body</Label>
                          {isEditing ? (
                            <div className="mt-1">
                              <TipTapEditor
                                value={editedContent?.body || ''}
                                onChange={(html) =>
                                  setEditedContent({
                                    ...editedContent!,
                                    body: html,
                                  })
                                }
                                placeholder="Write your email..."
                              />
                            </div>
                          ) : (
                            <div
                              className="mt-1 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 prose prose-sm max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{
                                __html: selectedAction.emailContent.body || '',
                              }}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    {selectedAction.status === 'pending' && (
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleApprove}
                          disabled={approveMutation.isPending}
                          className="flex-1"
                        >
                          {approveMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              {isEditing ? 'Save & Send' : 'Approve & Send'}
                            </>
                          )}
                        </Button>
                        {isEditing && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditing(false);
                              setEditedContent(null);
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={handleReject}
                          disabled={rejectMutation.isPending}
                        >
                          {rejectMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <X className="w-4 h-4 mr-2" />
                              Dismiss
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {selectedAction.status !== 'pending' && (
                      <Alert>
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription>
                          This email action has been {selectedAction.status}.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </ScrollArea>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
