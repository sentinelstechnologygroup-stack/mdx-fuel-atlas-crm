import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Loader2, Activity, User, ClipboardList, FileText, Briefcase, Sparkles, CheckSquare, X, Phone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSettings } from "@/components/context/SettingsContext";
import ActivityLog from "./ActivityLog";
import DiscoveryScript from "./DiscoveryScript";
import LeadOpportunities from "./LeadOpportunities";
import LeadDocuments from "./LeadDocuments";
import TagManager from "./TagManager";
import LeadAiAnalysis from "./LeadAiAnalysis";
import LastTouchInfo from "./LastTouchInfo";
import QuickTaskCreator from "./QuickTaskCreator";
import RelatedTasks from "./RelatedTasks";

export default function LeadForm({ lead, onSaveAndClose, onSaveAndStay, onCancel, isSubmitting }) {
  const { theme } = useSettings();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: lead || {
    full_name: "",
    phone_number: "",
    email: "",
    documents: [],
    assigned_to: "", // Default empty
    age: "",
    city: "",
    source_year: "2024",
    original_status_color: "Green",
    lead_status: "New",
    last_contact_date: new Date().toISOString().split('T')[0],
    notes: "",
    lead_temperature: "Cold",
    tags: [],
    custom_data: {}
    }
  });

  // Fetch linked opportunities if editing a lead
  // Removed opportunities query here as it is moved to LeadOpportunities component

  // Fetch users for assignment
  const { data: users } = useQuery({
    queryKey: ['users_list'],
    queryFn: () => base44.entities.User.list('full_name', 50), // Added limit
    initialData: []
  });

  // 1. Browser Tab Awareness
  React.useEffect(() => {
    if (lead?.full_name) {
      document.title = `${lead.full_name} | Lead File`;
    } else {
      document.title = "New Lead | Base44 App";
    }
    return () => {
      document.title = "Base44 App"; // Reset on unmount
    };
  }, [lead?.full_name]);

  // 2. Session Restoration (Drafts)
  React.useEffect(() => {
    if (!lead) { // Only for new leads
        const savedDraft = localStorage.getItem("lead_form_draft");
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                Object.keys(draft).forEach(key => setValue(key, draft[key]));
            } catch (e) { console.error("Failed to load draft", e); }
        }
    }
  }, []);

  // Save to local storage on change
  React.useEffect(() => {
      if (!lead) {
          const subscription = watch((value) => {
              localStorage.setItem("lead_form_draft", JSON.stringify(value));
          });
          return () => subscription.unsubscribe();
      }
  }, [watch, lead]);

  const clearDraft = () => localStorage.removeItem("lead_form_draft");

  // Fetch custom fields
  const { data: customFields } = useQuery({
    queryKey: ['custom_fields_lead'],
    queryFn: async () => {
        const fields = await base44.entities.CustomField.list();
        return fields.filter(f => f.entity_type === 'Lead');
    },
    initialData: []
  });

  const leadStatus = watch("lead_status");
  const lastContactDate = watch("last_contact_date");
  const originalStatusColor = watch("original_status_color");

  const handleSelectChange = (field, value) => {
    setValue(field, value);
  };

  // Calculate Lead Temperature
  React.useEffect(() => {
    let temp = "Cold";
    const daysSinceContact = lastContactDate ?
    Math.floor((new Date() - new Date(lastContactDate)) / (1000 * 60 * 60 * 24)) :
    999;

    if (daysSinceContact <= 30) {
      temp = "Warm";
    } else if (originalStatusColor === "Green") {
      temp = "Hot History";
    }

    setValue("lead_temperature", temp);
  }, [lastContactDate, originalStatusColor, setValue]);

  const handleSaveAndClose = (data) => {
    const sanitized = { ...data };
    const numberFields = ['age'];
    numberFields.forEach((f) => {
      if (Number.isNaN(sanitized[f])) sanitized[f] = null;
    });
    clearDraft();
    onSaveAndClose(sanitized);
  };

  const handleSaveAndStay = (data) => {
    const sanitized = { ...data };
    const numberFields = ['age'];
    numberFields.forEach((f) => {
      if (Number.isNaN(sanitized[f])) sanitized[f] = null;
    });
    clearDraft();
    onSaveAndStay(sanitized);
  };

  const onFormError = (formErrors) => {
    console.error("Validation Errors:", formErrors);
  };

  const labelClass = `font-semibold mb-1.5 block ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`;
  const inputClass = `font-medium placeholder:text-slate-400 focus:border-blue-500 ${
    theme === 'dark' 
      ? 'bg-slate-900 border-slate-700 text-white' 
      : 'bg-white border-slate-300 text-slate-900'
  }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl shadow-lg border flex flex-col max-h-[80vh] w-[95vw] md:w-full mx-auto overflow-hidden ${
        theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
      }`}
      dir="ltr">

      <div className={`p-4 md:p-6 border-b shrink-0 z-10 flex justify-between items-start ${
        theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
      }`}>
        <div>
          <h2 className={`text-2xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {lead ? (
                <>
                    {lead.full_name || "Lead File"}
                    {lead.lead_status && (
                        <Badge variant="outline" className={`text-sm font-normal ${
                            theme === 'dark' ? 'bg-slate-700/50 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                            {lead.lead_status}
                        </Badge>
                    )}
                </>
            ) : "Add New Lead"}
          </h2>
          <div className={`text-sm mt-1 flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
             {lead ? (
                <>
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Lead File</span>
                    {lead.email && (
                        <>
                            <span className="opacity-50">•</span>
                            <span>{lead.email}</span>
                        </>
                    )}
                     {lead.phone_number && (
                        <>
                            <span className="opacity-50">•</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone_number}</span>
                        </>
                    )}
                </>
             ) : "Manage details and activities"}
          </div>
        </div>
        <div className="flex items-center gap-2">

            <Button variant="ghost" size="icon" onClick={onCancel} className={`${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <X className="w-5 h-5" />
            </Button>
        </div>
      </div>

      <div className="overflow-y-auto p-4 md:p-6 flex-1">
      <Tabs defaultValue="details" className="w-full">
        <TabsList className={`flex w-full flex-nowrap justify-start overflow-x-auto mb-6 p-1 h-auto gap-2 scrollbar-hide ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100/80'}`}>
          {['details', 'opportunities', 'activity', 'tasks', 'documents', 'discovery', 'ai'].map(tab => {
            const icons = { details: User, opportunities: Briefcase, activity: Activity, tasks: CheckSquare, documents: FileText, discovery: ClipboardList, ai: Sparkles };
            const labels = { details: '360 Profile', opportunities: 'Opportunities', activity: 'Activity', tasks: 'Tasks', documents: 'Documents', discovery: 'Script', ai: 'AI Analysis' };
            const Icon = icons[tab];
            const isDisabled = !lead && tab !== 'details' && tab !== 'documents';
            
            return (
              <TabsTrigger 
                key={tab} 
                value={tab} 
                disabled={isDisabled}
                className={`flex-shrink-0 flex flex-col md:flex-row items-center justify-center gap-2 py-2 px-4 min-w-fit whitespace-nowrap rounded-md transition-all data-[state=active]:shadow-sm ${
                  theme === 'dark' 
                    ? 'data-[state=active]:bg-slate-700 data-[state=active]:text-cyan-400 text-slate-400' 
                    : tab === 'ai' ? 'data-[state=active]:bg-white data-[state=active]:text-purple-700' : 'data-[state=active]:bg-white data-[state=active]:text-red-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs md:text-sm">{labels[tab]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="details">
          <div className="space-y-6">
            {lead && <LastTouchInfo entity={lead} entityType="Lead" />}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2">
                  <Label className={labelClass}>Client Tags</Label>
                  <TagManager
                  tags={watch("tags") || []}
                  onChange={(newTags) => setValue("tags", newTags)} />

              </div>

              <div className="space-y-1">
                <Label className={labelClass}>Full Name *</Label>
                <Input
                  {...register("full_name", { required: "Required" })}
                  placeholder="e.g., John Doe"
                  className={inputClass} />

                {errors.full_name && <span className="text-red-500 text-sm font-medium">{errors.full_name.message}</span>}
              </div>
              
              <div className="space-y-1">
                <Label className={labelClass}>Phone Number *</Label>
                <Input
                  {...register("phone_number", {
                    required: "Required",
                    pattern: {
                      value: /^0[0-9]{1,2}-?[0-9]{7}$/,
                      message: "Invalid phone number"
                    }
                  })}
                  placeholder="050-0000000"
                  className={inputClass} />

                {errors.phone_number && <span className="text-red-500 text-sm font-medium">{errors.phone_number.message}</span>}
              </div>

              <div className="space-y-1">
                <Label className={labelClass}>Email</Label>
                <Input
                  {...register("email", {
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address"
                    }
                  })}
                  placeholder="email@example.com"
                  className={inputClass} />

                {errors.email && <span className="text-red-500 text-sm font-medium">{errors.email.message}</span>}
              </div>

              <div className="space-y-1">
                <Label className={labelClass}>Age</Label>
                <Input
                  type="number"
                  {...register("age", { valueAsNumber: true })}
                  placeholder="e.g., 68"
                  className={inputClass} />

              </div>

              <div className="space-y-1">
                <Label className={labelClass}>City</Label>
                <Input
                  {...register("city")}
                  placeholder="e.g., Tel Aviv"
                  className={inputClass} />

              </div>

              <div className="space-y-1">
                <Label className={labelClass}>Source Year</Label>
                <Select
                  defaultValue={lead?.source_year || "2024"}
                  onValueChange={(val) => handleSelectChange("source_year", val)}>

                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className={labelClass}>Lead Temperature</Label>
                <Select
                  defaultValue={lead?.lead_temperature || "Cold"}
                  onValueChange={(val) => handleSelectChange("lead_temperature", val)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select Temperature" />
                  </SelectTrigger>
                  <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                    <SelectItem value="Hot">Hot</SelectItem>
                    <SelectItem value="Warm">Warm</SelectItem>
                    <SelectItem value="Cold">Cold</SelectItem>
                    <SelectItem value="Hot History">Hot History</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className={labelClass}>Lead Status</Label>
                <Select
                  defaultValue={lead?.lead_status || "New"}
                  onValueChange={(val) => handleSelectChange("lead_status", val)}>

                  <SelectTrigger className={`${inputClass} ${leadStatus === 'Converted' ? (theme === 'dark' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-emerald-50 border-emerald-500 text-emerald-700') : ''}`}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Attempting Contact">Attempting Contact</SelectItem>
                    <SelectItem value="Contacted - Qualifying">Contacted - Qualifying</SelectItem>
                    <SelectItem value="Sales Ready">Sales Ready</SelectItem>
                    <SelectItem value="Lost / Unqualified">Lost / Unqualified</SelectItem>
                    <SelectItem value="Converted" className="text-emerald-600 font-bold">Converted</SelectItem>
                  </SelectContent>
                </Select>
                {leadStatus === 'Converted' &&
                <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    Saving will create a new opportunity
                  </p>
                }
              </div>

              <div className="space-y-1">
                <Label className={labelClass}>Assigned To</Label>
                <Select
                  defaultValue={lead?.assigned_to || ""}
                  onValueChange={(val) => handleSelectChange("assigned_to", val)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select User" />
                  </SelectTrigger>
                  <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users?.map(u => (
                      <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className={labelClass}>Last Contact Date</Label>
                <Input
                  type="date"
                  {...register("last_contact_date")}
                  className={inputClass} />

              </div>

              {/* Custom Fields Section */}
              {customFields?.length > 0 && (
                <div className={`col-span-1 md:col-span-2 pt-4 border-t mt-2 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Additional Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {customFields.map((field) => (
                            <div key={field.id} className="space-y-1">
                                <Label className={labelClass}>{field.label}</Label>
                                {field.type === 'select' ? (
                                    <Select 
                                        defaultValue={lead?.custom_data?.[field.name] || ""} 
                                        onValueChange={(val) => handleSelectChange(`custom_data.${field.name}`, val)}
                                    >
                                        <SelectTrigger className={inputClass}>
                                            <SelectValue placeholder={`Select ${field.label}`} />
                                        </SelectTrigger>
                                        <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                            {field.options?.map((opt, i) => (
                                                <SelectItem key={i} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : field.type === 'boolean' ? (
                                     <Select 
                                        defaultValue={String(lead?.custom_data?.[field.name] || "false")}
                                        onValueChange={(val) => handleSelectChange(`custom_data.${field.name}`, val === 'true')}
                                    >
                                        <SelectTrigger className={inputClass}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                            <SelectItem value="true">Yes</SelectItem>
                                            <SelectItem value="false">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                        {...register(`custom_data.${field.name}`, { 
                                            valueAsNumber: field.type === 'number' 
                                        })}
                                        className={inputClass}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
              )}

              </div>

              {/* Quick Task Creation */}
              {lead && <QuickTaskCreator leadId={lead.id} leadName={lead.full_name} />}

            <div className="space-y-1">
              <Label className={labelClass}>Notes</Label>
              <Textarea
                {...register("notes")}
                placeholder="Important notes..."
                className={`${inputClass} h-24 resize-none`} />

            </div>
            
            <div className={`flex flex-col items-end gap-2 pt-6 border-t mt-4 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
              {Object.keys(errors).length > 0 &&
              <span className={`text-sm font-bold px-3 py-1 rounded-full animate-pulse border ${theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}>
                      Please check form errors
                  </span>
              }
              <div className="flex justify-between items-center w-full">
                <Button onClick={handleSubmit(handleSaveAndClose, onFormError)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  Save
                </Button>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={onCancel} className={theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-50'}>Cancel</Button>
                  {lead ? (
                    <Button onClick={handleSubmit(handleSaveAndStay, onFormError)} className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 shadow-sm shadow-red-900/20" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                      Update Lead File
                    </Button>
                  ) : (
                    <Button onClick={handleSubmit(handleSaveAndClose, onFormError)} className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 shadow-sm shadow-red-900/20" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                      Create New Lead
                    </Button>
                  )}
                </div>
              </div>
            </div>
              </div>
              </TabsContent>

              <TabsContent value="opportunities" className="h-[600px] overflow-y-auto pr-2">
                {!lead ? <div className="text-center py-10 text-slate-400">Save the lead first</div> : 
                  <LeadOpportunities lead={lead} theme={theme} />
                }
              </TabsContent>

              <TabsContent value="activity" className="h-[600px]">
              {lead ? <ActivityLog leadId={lead.id} /> : <div className="text-center py-10 text-slate-400">Save the lead first</div>}
              </TabsContent>

              <TabsContent value="tasks" className="h-[600px]">
                {lead ? <RelatedTasks leadId={lead.id} /> : <div className="text-center py-10 text-slate-400">Save the lead first</div>}
              </TabsContent>

              <TabsContent value="documents">
                <LeadDocuments 
                  lead={lead}
                  documents={watch("documents")}
                  onDocumentsChange={(newFiles) => setValue("documents", newFiles)}
                  onSave={handleSubmit(handleSaveAndClose, onFormError)}
                  onCancel={onCancel}
                  isSubmitting={isSubmitting}
                  theme={theme}
                />
              </TabsContent>

        <TabsContent value="discovery">
          {lead ?
          <div className="h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <DiscoveryScript leadId={lead.id} />
            </div> :

          <div className={`flex flex-col items-center justify-center py-16 text-slate-400 rounded-xl border border-dashed ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <Activity className="w-10 h-10 mb-3 opacity-50" />
              <p className="font-medium">Save the lead first to access Discovery Script</p>
            </div>
          }
        </TabsContent>

        <TabsContent value="ai">
           {lead ? <LeadAiAnalysis lead={lead} /> : <div className="text-center py-10 text-slate-400">Save the lead first</div>}
        </TabsContent>
      </Tabs>
      </div>
    </motion.div>);

}