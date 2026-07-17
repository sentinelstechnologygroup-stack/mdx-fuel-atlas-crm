import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSettings } from "@/components/context/SettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Zap, Sparkles, Wand2, Bell, Mail, Clock, Loader2, Power, PowerOff, History, CheckCircle2, XCircle, Activity, Copy, Search, Filter, TrendingUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// Quick Templates
const templates = [
{
  id: 'welcome_email', title: 'Welcome Email', description: 'Send automated email to new leads', icon: Mail, color: 'bg-slate-700',
  rule: { name: 'Welcome Email', trigger_entity: 'Lead', trigger_event: 'create', action_type: 'send_email', action_config: { email_subject: 'Welcome!', email_to: '{{email}}' } }
},
{
  id: 'task_big_deal', title: 'Big Deal Alert', description: 'Create task for manager on deals > 1M', icon: Bell, color: 'bg-red-700',
  rule: { name: 'Big Deal VIP', trigger_entity: 'Opportunity', trigger_event: 'create', condition_field: 'property_value', condition_value: '1000000', action_type: 'create_task' }
},
{
  id: 'deal_won', title: 'Deal Won', description: 'Send celebration email when deal is won', icon: Sparkles, color: 'bg-emerald-600',
  rule: { name: 'Deal Won Celebration', trigger_entity: 'Opportunity', trigger_event: 'update', condition_field: 'deal_stage', condition_value: 'Closed Won', action_type: 'send_email', action_config: { email_subject: 'Deal Won! 🏆', email_body: 'Great job! The deal with {{lead_name}} was won.' } }
}];


export default function AutomationsPage() {
  const { theme } = useSettings();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');
  const [editingRule, setEditingRule] = useState(null);
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['automationRules'],
    queryFn: () => base44.entities.AutomationRule.list(),
    initialData: []
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['automationLogs'],
    queryFn: () => base44.entities.AutomationLog.list('-execution_time', 50),
    initialData: []
  });

  const createRule = useMutation({
    mutationFn: (data) => base44.entities.AutomationRule.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['automationRules']);
      setIsDialogOpen(false);
      setEditingRule(null);
    }
  });

  const deleteRule = useMutation({
    mutationFn: (id) => base44.entities.AutomationRule.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['automationRules'])
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.AutomationRule.update(id, { is_active: isActive }),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries(['automationRules']);
      const previousRules = queryClient.getQueryData(['automationRules']);

      queryClient.setQueryData(['automationRules'], (old) => {
        return old.map((r) => 
          r.id === id ? { ...r, is_active: isActive } : r
        );
      });

      return { previousRules };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['automationRules'], context.previousRules);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['automationRules']);
    }
  });

  const duplicateRule = (rule) => {
    const newRule = {
      ...rule,
      name: `${rule.name} (עותק)`,
      is_active: false
    };
    delete newRule.id;
    delete newRule.created_date;
    delete newRule.updated_date;
    delete newRule.created_by;
    createRule.mutate(newRule);
  };

  // Filter rules
  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.action_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEntity = filterEntity === 'all' || rule.trigger_entity === filterEntity;
    return matchesSearch && matchesEntity;
  });

  // Stats
  const stats = {
    total: rules.length,
    active: rules.filter(r => r.is_active !== false).length,
    inactive: rules.filter(r => r.is_active === false).length,
    successRate: logs.length > 0 ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100) : 0
  };

  return (
    <div className={`space-y-8 pb-20 font-sans transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`} dir="ltr">
      
      {/* Header + Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400' : 'text-slate-900'}`}>Automations</h1>
          <p className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Manage rules and automated workflows</p>
        </div>
        <Button onClick={() => { setEditingRule(null); setIsDialogOpen(true); }} className="bg-red-700 hover:bg-red-800 text-white font-bold shadow-lg shadow-red-900/10">
            <Plus className="w-4 h-4 mr-2" />
            New Rule
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className={`border transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Total Rules</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.total}</p>
              </div>
              <Zap className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className={`border transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Active</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-green-600'}`}>{stats.active}</p>
              </div>
              <CheckCircle2 className={`w-8 h-8 ${theme === 'dark' ? 'text-emerald-900/50' : 'text-green-200'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className={`border transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Disabled</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{stats.inactive}</p>
              </div>
              <PowerOff className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-700' : 'text-slate-200'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className={`border transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Success Rate</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`}>{stats.successRate}%</p>
              </div>
              <TrendingUp className={`w-8 h-8 ${theme === 'dark' ? 'text-cyan-900/50' : 'text-blue-200'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full max-w-md grid-cols-2 mb-6 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <TabsTrigger value="rules" className={`gap-2 ${theme === 'dark' ? 'data-[state=active]:bg-slate-700 data-[state=active]:text-cyan-400 text-slate-400' : ''}`}>
            <Zap className="w-4 h-4" />
            Active Rules
          </TabsTrigger>
          <TabsTrigger value="logs" className={`gap-2 ${theme === 'dark' ? 'data-[state=active]:bg-slate-700 data-[state=active]:text-cyan-400 text-slate-400' : ''}`}>
            <History className="w-4 h-4" />
            Execution Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">{/* תבניות */}

      <div>
          <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
              <Wand2 className={`w-5 h-5 ${theme === 'dark' ? 'text-purple-400' : 'text-red-600'}`} />
              Quick Templates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map((tpl) =>
          <Card key={tpl.id} className={`group hover:shadow-md transition-all cursor-pointer border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200'}`} onClick={() => createRule.mutate(tpl.rule)}>
                      <CardContent className="p-6">
                          <div className={`w-12 h-12 rounded-xl ${tpl.color} flex items-center justify-center text-white mb-4 shadow-md`}>
                              <tpl.icon className="w-6 h-6" />
                          </div>
                          <h4 className={`font-bold text-lg mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{tpl.title}</h4>
                          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{tpl.description}</p>
                      </CardContent>
                  </Card>
          )}
          </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
          <Input
            placeholder="Search rules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : ''}`}
          />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className={`w-full md:w-48 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}`}>
            <Filter className={`w-4 h-4 mr-2 ${theme === 'dark' ? 'text-slate-400' : ''}`} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="Lead">Leads Only</SelectItem>
            <SelectItem value="Opportunity">Opportunities Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Rules List */}
      <div className="space-y-4 mt-8">
        <h3 className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
              <Zap className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-red-600'}`} />
              Active Rules ({filteredRules.length})
        </h3>
        
        {isLoading ? <div className={`text-center py-10 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Loading...</div> : filteredRules.map((rule) =>
        <Card key={rule.id} className={`flex flex-row items-center justify-between p-6 border shadow-sm transition-colors ${
            theme === 'dark'
                ? rule.is_active ? 'bg-slate-800 border-slate-700 hover:border-cyan-500/50' : 'bg-slate-800/50 border-slate-700 opacity-60'
                : rule.is_active ? 'bg-white border-slate-200 hover:border-red-200' : 'bg-slate-50/50 border-slate-200 opacity-60'
        }`}>
                <div className="flex items-center gap-5 flex-1">
                    <div className={`p-3 rounded-full border ${
                        theme === 'dark'
                            ? rule.is_active ? 'bg-slate-700 text-cyan-400 border-slate-600' : 'bg-slate-800 text-slate-600 border-slate-700'
                            : rule.is_active ? 'bg-slate-50 text-slate-600 border-slate-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                        <Zap className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{rule.name}</h3>
                          {!rule.is_active && <span className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>Disabled</span>}
                        </div>
                        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                            <span className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Trigger:</span> {rule.trigger_entity === 'Lead' ? 'Lead' : 'Opportunity'} {rule.trigger_event === 'create' ? 'Created' : 'Updated'}
                            {rule.condition_field && ` | ${rule.condition_field} ${rule.condition_operator || 'equals'} ${rule.condition_value}`}
                        </p>
                        <p className={`text-xs mt-1 flex items-center gap-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                            {rule.action_type === 'send_email' ? <Mail className="w-3 h-3" /> : rule.action_type === 'create_task' ? <Bell className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                            Action: {rule.action_type === 'send_email' ? 'Send Email' : rule.action_type === 'create_task' ? 'Create Task' : 'Update Entity'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3">
                      <Switch 
                        checked={rule.is_active !== false} 
                        onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, isActive: checked })}
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`${theme === 'dark' ? 'text-slate-400 hover:text-cyan-400 hover:bg-slate-700' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                      onClick={() => duplicateRule(rule)}
                      title="Duplicate Rule"
                    >
                        <Copy className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className={`${theme === 'dark' ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`} onClick={() => {
                      if(confirm('Delete this rule?')) deleteRule.mutate(rule.id);
                    }}>
                        <Trash2 className="w-5 h-5" />
                    </Button>
                </div>
            </Card>
        )}
        
        {filteredRules.length === 0 && !isLoading && rules.length > 0 &&
        <div className={`text-center py-16 rounded-2xl border border-dashed ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                <p className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>No matching rules found</p>
            </div>
        }
        
        {rules.length === 0 && !isLoading &&
        <div className={`text-center py-16 rounded-2xl border border-dashed ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                <p className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>No automations defined</p>
            </div>
        }
      </div>
      </TabsContent>

      <TabsContent value="logs">
        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
              <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : ''}`}>Recent Execution Log</h3>
            </div>
            
            {logsLoading ? (
              <div className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></div>
            ) : logs.length === 0 ? (
              <div className={`text-center py-10 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No executions to show</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className={theme === 'dark' ? 'bg-slate-900/50' : ''}>
                    <TableRow className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-700/50' : ''}>
                      <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Time</TableHead>
                      <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Rule</TableHead>
                      <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Entity</TableHead>
                      <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Status</TableHead>
                      <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-700/50' : ''}>
                        <TableCell className={`text-sm ${theme === 'dark' ? 'text-slate-300' : ''}`}>
                          {new Date(log.execution_time).toLocaleString('en-US')}
                        </TableCell>
                        <TableCell className={`font-medium ${theme === 'dark' ? 'text-white' : ''}`}>{log.rule_name}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-100'}`}>
                            {log.entity_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          {log.status === 'success' ? (
                            <Badge className={`${theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900/50' : 'bg-green-100 text-green-700 hover:bg-green-100'}`}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge className={`${theme === 'dark' ? 'bg-red-900/50 text-red-400 hover:bg-red-900/50' : 'bg-red-100 text-red-700 hover:bg-red-100'}`}>
                              <XCircle className="w-3 h-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-xs max-w-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {log.action_taken}
                          {log.error_message && (
                            <div className="text-red-600 mt-1">{log.error_message}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

      {/* מודל יצירה/עריכה */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setEditingRule(null);
      }}>
        <DialogContent className={`fixed right-0 top-0 left-auto translate-x-0 translate-y-0 h-full w-full sm:w-[550px] max-w-none p-0 border-l shadow-2xl transition-all duration-300 gap-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right sm:rounded-none ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`} dir="ltr">
          <div className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {editingRule ? "Edit Rule" : "New Rule"}
              </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <RuleForm
              editingRule={editingRule}
              onSuccess={() => {
                setIsDialogOpen(false);
                setEditingRule(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}

// טופס יצירה (עם AI)
function RuleForm({ onSuccess, editingRule }) {
  const { theme } = useSettings();
  const queryClient = useQueryClient();
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [formData, setFormData] = useState(editingRule || {
    name: "",
    trigger_entity: "Lead",
    trigger_event: "create",
    condition_field: "",
    condition_operator: "equals",
    condition_value: "",
    action_type: "create_task",
    action_config: {
      email_to: "",
      email_subject: "",
      email_body: "",
      task_title: "",
      task_description: "",
      task_due_days: 1,
      update_field: "",
      update_value: ""
    }
  });

  // Dynamic field options based on entity
  const leadFields = [
    { value: 'lead_status', label: 'סטטוס ליד', values: ['New', 'Attempting Contact', 'Contacted - Qualifying', 'Sales Ready', 'Converted', 'Lost / Unqualified'] },
    { value: 'source_year', label: 'שנת מקור', values: ['2023', '2024', '2025'] },
    { value: 'age', label: 'גיל', type: 'number' },
    { value: 'city', label: 'עיר', type: 'text' },
    { value: 'estimated_property_value', label: 'שווי נכס משוער', type: 'number' },
    { value: 'lead_temperature', label: 'טמפרטורת ליד', values: ['Warm (חם)', 'Cold (קר)', 'Hot History (היה חם בעבר)'] }
  ];

  const opportunityFields = [
    { value: 'deal_stage', label: 'שלב עסקה', values: ['New (חדש)', 'Discovery Call (שיחת בירור צרכים)', 'Meeting Scheduled (נקבעת פגישה)', 'Documents Collection (איסוף מסמכים)', 'Request Sent to Harel (בקשה נשלחה להראל)', 'Closed Won (נחתם - בהצלחה)', 'Closed Lost (אבוד)'] },
    { value: 'product_type', label: 'סוג מוצר', values: ['Reverse Mortgage', 'Savings/Insurance', 'Loan', 'Other'] },
    { value: 'probability', label: 'הסתברות', type: 'number' },
    { value: 'property_value', label: 'שווי נכס', type: 'number' },
    { value: 'loan_amount_requested', label: 'סכום מבוקש', type: 'number' }
  ];

  const availableFields = formData.trigger_entity === 'Lead' ? leadFields : opportunityFields;
  const selectedField = availableFields.find(f => f.value === formData.condition_field);
  const needsOperatorValue = formData.condition_operator !== 'is_empty' && formData.condition_operator !== 'is_not_empty';

  const createRule = useMutation({
    mutationFn: (data) => base44.entities.AutomationRule.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['automationRules']);
      onSuccess();
    }
  });

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    try {
      const systemPrompt = `
                You are an automation configuration assistant for a CRM. 
                User Logic: "${aiPrompt}"
                
                Your goal is to output a JSON object to populate a form based on the logic.
                
                Input Schema mapping:
                - trigger_entity: "Lead" or "Opportunity"
                - trigger_event: "create" or "update"
                - condition_field: "lead_status", "deal_stage", "source_year", etc.
                - condition_value: translate Hebrew terms to exact English Enums below:
                    Lead Statuses: "New", "Attempting Contact", "Contacted - Qualifying", "Sales Ready", "Converted", "Lost / Unqualified"
                    Deal Stages: "New (חדש)", "Discovery Call (שיחת בירור צרכים)", "Meeting Scheduled (נקבעת פגישה)", "Closed Won (נחתם - בהצלחה)"
                - action_type: "create_task" or "send_email"
                - action_config: {
                     email_to: string (use {{full_name}} or {{email}} placeholders),
                     email_subject: string,
                     email_body: string,
                     task_title: string,
                     task_description: string,
                     task_due_days: number
                }
                - name: Suggest a short hebrew name for this rule
    
                Output strictly valid JSON only.
            `;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: systemPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            trigger_entity: { type: "string" },
            trigger_event: { type: "string" },
            condition_field: { type: "string" },
            condition_value: { type: "string" },
            action_type: { type: "string" },
            action_config: {
              type: "object",
              properties: {
                email_to: { type: "string" },
                email_subject: { type: "string" },
                email_body: { type: "string" },
                task_title: { type: "string" },
                task_description: { type: "string" },
                task_due_days: { type: "number" }
              }
            }
          }
        }
      });

      const aiData = typeof response === 'string' ? JSON.parse(response) : response;

      // Merge AI data into current rule state
      setFormData((prev) => ({
        ...prev,
        ...aiData,
        action_config: {
          ...prev.action_config,
          ...(aiData.action_config || {})
        }
      }));

    } catch (error) {
      console.error("AI Generation failed", error);
      alert("אירעה שגיאה ביצירת האוטומציה עם AI");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createRule.mutate(formData);
  };

  // Helper Styles
  const inputClass = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : '';
  const labelClass = theme === 'dark' ? 'text-slate-300' : '';
  const sectionBg = theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100';
  const selectContentClass = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : '';

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="ltr">
            
            {/* AI Generator Section */}
            <div className={`p-6 rounded-2xl shadow-lg mb-8 border relative overflow-hidden transition-colors ${
                theme === 'dark' 
                    ? 'bg-slate-900 text-white border-slate-800' 
                    : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100 text-slate-900'
            }`}>
                
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <Sparkles className={`w-5 h-5 animate-pulse ${theme === 'dark' ? 'text-red-500' : 'text-indigo-600'}`} />
                        <span>Smart AI Automation Generator</span>
                    </div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        Describe the automation in free language, and the AI will build the rule for you.
                    </p>
                    
                    <div className="flex gap-3 pt-2">
                        <div className="flex-1 relative">
                            <Textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="E.g. When a lead becomes 'Sales Ready', send them a welcome email..."
                                className={`resize-none h-20 text-sm rounded-xl transition-all focus:ring-2 ${
                                    theme === 'dark' 
                                        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-red-900 focus:bg-slate-800' 
                                        : 'bg-white border-indigo-200 text-slate-900 placeholder:text-slate-400 focus:ring-indigo-200'
                                }`} 
                            />
                        </div>
                        <Button
              type="button"
              onClick={generateWithAI}
              disabled={isGenerating || !aiPrompt}
              className="h-20 w-32 bg-red-700 text-white hover:bg-red-800 hover:scale-105 transition-all font-bold shadow-lg rounded-xl shrink-0 border-none">

                            {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> :
              <div className="flex flex-col items-center gap-1">
                                    <Sparkles className="w-5 h-5" />
                                    <span>Create Rule</span>
                                </div>
              }
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label className={labelClass}>Rule Name</Label>
                <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="E.g. Follow-up task for new lead"
          className={inputClass}
          required />

            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className={labelClass}>Trigger Entity</Label>
                    <Select value={formData.trigger_entity} onValueChange={(v) => setFormData({ ...formData, trigger_entity: v })}>
                        <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                        <SelectContent className={selectContentClass}>
                            <SelectItem value="Lead">Lead</SelectItem>
                            <SelectItem value="Opportunity">Opportunity</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className={labelClass}>Event</Label>
                    <Select value={formData.trigger_event} onValueChange={(v) => setFormData({ ...formData, trigger_event: v })}>
                        <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                        <SelectContent className={selectContentClass}>
                            <SelectItem value="create">Created</SelectItem>
                            <SelectItem value="update">Updated</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className={`border-t pt-4 space-y-4 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label className={labelClass}>Condition Field (Optional)</Label>
                        <Select value={formData.condition_field} onValueChange={(v) => setFormData({ ...formData, condition_field: v, condition_value: '' })}>
                            <SelectTrigger className={inputClass}><SelectValue placeholder="Select Field..." /></SelectTrigger>
                            <SelectContent className={selectContentClass}>
                                <SelectItem value={null}>No Condition</SelectItem>
                                {availableFields.map(field => (
                                    <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className={labelClass}>Operator</Label>
                        <Select value={formData.condition_operator} onValueChange={(v) => setFormData({ ...formData, condition_operator: v })}>
                            <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                            <SelectContent className={selectContentClass}>
                                <SelectItem value="equals">Equals</SelectItem>
                                <SelectItem value="not_equals">Not Equals</SelectItem>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="greater_than">Greater Than</SelectItem>
                                <SelectItem value="less_than">Less Than</SelectItem>
                                <SelectItem value="is_empty">Is Empty</SelectItem>
                                <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className={labelClass}>Condition Value</Label>
                        {selectedField?.values && needsOperatorValue ? (
                            <Select value={formData.condition_value} onValueChange={(v) => setFormData({ ...formData, condition_value: v })}>
                                <SelectTrigger className={inputClass}><SelectValue placeholder="Select Value..." /></SelectTrigger>
                                <SelectContent className={selectContentClass}>
                                    {selectedField.values.map(val => (
                                        <SelectItem key={val} value={val}>{val}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={formData.condition_value}
                                onChange={(e) => setFormData({ ...formData, condition_value: e.target.value })}
                                placeholder={selectedField?.type === 'number' ? 'Enter Number' : 'Enter Value'}
                                type={selectedField?.type === 'number' ? 'number' : 'text'}
                                className={inputClass}
                                disabled={!needsOperatorValue} />
                        )}
                    </div>
                </div>
            </div>

            <div className={`border-t pt-4 space-y-4 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="space-y-2">
                    <Label className={labelClass}>Action to Perform</Label>
                    <Select value={formData.action_type} onValueChange={(v) => setFormData({ ...formData, action_type: v })}>
                        <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                        <SelectContent className={selectContentClass}>
                            <SelectItem value="create_task">Create Task</SelectItem>
                            <SelectItem value="send_email">Send Email</SelectItem>
                            <SelectItem value="update_entity">Update Entity</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {formData.action_type === 'create_task' ?
        <div className={`space-y-3 p-3 rounded ${sectionBg}`}>
                         <div className="space-y-2">
                            <Label className={labelClass}>Task Title</Label>
                            <Input
              value={formData.action_config.task_title}
              onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, task_title: e.target.value } })}
              placeholder="Use {{full_name}} for name placeholder"
              className={inputClass} />

                        </div>
                        <div className="space-y-2">
                            <Label className={labelClass}>Description</Label>
                            <Input
              value={formData.action_config.task_description}
              onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, task_description: e.target.value } })}
              className={inputClass} />

                        </div>
                    </div> : formData.action_type === 'send_email' ?

        <div className={`space-y-3 p-3 rounded ${sectionBg}`}>
                        <div className="space-y-2">
                            <Label className={labelClass}>Send To</Label>
                            <Input
              value={formData.action_config.email_to}
              onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, email_to: e.target.value } })}
              placeholder="Email address or {{email}}"
              className={inputClass} />

                        </div>
                        <div className="space-y-2">
                            <Label className={labelClass}>Subject</Label>
                            <Input
              value={formData.action_config.email_subject}
              onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, email_subject: e.target.value } })}
              className={inputClass} />

                        </div>
                        <div className="space-y-2">
                            <Label className={labelClass}>Body</Label>
                            <Input
              value={formData.action_config.email_body}
              onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, email_body: e.target.value } })}
              className={inputClass} />

                        </div>
                    </div> :
        
        <div className={`space-y-3 p-3 rounded ${sectionBg}`}>
                        <div className="space-y-2">
                            <Label className={labelClass}>Field to Update</Label>
                            <Input
              value={formData.action_config.update_field}
              onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, update_field: e.target.value } })}
              placeholder="e.g. lead_status"
              className={inputClass} />

                        </div>
                        <div className="space-y-2">
                            <Label className={labelClass}>New Value</Label>
                            <Input
              value={formData.action_config.update_value}
              onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, update_value: e.target.value } })}
              placeholder="e.g. Sales Ready"
              className={inputClass} />

                        </div>
                    </div>
        }
            </div>

            <Button type="submit" className="w-full bg-red-700 hover:bg-red-800 text-white font-bold mt-4" disabled={createRule.isPending}>
                {createRule.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                Save Rule
            </Button>
        </form>);

}