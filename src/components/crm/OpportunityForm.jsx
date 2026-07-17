import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Loader2, Briefcase, Sparkles, MessageSquare, BrainCircuit, Activity, FileText, User, CheckSquare, AlertCircle, X } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ActivityLog from "./ActivityLog";
import { base44 } from "@/api/base44Client";
import FileUpload from "../common/FileUpload";
import { useQuery } from "@tanstack/react-query";
import LeadSelector from "./LeadSelector";
import RelatedTasks from "./RelatedTasks";

export default function OpportunityForm({ opportunity, initialLead, onSubmit, onCancel, isSubmitting, title }) {
  const { pipelineStages, theme } = useSettings();
  const [aiLoading, setAiLoading] = React.useState(false);
  
  // Conversion State
  const [transferSettings, setTransferSettings] = React.useState({
    contactDetails: true,
    createTask: false
  });
  
  const [selectedLead, setSelectedLead] = React.useState(initialLead || null);

  const { register, handleSubmit, setValue, watch, getValues, reset, formState: { errors } } = useForm({
    defaultValues: opportunity || {
      lead_id: initialLead?.id || "",
      lead_name: initialLead?.full_name || "",
      phone_number: initialLead?.phone_number || "",
      email: initialLead?.email || "",
      product_type: "Consulting",
      deal_type: "Business",
      amount: "",
      deal_stage: "New",
      probability: 20,
      expected_close_date: "",
      next_task: "",
      main_pain_point: "",
      current_objection: "",
      ai_sales_strategy: "",
      ai_objection_handler: "",
      documents: [],
      checklist_completed: []
    }
  });

  const currentStage = watch("deal_stage");
  const checklistCompleted = watch("checklist_completed") || [];
  
  const activeStageConfig = pipelineStages?.find(s => s.id === currentStage);
  const stageChecklist = activeStageConfig?.checklist || [];

  const toggleChecklistItem = (itemId) => {
    const current = checklistCompleted;
    const exists = current.includes(itemId);
    if (exists) {
      setValue("checklist_completed", current.filter(id => id !== itemId));
    } else {
      setValue("checklist_completed", [...current, itemId]);
    }
  };

  const leadId = opportunity?.lead_id || selectedLead?.id;

  const { data: originalLeadData, isLoading: isLoadingLead } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => base44.entities.Lead.list().then((leads) => leads.find((l) => l.id === leadId)),
    enabled: !!leadId
  });
  
  // Handler for Lead Selection
  const handleLeadSelect = (lead) => {
      setSelectedLead(lead);
      setValue("lead_id", lead.id);
      setValue("lead_name", lead.full_name);
      setValue("phone_number", lead.phone_number);
      setValue("email", lead.email);
      
  };

  // Update form values when checkboxes change
  React.useEffect(() => {
    // You could add more fields here based on the checkboxes
  }, [transferSettings, initialLead, setValue]);

  const handleFormSubmit = (data) => {
    // Pass the task creation flag along with the data
    onSubmit({
      ...data,
      _createTask: transferSettings.createTask,
      _leadName: initialLead?.full_name // Helper for task title
    });
  };

  const generateAiInsights = async () => {
    setAiLoading(true);
    try {
      const values = getValues();
      const leadData = initialLead || {}; // In a real app, might need to fetch lead if not passed

      // Strategy Prompt
      const strategyPrompt = `
        Act as an expert sales consultant.
        Analyze this lead:
        - Age: ${leadData.age || 'Unknown'}
        - Product Interest: ${values.product_type}
        
        Rules:
        - Provide a general tailored strategy based on the data.
        
        Output in English. Be concise.
      `;

      // Objection Prompt
      const objectionPrompt = `
        Act as an expert sales trainer.
        Handle this objection: "${values.current_objection}"
        
        Context: General Sales.
        
        Rules:
        - Provide a short, empathetic, professional counter-argument.
        - Output in English.
      `;

      // Execute in parallel
      const [strategyRes, objectionRes] = await Promise.all([
      base44.integrations.Core.InvokeLLM({ prompt: strategyPrompt }),
      values.current_objection ? base44.integrations.Core.InvokeLLM({ prompt: objectionPrompt }) : Promise.resolve({ output: "" })]
      );

      setValue("ai_sales_strategy", typeof strategyRes === 'string' ? strategyRes : strategyRes.output);
      if (values.current_objection) {
        setValue("ai_objection_handler", typeof objectionRes === 'string' ? objectionRes : objectionRes.output);
      }

    } catch (error) {
      console.error("AI Generation failed:", error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSelectChange = (field, value) => {
    setValue(field, value);
  };

  const inputClass = `h-11 rounded-xl transition-all ${
    theme === 'dark' 
      ? 'bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:ring-purple-500/50 focus:border-purple-500' 
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-purple-200 focus:border-purple-400'
  }`;
  const labelClass = `text-xs font-semibold uppercase tracking-wider mb-1.5 block ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`;
  const sectionBg = theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full w-full overflow-hidden"
      dir="ltr">

      <div className={`p-6 border-b shrink-0 flex items-center justify-between z-10 transition-colors ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
            <Briefcase className={`w-6 h-6 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>
              {title || (opportunity ? `${opportunity.product_type || 'Sales'} Deal` : "New Opportunity")}
            </h2>
            <div className={`text-sm mt-1 flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>
              {(selectedLead || originalLeadData || opportunity?.lead_name) ? (
                 <>
                   <User className="w-3.5 h-3.5" />
                   <span>Client:</span>
                   <span className={`font-semibold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>
                     {selectedLead?.full_name || originalLeadData?.full_name || opportunity?.lead_name || "Unknown Client"}
                   </span>
                 </>
               ) : (
                 "Link a client to start tracking this deal"
               )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className={theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600'}>
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      <div className={`overflow-y-auto p-6 flex-1 custom-scrollbar ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50/50'}`}>
      
      {/* Lead Selector if no lead linked */}
      {!selectedLead && !opportunity?.lead_id && (
          <div className="mb-6">
            <LeadSelector onSelect={handleLeadSelect} />
          </div>
      )}
      
      {/* Hidden validation input for lead_id */}
      <input 
          type="hidden" 
          {...register("lead_id", { required: "Lead must be selected" })} 
      />
      {errors.lead_id && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errors.lead_id.message}
          </div>
      )}

      {selectedLead &&
      <div className={`mb-6 border rounded-xl p-5 space-y-4 backdrop-blur-sm ${
        theme === 'dark' ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50/50 border-emerald-100'
      }`}>
            <h3 className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-800'}`}>
                <Sparkles className="w-4 h-4" />
                Quick Transfer Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className={`flex items-center gap-2 text-sm cursor-pointer ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    <input
              type="checkbox"
              checked={transferSettings.contactDetails}
              onChange={(e) => setTransferSettings({ ...transferSettings, contactDetails: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500" />

                    Transfer Contact Details
                </label>

                <label className={`flex items-center gap-2 text-sm cursor-pointer font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    <input
              type="checkbox"
              checked={transferSettings.createTask}
              onChange={(e) => setTransferSettings({ ...transferSettings, createTask: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500" />

                    Create Follow-up Task
                </label>
            </div>
        </div>
      }

      <Tabs defaultValue="details" className="w-full">
        <TabsList className={`w-full flex h-12 p-1 rounded-xl mb-6 ${
            theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200/50'
        }`}>
          <TabsTrigger value="details" className="flex-1 rounded-lg text-xs font-medium data-[state=active]:shadow-sm">
            Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-1 rounded-lg text-xs font-medium data-[state=active]:shadow-sm">
            Docs
          </TabsTrigger>
          <TabsTrigger value="originalLead" className="flex-1 rounded-lg text-xs font-medium data-[state=active]:shadow-sm" disabled={!opportunity?.lead_id && !initialLead?.id}>
            Client
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 rounded-lg text-xs font-medium data-[state=active]:shadow-sm" disabled={!opportunity?.lead_id && !initialLead?.id}>
            Activity
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex-1 rounded-lg text-xs font-medium data-[state=active]:shadow-sm" disabled={!opportunity?.id}>
            Tasks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Hidden fields for linking */}
        <input type="hidden" {...register("lead_name")} />

        {/* Checklist Section */}
        {stageChecklist.length > 0 && (
            <div className={`rounded-xl p-4 mb-6 border ${theme === 'dark' ? 'bg-blue-900/20 border-blue-800/50' : 'bg-blue-50 border-blue-100'}`}>
                <h3 className={`font-bold text-sm flex items-center gap-2 mb-3 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>
                    <CheckSquare className="w-4 h-4" />
                    Checklist for Stage: {activeStageConfig?.label}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {stageChecklist.map(item => {
                        const isChecked = checklistCompleted.includes(item.id);
                        const checkedClass = theme === 'dark' 
                          ? 'bg-slate-800 border-blue-500/50 text-blue-300' 
                          : 'bg-white border-blue-200 text-slate-900 shadow-sm';
                        const uncheckedClass = theme === 'dark'
                          ? 'bg-transparent border-transparent hover:bg-slate-800/50'
                          : 'bg-transparent border-transparent hover:bg-blue-100/50';

                        return (
                            <label key={item.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer border ${isChecked ? checkedClass : uncheckedClass}`}>
                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                  isChecked 
                                    ? 'bg-blue-600 border-blue-600 text-white' 
                                    : theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'
                                }`}>
                                    {isChecked && <CheckSquare className="w-3.5 h-3.5" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="hidden"
                                    checked={isChecked}
                                    onChange={() => toggleChecklistItem(item.id)}
                                />
                                <span className={`text-sm ${isChecked ? (theme === 'dark' ? 'text-blue-300 font-medium' : 'text-slate-900 font-medium') : (theme === 'dark' ? 'text-slate-400' : 'text-slate-600')}`}>{item.text}</span>
                            </label>
                        );
                    })}
                </div>
                <div className={`mt-3 pt-3 border-t flex items-center gap-2 text-xs ${theme === 'dark' ? 'border-blue-800/30 text-blue-400' : 'border-blue-100 text-blue-600'}`}>
                    <AlertCircle className="w-3 h-3" />
                    <span>Completing tasks helps advance the deal to the next stage</span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Phone and Email removed as they appear in Original Lead Details */}

          <div className="space-y-2">
            <Label className={labelClass}>Product Type</Label>
            <Select
                  defaultValue={opportunity?.product_type || "Consulting"}
                  onValueChange={(val) => handleSelectChange("product_type", val)}>

              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select Product" />
              </SelectTrigger>
              <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                <SelectItem value="Consulting">Consulting</SelectItem>
                <SelectItem value="Service">Service</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="Software">Software</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Deal Stage</Label>
            <Select
                  defaultValue={opportunity?.deal_stage || "New"}
                  onValueChange={(val) => handleSelectChange("deal_stage", val)}>

              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select Stage" />
              </SelectTrigger>
              <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                {(pipelineStages || []).map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Deal Value ($)</Label>
            <Input
                  type="number"
                  {...register("amount", { valueAsNumber: true })}
                  placeholder="0.00"
                  className={inputClass} />

          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Closing Probability (%)</Label>
            <Input
                  type="number"
                  min="0" max="100"
                  {...register("probability", { valueAsNumber: true })}
                  className={inputClass} />

          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Expected Close Date</Label>
            <Input type="date" {...register("expected_close_date")} className={inputClass} />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Deal Type</Label>
            <div className={`grid grid-cols-2 p-1 rounded-xl ${theme === 'dark' ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}>
                {['Business', 'Private'].map((type) => {
                    const isSelected = watch('deal_type') === type;
                    return (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setValue('deal_type', type)}
                            className={`flex items-center justify-center py-2 text-sm font-medium rounded-lg transition-all ${
                                isSelected 
                                    ? (theme === 'dark' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-white text-blue-700 shadow-sm border border-slate-100')
                                    : (theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                            }`}
                        >
                            {type}
                        </button>
                    )
                })}
            </div>
            {/* Hidden input to ensure value is registered */}
            <input type="hidden" {...register("deal_type")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className={labelClass}>Next Task</Label>
          <Input {...register("next_task")} placeholder="e.g., Return to client with bank answer..." className={inputClass} />
        </div>

        {/* Sales Strategy Section */}
        <div className={`p-5 rounded-2xl border space-y-4 ${sectionBg}`}>
        <h3 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
          <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
             <Sparkles className="w-4 h-4" />
          </div>
          Sales Strategy
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={labelClass}>Main Pain Point</Label>
            <Select
                    defaultValue={opportunity?.main_pain_point}
                    onValueChange={(val) => handleSelectChange("main_pain_point", val)}>

              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select Pain Point" />
              </SelectTrigger>
              <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                <SelectItem value="Budget">Budget</SelectItem>
                <SelectItem value="Timeline">Timeline</SelectItem>
                <SelectItem value="Features">Features</SelectItem>
                <SelectItem value="Authority">Authority</SelectItem>
                <SelectItem value="Need">Need</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Current Objection</Label>
            <Input {...register("current_objection")} placeholder="What is the client saying? (e.g., Interest is high)" className={inputClass} />
          </div>
        </div>

        {/* AI Section */}
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <Label className={`font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-700'}`}>
              <BrainCircuit className="w-4 h-4" />
              AI Consultant
            </Label>
            <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={generateAiInsights}
                    disabled={aiLoading} className={`px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors border shadow-sm w-full md:w-auto ${
                      theme === 'dark' 
                        ? 'bg-purple-900/20 text-purple-300 border-purple-800 hover:bg-purple-900/40' 
                        : 'bg-slate-50 text-purple-600 border-purple-200 hover:bg-purple-50'
                    }`}>


              {aiLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
              Generate AI Insights
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>Recommended Strategy</Label>
              <div className="relative">
                <textarea
                        readOnly
                        {...register("ai_sales_strategy")}
                        className={`w-full min-h-[80px] p-3 rounded-md border text-sm focus:outline-none resize-none ${
                          theme === 'dark' 
                            ? 'bg-slate-900/50 border-slate-700 text-slate-300 placeholder:text-slate-600' 
                            : 'bg-purple-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                        placeholder="Click 'Generate Insights' for strategy..." />

              </div>
            </div>

            <div className="space-y-2">
              <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>Objection Handler</Label>
              <div className="relative">
                <textarea
                        readOnly
                        {...register("ai_objection_handler")}
                        className={`w-full min-h-[80px] p-3 rounded-md border text-sm focus:outline-none resize-none ${
                          theme === 'dark' 
                            ? 'bg-slate-900/50 border-slate-700 text-slate-300 placeholder:text-slate-600' 
                            : 'bg-purple-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                        placeholder="Handler will appear here..." />

              </div>
            </div>
          </div>
        </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
            Save Opportunity
          </Button>
        </div>
        </form>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <div className={`p-6 rounded-xl border ${sectionBg}`}>
            <FileUpload
              files={watch("documents") || []}
              onFilesChange={(newFiles) => setValue("documents", newFiles)}
              label="Deal Documents" />

          </div>
          
          <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
             <Button type="button" variant="outline" onClick={onCancel} className={theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}>Cancel</Button>
             <Button onClick={handleSubmit(handleFormSubmit)} className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
               Save Opportunity
             </Button>
          </div>
        </TabsContent>

        <TabsContent value="originalLead">
          {isLoadingLead ?
          <div className={`text-center py-10 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading lead details...</div> :
          originalLeadData ?
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-xl border ${sectionBg}`}>
              <div className="space-y-2">
                <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>Full Name</Label>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{originalLeadData.full_name}</p>
              </div>
              <div className="space-y-2">
                <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>Phone Number</Label>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{originalLeadData.phone_number}</p>
              </div>
              {originalLeadData.email &&
            <div className="space-y-2">
                  <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>Email</Label>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{originalLeadData.email}</p>
                </div>
            }
              {originalLeadData.age &&
            <div className="space-y-2">
                  <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>Age</Label>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{originalLeadData.age}</p>
                </div>
            }
              {originalLeadData.city &&
            <div className="space-y-2">
                  <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>City</Label>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{originalLeadData.city}</p>
                </div>
            }

              {originalLeadData.notes &&
            <div className="space-y-2 md:col-span-2">
                  <Label className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>Notes</Label>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-neutral-900'} whitespace-pre-wrap`}>{originalLeadData.notes}</p>
                </div>
            }
            </div> :

          <div className={`text-center py-10 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-600'}`}>
              No original lead details available for this opportunity.
            </div>
          }
          <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button type="button" variant="outline" onClick={onCancel} className={theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}>Cancel</Button>
            <Button onClick={handleSubmit(handleFormSubmit)} className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              Save Opportunity
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="h-[600px]">
        {opportunity?.lead_id || initialLead?.id ?
          <ActivityLog leadId={opportunity?.lead_id || initialLead?.id} opportunityId={opportunity?.id} /> :

          <div className="text-center py-10 text-neutral-600">
          Save the opportunity to add activities
        </div>
          }
        </TabsContent>

        <TabsContent value="tasks" className="h-[600px]">
           {opportunity?.id ? 
              <RelatedTasks opportunityId={opportunity.id} leadId={opportunity.lead_id} /> : 
              <div className="text-center py-10 text-neutral-600">Save the opportunity first</div>
           }
        </TabsContent>
        </Tabs>
        </div>
        </motion.div>);

}