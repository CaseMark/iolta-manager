'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Briefcase, Filter } from "lucide-react";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Matter {
  id: string;
  clientId: string;
  name: string;
  matterNumber: string | null;
  status: string | null;
  practiceArea: string | null;
  openDate: Date;
  createdAt: Date;
  clientName: string | null;
  balance: number;
}

interface Client {
  id: string;
  name: string;
}

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch matters
      const mattersRes = await fetch('/api/matters');
      const mattersData = await mattersRes.json();
      setMatters(mattersData);

      // Fetch clients for filter
      const clientsRes = await fetch('/api/clients');
      const clientsData = await clientsRes.json();
      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter matters by selected client
  const filteredMatters = selectedClientId
    ? matters.filter(m => m.clientId === selectedClientId)
    : matters;

  const selectedClient = selectedClientId
    ? clients.find(c => c.id === selectedClientId)
    : null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Matters</h1>
          <p className="text-muted-foreground mt-1">Manage client matters and trust accounts</p>
        </div>
        <Link href="/matters/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Matter
          </Button>
        </Link>
      </div>

      {/* Client Filter */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter by Client
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select
              value={selectedClientId || ""}
              onChange={(e) => setSelectedClientId(e.target.value || null)}
              className="w-[280px]"
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            {selectedClientId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedClientId(null)}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Matters Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            {selectedClientId ? `Matters for ${selectedClient?.name}` : 'All Matters'}
          </CardTitle>
          <CardDescription>
            {filteredMatters.length} matter{filteredMatters.length !== 1 ? 's' : ''} 
            {selectedClientId ? ' for this client' : ' total'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Loading matters...</p>
            </div>
          ) : filteredMatters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">
                {selectedClientId ? 'No matters for this client' : 'No matters yet'}
              </p>
              <p className="text-sm mt-1">
                {selectedClientId 
                  ? 'Create a new matter for this client'
                  : 'Create your first matter to start tracking trust funds'
                }
              </p>
              <Link href="/matters/new">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Matter
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matter</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Matter #</TableHead>
                  <TableHead>Practice Area</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Trust Balance</TableHead>
                  <TableHead>Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatters.map((matter) => (
                  <TableRow key={matter.id}>
                    <TableCell className="font-medium">
                      <Link 
                        href={`/matters/${matter.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {matter.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {matter.clientName ? (
                        <button
                          onClick={() => setSelectedClientId(matter.clientId)}
                          className="hover:text-primary hover:underline"
                        >
                          {matter.clientName}
                        </button>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {matter.matterNumber || '-'}
                    </TableCell>
                    <TableCell>{matter.practiceArea || '-'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          matter.status === 'open' ? 'default' : 
                          matter.status === 'closed' ? 'secondary' : 'outline'
                        }
                      >
                        {matter.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={matter.balance < 0 ? 'text-muted-foreground' : ''}>
                        {formatCurrency(matter.balance)}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(matter.openDate)}</TableCell>
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
