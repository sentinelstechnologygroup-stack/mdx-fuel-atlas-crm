import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import moment from 'moment';
import { Search, DollarSign, Briefcase, CheckCircle2 } from 'lucide-react';
import { useSettings } from "@/components/context/SettingsContext";

export default function OpportunitiesListReport({ opportunities = [] }) {
  const { theme } = useSettings();
  const [filterStage, setFilterStage] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [searchClient, setSearchClient] = useState('');

  const stages = useMemo(() => {
    const s = new Set(opportunities.map((o) => o.deal_stage).filter(Boolean));
    return Array.from(s);
  }, [opportunities]);

  const filteredData = useMemo(() => {
    return opportunities.filter((o) => {
      if (filterStage !== 'all' && o.deal_stage !== filterStage) return false;
      if (filterDate !== 'all') {
        const created = moment(o.created_date);
        const now = moment();
        if (filterDate === 'this_month' && !created.isSame(now, 'month')) return false;
        if (filterDate === 'last_month' && !created.isSame(now.clone().subtract(1, 'month'), 'month')) return false;
        if (filterDate === 'this_year' && !created.isSame(now, 'year')) return false;
      }
      if (searchClient) {
        const name = o.lead_name || '';
        if (!name.toLowerCase().includes(searchClient.toLowerCase())) return false;
      }
      return true;
    });
  }, [opportunities, filterStage, filterDate, searchClient]);

  const stats = useMemo(() => {
    let openCount = 0;
    let wonCount = 0;
    let wonAmount = 0;
    filteredData.forEach((o) => {
      const isWon = o.deal_stage?.includes('Won');
      const isLost = o.deal_stage?.includes('Lost');
      if (isWon) {
        wonCount++;
        wonAmount += o.amount || 0;
      } else if (!isLost) {
        openCount++;
      }
    });
    return { openCount, wonCount, wonAmount };
  }, [filteredData]);

  return (
    <div className="space-y-6" dir="ltr">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`border transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-neutral-100'}`}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-red-300' : 'text-red-600'}`}>Open Opportunities</p>
              <h3 className={`text-3xl font-bold ${theme === 'dark' ? 'text-red-400 drop-shadow-sm' : 'text-neutral-900'}`}>{stats.openCount}</h3>
            </div>
            <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'}`}>
              <Briefcase className={`w-6 h-6 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className={`border transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-emerald-100'}`}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-600'}`}>Closed Won Deals</p>
              <h3 className={`text-3xl font-bold ${theme === 'dark' ? 'text-emerald-400 drop-shadow-sm' : 'text-emerald-900'}`}>{stats.wonCount}</h3>
            </div>
            <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
              <CheckCircle2 className={`w-6 h-6 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className={`border transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'}`}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`}>Total Revenue</p>
              <h3 className={`text-3xl font-bold ${theme === 'dark' ? 'text-purple-400 drop-shadow-sm' : 'text-purple-900'}`}>${stats.wonAmount.toLocaleString()}</h3>
            </div>
            <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <DollarSign className={`w-6 h-6 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={`flex flex-col md:flex-row gap-4 items-end p-4 rounded-xl shadow-sm border transition-colors ${
        theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-neutral-100'
      }`}>
        <div className="w-full md:w-64 space-y-1">
          <label className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Search Client</label>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-400'}`} />
            <Input
              placeholder="Client Name..."
              value={searchClient}
              onChange={(e) => setSearchClient(e.target.value)}
              className={`pl-9 ${theme === 'dark' ? 'bg-slate-900 border-slate-600 text-white placeholder:text-slate-500' : ''}`} />
          </div>
        </div>

        <div className="w-full md:w-48 space-y-1">
          <label className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Filter by Stage</label>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className={theme === 'dark' ? 'bg-slate-900 border-slate-600 text-white' : ''}>
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
              <SelectItem value="all">All Stages</SelectItem>
              {stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-48 space-y-1">
          <label className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Creation Date</label>
          <Select value={filterDate} onValueChange={setFilterDate}>
            <SelectTrigger className={theme === 'dark' ? 'bg-slate-900 border-slate-600 text-white' : ''}>
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className={`shadow-sm overflow-hidden border transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-neutral-100'}`}>
        <CardHeader className={`border-b transition-colors ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-neutral-50/50'}`}>
          <CardTitle className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-800'}`}>Opportunities Details</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className={theme === 'dark' ? 'bg-slate-900/50' : ''}>
              <TableRow className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : ''}>
                <TableHead className={`text-left min-w-[150px] ${theme === 'dark' ? 'text-slate-400' : ''}`}>Opportunity / Client</TableHead>
                <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Deal Value</TableHead>
                <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Sales Stage</TableHead>
                <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Creation Date</TableHead>
                <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Expected Close Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ?
              filteredData.map((o) =>
              <TableRow key={o.id} className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-700/50' : ''}>
                    <TableCell className={`font-medium ${theme === 'dark' ? 'text-white' : ''}`}>{o.lead_name || 'No Name'}</TableCell>
                    <TableCell className={`font-mono ${theme === 'dark' ? 'text-cyan-400' : ''}`}>${o.amount?.toLocaleString() || '0'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${
                        theme === 'dark' 
                          ? 'bg-slate-900 border-slate-600 text-slate-300' 
                          : 'bg-white border-neutral-200 font-normal text-neutral-600'
                      }`}>
                        {o.deal_stage}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-sm ${theme === 'dark' ? 'text-slate-400' : ''}`}>
                      {o.created_date ? moment(o.created_date).format('MMM D, YYYY') : '-'}
                    </TableCell>
                    <TableCell className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-500'}`}>
                      {o.expected_close_date ? moment(o.expected_close_date).format('MMM D, YYYY') : '-'}
                    </TableCell>
                  </TableRow>
              ) :
              <TableRow>
                  <TableCell colSpan={5} className={`h-24 text-center ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-500'}`}>
                    No opportunities found matching the filter
                  </TableCell>
                </TableRow>
              }
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>);
}