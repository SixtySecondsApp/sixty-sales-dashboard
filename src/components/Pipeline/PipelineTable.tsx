import React, { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronUp,
  Edit,
  Trash,
  Calendar,
  PoundSterling,
  Users,
  Circle,
  Phone,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { usePipeline } from '@/lib/contexts/PipelineContext';
import { useUser } from '@/lib/hooks/useUser';
import { canDeleteDeal, isDealSplit } from '@/lib/utils/adminUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PipelineTableProps {
  onDealClick: (deal: any) => void;
  onDeleteDeal: (id: string) => void;
}

function PipelineTableComponent({ onDealClick, onDeleteDeal }: PipelineTableProps) {
  const { userData } = useUser();
  const [sorting, setSorting] = useState([]);
  const { deals, stages, searchTerm, filterOptions, deleteDeal } = usePipeline();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<string | null>(null);

  // Filter deals based on current filters
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // Apply search filter
      if (searchTerm && !(
        deal.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )) {
        return false;
      }
      
      // Apply value filter
      if (filterOptions.minValue && deal.value < filterOptions.minValue) {
        return false;
      }
      if (filterOptions.maxValue && deal.value > filterOptions.maxValue) {
        return false;
      }
      
      // Apply probability filter
      if (filterOptions.probability && deal.probability < filterOptions.probability) {
        return false;
      }
      
      return true;
    });
  }, [deals, searchTerm, filterOptions]);

  const handleRowClick = useCallback((id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  }, [expandedRow]);

  const handleDeleteClick = useCallback((id: string) => {
    setDealToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (dealToDelete) {
      await deleteDeal(dealToDelete);
      setDeleteDialogOpen(false);
      setDealToDelete(null);
      onDeleteDeal(dealToDelete);
    }
  }, [dealToDelete, deleteDeal, onDeleteDeal]);

  const getStage = useCallback((stageId: string) => {
    return stages.find(s => s.id === stageId);
  }, [stages]);

  const getStageColor = useCallback((stageId: string) => {
    const stage = getStage(stageId);
    return stage?.color || 'gray';
  }, [getStage]);

  const getStageName = useCallback((stageId: string) => {
    const stage = getStage(stageId);
    return stage?.name || 'Unknown';
  }, [getStage]);

  const getActivityIcon = useCallback((type: string) => {
    switch (type) {
      case 'sale':
        return PoundSterling;
      case 'outbound':
        return Phone;
      case 'meeting':
        return Users;
      case 'proposal':
        return FileText;
      default:
        return FileText;
    }
  }, []);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(value);
  }, []);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'company',
        header: 'Company',
        cell: ({ row }) => {
          const deal = row.original;
          return (
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleRowClick(deal.id)}>
              <div className="w-9 h-9 rounded-lg bg-gray-800/70 border border-gray-700/50 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-300">
                  {deal.company?.charAt(0)?.toUpperCase() || '#'}
                </span>
              </div>
              <div>
                <div className="text-sm font-medium text-white">{deal.company || 'Unknown Company'}</div>
                <div className="text-xs text-gray-400">{deal.name}</div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'value',
        header: 'Deal Value',
        cell: ({ row }) => {
          const value = parseFloat(row.original.value);
          return (
            <div className="text-sm font-medium text-white">
              {formatCurrency(value)}
            </div>
          );
        },
      },
      {
        accessorKey: 'stage_id',
        header: 'Stage',
        cell: ({ row }) => {
          const stageId = row.original.stage_id;
          const stageName = getStageName(stageId);
          const stageColor = getStageColor(stageId);
          const stage = getStage(stageId);
          
          // Create styles for the color indicator, handling custom colors
          let indicatorStyles = {};
          
          if (stage?.color) {
            indicatorStyles = {
              backgroundColor: stage.color
            };
          }
          
          return (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-md" style={indicatorStyles}></div>
              <span className="text-sm text-white">{stageName}</span>
              {stage?.default_probability && (
                <span className="text-xs text-gray-400 ml-1">({stage.default_probability}%)</span>
              )}
            </div>
          );
        }
      },
      {
        accessorKey: 'probability',
        header: 'Probability',
        cell: ({ row }) => {
          const probability = row.original.probability || 0;
          const stageId = row.original.stage_id;
          const stageColor = getStageColor(stageId);
          const stage = getStage(stageId);
          
          // Create styles for the progress bar
          let progressStyles = {};
          
          if (stage?.color) {
            progressStyles = {
              backgroundColor: stage.color
            };
          } else {
            progressStyles = {
              backgroundColor: '#10b981' // Default to emerald-500
            };
          }
          
          return (
            <div className="flex items-center gap-2">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="h-2 rounded-full" 
                  style={{ 
                    width: `${probability}%`,
                    ...progressStyles
                  }}
                ></div>
              </div>
              <span className="text-xs text-gray-400">{probability}%</span>
            </div>
          );
        }
      },
      {
        accessorKey: 'contact_name',
        header: 'Contact',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-white">{row.original.contact_name || 'No contact'}</span>
          </div>
        )
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => {
          const date = new Date(row.original.created_at);
          return (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">{format(date, 'MMM d, yyyy')}</span>
            </div>
          );
        }
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const deal = row.original;
          const canDelete = canDeleteDeal(deal, userData);
          const isSplit = isDealSplit(deal);
          
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDealClick(deal);
                }}
                className="h-8 w-8 text-gray-400 hover:text-white"
              >
                <Edit className="h-4 w-4" />
              </Button>
              {canDelete ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(deal.id);
                  }}
                  className="h-8 w-8 text-gray-400 hover:text-red-500"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              ) : isSplit ? (
                <div 
                  className="h-8 w-8 flex items-center justify-center text-gray-500 cursor-not-allowed"
                  title="Split deals can only be deleted by administrators"
                >
                  <Trash className="h-4 w-4 opacity-30" />
                </div>
              ) : (
                <div 
                  className="h-8 w-8 flex items-center justify-center text-gray-500 cursor-not-allowed"
                  title="You can only delete deals you own"
                >
                  <Trash className="h-4 w-4 opacity-30" />
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [stages, userData, handleRowClick, formatCurrency, getStageName, getStageColor, getStage, onDealClick, handleDeleteClick]
  );

  const table = useReactTable({
    data: filteredDeals,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                {table.getFlatHeaders().map((header) => (
                  <th
                    key={header.id}
                    className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-2 ${
                          header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: <ChevronUp className="h-4 w-4" />,
                          desc: <ChevronDown className="h-4 w-4" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr 
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                      onClick={() => handleRowClick(row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-4">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                    {expandedRow === row.original.id && (
                      <tr className="bg-gray-800/20">
                        <td colSpan={columns.length} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-400">Deal Details</h4>
                              <p className="text-sm text-white">{row.original.description || 'No description provided'}</p>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-400">Contact Information</h4>
                              <p className="text-sm text-white">{row.original.contact_name || 'No contact'}</p>
                              <p className="text-sm text-gray-400">{row.original.contact_email || 'No email'}</p>
                              <p className="text-sm text-gray-400">{row.original.contact_phone || 'No phone'}</p>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-400">Next Steps</h4>
                              <p className="text-sm text-white">{row.original.next_steps || 'No next steps defined'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-gray-400">
                    No deals match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Deal</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-300">Are you sure you want to delete this deal? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const PipelineTable = React.memo(PipelineTableComponent);