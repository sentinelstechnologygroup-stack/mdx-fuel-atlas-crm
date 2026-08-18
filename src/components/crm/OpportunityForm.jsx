import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Loader2, Briefcase, Sparkles, User, CheckSquare, AlertCircle, X } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ActivityLog from "./ActivityLog";
import { atlas } from "@/api/atlasClient";
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
      product_type: "New Business",
      amount: "",
      estimated_monthly_gallons: "",
      primary_fuel_type: "On-Road Diesel",
      delivery_type: "Scheduled",
      pricing_method: "Rack Plus",
      deliveries_per_month: "",
      delivery_fee_per_delivery: "",
      tank_rental: "No",
      number_of_tanks: "",
      monthly_rental_fee_per_tank: "",
      fuel_margin_per_gallon: "",
      current_supplier: "",
      deal_stage: "Prospect",
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
    queryFn: () => atlas.entities.Lead.list().then((leads) => leads.find((l) => l.id === leadId)),
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
        Act as an MDX Fuel sales manager.
        Analyze this fuel opportunity:
        - Opportunity Type: ${values.product_type}
        - Fuel Type: ${values.primary_fuel_type}
        - Monthly Gallons: ${values.estimated_monthly_gallons}
        - Current Supplier: ${values.current_supplier}
        - Why Looking: ${values.main_pain_point}

        Rules:
        - Focus on pricing, service reliability, delivery logistics, tank program, and next follow-up.

        Output in English. Be concise.
      `;

      // Objection Prompt
      const objectionPrompt = `
        Act as an expert sales trainer.
        Handle this objection: "${values.current_objection}"

        Context: MDX Fuel bulk fuel, delivery, tank rental, and fleet account sales.

        Rules:
        - Provide a short, empathetic, professional counter-argument.
        - Output in English.
      `;

      // Execute in parallel
      const [strategyRes, objectionRes] = await Promise.all([
      atlas.integrations.Core.InvokeLLM({ prompt: strategyPrompt }),
      values.current_objection ? atlas.integrations.Core.InvokeLLM({ prompt: objectionPrompt }) : Promise.resolve({ output: "" })]
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

        <div className={`p-5 rounded-2xl border space-y-5 ${sectionBg}`}>
          <div>
            <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
              Fuel Opportunity
            </h3>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              Match the interim CRM: opportunity type, stage, fuel need, supplier, and follow-up.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <div className="space-y-2">
            <Label className={labelClass}>Opportunity Type</Label>
            <Select
                  defaultValue={opportunity?.product_type || "New Business"}
                  onValueChange={(val) => handleSelectChange("product_type", val)}>

              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select opportunity type" />
              </SelectTrigger>
              <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                <SelectItem value="New Business">New Business</SelectItem>
                <SelectItem value="Expansion">Expansion</SelectItem>
                <SelectItem value="Renewal">Renewal</SelectItem>
                <SelectItem value="Win-Back">Win-Back</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Deal Stage</Label>
            <Select
                  defaultValue={opportunity?.deal_stage || "Prospect"}
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
            <Label className={labelClass}>Estimated Gallons / Month</Label>
            <Input
                  type="number"
                  min="0"
                  step="1"
                  {...register("estimated_monthly_gallons", {
                    valueAsNumber: true,
                    min: { value: 0, message: "Gallons cannot be negative" }
                  })}
                  placeholder="e.g., 25,000"
                  className={inputClass} />
            <p className={`text-[11px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Drives forecast, delivery plan, tank program, and sales rankings.
            </p>
            {errors.estimated_monthly_gallons && (
              <span className="text-red-500 text-xs">{errors.estimated_monthly_gallons.message}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Primary Fuel Type</Label>
            <Select
              defaultValue={opportunity?.primary_fuel_type || "On-Road Diesel"}
              onValueChange={(val) => handleSelectChange("primary_fuel_type", val)}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select fuel type" />
              </SelectTrigger>
              <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                <SelectItem value="On-Road Diesel">On-Road Diesel</SelectItem>
                <SelectItem value="Off-Road Diesel">Off-Road Diesel</SelectItem>
                <SelectItem value="Gasoline">Gasoline</SelectItem>
                <SelectItem value="DEF">DEF</SelectItem>
                <SelectItem value="Lubricants">Lubricants</SelectItem>
                <SelectItem value="Racing Fuel">Racing Fuel</SelectItem>
                <SelectItem value="Specialty Petroleum">Specialty Petroleum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Current Supplier</Label>
            <Input {...register("current_supplier")} placeholder="e.g., Pilot, Sunoco, Mansfield, local supplier..." className={inputClass} />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Pricing Method</Label>
            <Select
              defaultValue={opportunity?.pricing_method || "Rack Plus"}
              onValueChange={(val) => handleSelectChange("pricing_method", val)}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select pricing method" />
              </SelectTrigger>
              <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                <SelectItem value="Rack Plus">Rack Plus</SelectItem>
                <SelectItem value="Fixed Price">Fixed Price</SelectItem>
                <SelectItem value="Cost Plus">Cost Plus</SelectItem>
                <SelectItem value="Contract">Contract</SelectItem>
                <SelectItem value="Spot">Spot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Expected Close Date</Label>
            <Input type="date" {...register("expected_close_date")} className={inputClass} />
          </div>
        </div>
        </div>

        <div className={`p-5 rounded-2xl border space-y-4 ${sectionBg}`}>
        <h3 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
          <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-600'}`}>
             <Briefcase className="w-4 h-4" />
          </div>
          Delivery, Tanks & Margin
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={labelClass}>Delivery Type</Label>
            <Select
              defaultValue={opportunity?.delivery_type || "Scheduled"}
              onValueChange={(val) => handleSelectChange("delivery_type", val)}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select delivery type" />
              </SelectTrigger>
              <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Keep Full">Keep Full</SelectItem>
                <SelectItem value="Call In">Call In</SelectItem>
                <SelectItem value="Emergency">Emergency</SelectItem>
                <SelectItem value="On Demand">On Demand</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Deliveries / Month</Label>
            <Input type="number" min="0" step="1" {...register("deliveries_per_month", { valueAsNumber: true })} placeholder="e.g., 8" className={inputClass} />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Delivery Fee / Delivery</Label>
            <Input type="number" min="0" step="0.01" {...register("delivery_fee_per_delivery", { valueAsNumber: true })} placeholder="e.g., 75.00" className={inputClass} />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Tank Rental?</Label>
            <Select
              defaultValue={opportunity?.tank_rental || "No"}
              onValueChange={(val) => handleSelectChange("tank_rental", val)}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Tank rental?" />
              </SelectTrigger>
              <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Number of Tanks</Label>
            <Input type="number" min="0" step="1" {...register("number_of_tanks", { valueAsNumber: true })} placeholder="e.g., 2" className={inputClass} />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Rental Fee / Tank</Label>
            <Input type="number" min="0" step="0.01" {...register("monthly_rental_fee_per_tank", { valueAsNumber: true })} placeholder="e.g., 250.00" className={inputClass} />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Fuel Margin / Gallon</Label>
            <Input type="number" min="0" step="0.0001" {...register("fuel_margin_per_gallon", { valueAsNumber: true })} placeholder="e.g., 0.1250" className={inputClass} />
          </div>
        </div>
        </div>

        <div className={`p-5 rounded-2xl border space-y-4 ${sectionBg}`}>
          <h3 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
            <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            Qualification & Follow-Up
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={labelClass}>Why Looking</Label>
              <Select
                defaultValue={opportunity?.main_pain_point}
                onValueChange={(val) => handleSelectChange("main_pain_point", val)}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                  <SelectItem value="Price">Price</SelectItem>
                  <SelectItem value="Service">Service</SelectItem>
                  <SelectItem value="Availability">Availability</SelectItem>
                  <SelectItem value="Relationship">Relationship</SelectItem>
                  <SelectItem value="Tank Program">Tank Program</SelectItem>
                  <SelectItem value="Delivery Capability">Delivery Capability</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>Current Objection</Label>
              <Input {...register("current_objection")} placeholder="e.g., Price, credit, supplier contract, tank setup..." className={inputClass} />
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>Closing Probability (%)</Label>
              <Input type="number" min="0" max="100" {...register("probability", { valueAsNumber: true })} className={inputClass} />
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>Estimated Monthly Revenue</Label>
              <Input type="number" {...register("amount", { valueAsNumber: true })} placeholder="Optional forecast $" className={inputClass} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Next Step</Label>
            <Input {...register("next_task")} placeholder="e.g., Send quote, schedule site visit, confirm supplier pricing..." className={inputClass} />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={generateAiInsights}
              disabled={aiLoading}
              className={theme === 'dark' ? 'border-purple-800 text-purple-300 hover:bg-purple-900/40' : 'border-purple-200 text-purple-700 hover:bg-purple-50'}
            >
              {aiLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
              Generate Fuel Sales Notes
            </Button>
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
