"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ClipboardList, User, FileText, DollarSign, Lock, Settings, BarChart, 
  Search, Trash2, Filter, X, AlertTriangle, CheckSquare, Square, RefreshCw
} from "lucide-react";

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details: string | null;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  timestamp: Date | string;
}

interface Stats {
  total: number;
  creates: number;
  updates: number;
  deletes: number;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case 'client':
      return <User className="h-4 w-4" />;
    case 'matter':
      return <FileText className="h-4 w-4" />;
    case 'transaction':
      return <DollarSign className="h-4 w-4" />;
    case 'hold':
      return <Lock className="h-4 w-4" />;
    case 'settings':
      return <Settings className="h-4 w-4" />;
    case 'report':
      return <BarChart className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getActionBadge(action: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    create: { variant: 'default', label: 'Created' },
    update: { variant: 'secondary', label: 'Updated' },
    delete: { variant: 'destructive', label: 'Deleted' },
    release: { variant: 'outline', label: 'Released' },
    view: { variant: 'outline', label: 'Viewed' },
    export: { variant: 'outline', label: 'Exported' },
  };
  const config = variants[action] || { variant: 'outline' as const, label: action };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatDetails(details: string | null): React.ReactNode {
  if (!details) return '-';
  
  try {
    const parsed = JSON.parse(details);
    
    if (parsed.changes) {
      const changeEntries = Object.entries(parsed.changes);
      if (changeEntries.length === 0) return 'No changes';
      
      return (
        <div className="text-xs space-y-1">
          {changeEntries.map(([field, change]: [string, unknown]) => {
            const c = change as { from: unknown; to: unknown };
            return (
              <div key={field}>
                <span className="font-medium">{field}:</span>{' '}
                <span className="text-muted-foreground">{String(c.from || 'empty')}</span>
                {' → '}
                <span className="text-foreground">{String(c.to || 'empty')}</span>
              </div>
            );
          })}
        </div>
      );
    }
    
    const entries = Object.entries(parsed).filter(([key]) => 
      !['changes'].includes(key) && parsed[key] !== null && parsed[key] !== undefined
    );
    
    if (entries.length === 0) return '-';
    
    return (
      <div className="text-xs space-y-1">
        {entries.slice(0, 4).map(([key, value]) => (
          <div key={key}>
            <span className="font-medium">{key}:</span>{' '}
            <span className="text-foreground">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
        {entries.length > 4 && (
          <div className="text-muted-foreground">+{entries.length - 4} more</div>
        )}
      </div>
    );
  } catch {
    return <span className="text-xs text-muted-foreground">{details.substring(0, 100)}</span>;
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, creates: 0, updates: 0, deletes: 0 });
  const [pagination, setPagination] = useState<Pagination>({ total: 0, limit: 200, offset: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<'selected' | 'all' | 'before'>('selected');
  const [deleteBeforeDate, setDeleteBeforeDate] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [action, setAction] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (entityType !== 'all') params.set('entityType', entityType);
      if (action !== 'all') params.set('action', action);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/audit?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [search, entityType, action, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map(l => l.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    try {
      let body: Record<string, unknown> = {};
      
      if (deleteType === 'all') {
        body = { deleteAll: true };
      } else if (deleteType === 'before' && deleteBeforeDate) {
        body = { beforeDate: deleteBeforeDate };
      } else if (deleteType === 'selected' && selectedIds.size > 0) {
        body = { ids: Array.from(selectedIds) };
      } else {
        return;
      }

      const response = await fetch('/api/audit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setSelectedIds(new Set());
        setShowDeleteConfirm(false);
        setDeleteBeforeDate('');
        fetchLogs();
      } else {
        alert('Failed to delete audit logs');
      }
    } catch (error) {
      console.error('Error deleting audit logs:', error);
      alert('Failed to delete audit logs');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setEntityType('all');
    setAction('all');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = search || entityType !== 'all' || action !== 'all' || startDate || endDate;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground mt-1">Track all system activity and changes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && <Badge className="ml-2" variant="secondary">Active</Badge>}
          </Button>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search entity ID, details, or user..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div>
                <Label htmlFor="entityType">Entity Type</Label>
                <Select
                  id="entityType"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="client">Client</option>
                  <option value="matter">Matter</option>
                  <option value="transaction">Transaction</option>
                  <option value="hold">Hold</option>
                  <option value="settings">Settings</option>
                  <option value="report">Report</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="action">Action</Label>
                <Select
                  id="action"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                >
                  <option value="all">All Actions</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="release">Release</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Creates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.creates}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.updates}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deletes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.deletes}</div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Actions */}
      {selectedIds.size > 0 && (
        <div className="mb-6 flex items-center justify-between px-4 py-3 bg-muted rounded-lg border border-border">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteType('selected');
                setShowDeleteConfirm(true);
              }}
              className="px-4"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Confirm Deletion
              </CardTitle>
              <CardDescription>
                {deleteType === 'all' && 'This will permanently delete ALL audit logs. This action cannot be undone.'}
                {deleteType === 'selected' && `This will permanently delete ${selectedIds.size} selected audit log(s).`}
                {deleteType === 'before' && 'This will permanently delete all audit logs before the specified date.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deleteType === 'before' && (
                <div className="mb-4">
                  <Label htmlFor="deleteBeforeDate">Delete logs before:</Label>
                  <Input
                    id="deleteBeforeDate"
                    type="date"
                    value={deleteBeforeDate}
                    onChange={(e) => setDeleteBeforeDate(e.target.value)}
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteType === 'before' && !deleteBeforeDate}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            {hasActiveFilters ? `Showing ${logs.length} filtered results` : `Showing ${logs.length} of ${pagination.total} events`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground/50" />
              <p>Loading audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No audit events found</p>
              <p className="text-sm mt-1">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Activity will be logged as you use the system'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <button onClick={handleSelectAll} className="p-1">
                      {selectedIds.size === logs.length ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                    <TableRow key={log.id} className={selectedIds.has(log.id) ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <button onClick={() => handleSelectOne(log.id)} className="p-1">
                        {selectedIds.has(log.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(log.timestamp)}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEntityIcon(log.entityType)}
                        <div>
                          <p className="font-medium capitalize">{log.entityType}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {log.entityId.length > 20 ? `${log.entityId.substring(0, 8)}...` : log.entityId}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="max-w-md">
                      {formatDetails(log.details)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.userEmail || log.userId || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
