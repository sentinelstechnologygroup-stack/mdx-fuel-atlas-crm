import React from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, ClipboardList, FileText, Target, Calendar, Wallet } from "lucide-react";

export default function DiscoveryScript({ leadId }) {
  const queryClient = useQueryClient();

  // Fetch existing discovery data
  const { data: existingData, isLoading: isFetching } = useQuery({
    queryKey: ['discovery', leadId],
    queryFn: async () => {
      const res = await base44.entities.DiscoveryData.filter({ lead_id: leadId });
      return res[0] || null;
    },
    enabled: !!leadId
  });

  // Mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existingData?.id) {
        return base44.entities.DiscoveryData.update(existingData.id, data);
      } else {
        return base44.entities.DiscoveryData.create({ ...data, lead_id: leadId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['discovery', leadId]);
    }
  });

  if (isFetching) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return <DiscoveryFormContent initialData={existingData} onSubmit={saveMutation.mutate} isSaving={saveMutation.isPending} />;
}

function DiscoveryFormContent({ initialData, onSubmit, isSaving }) {
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: initialData || {
      notes: "",
      requirements: "",
      budget: "",
      timeline: "",
      documents_collected: []
    }
  });

  const docs = [
    "ID / Company Reg.",
    "Requirements Doc",
    "Budget Approval",
    "Timeline Plan",
    "NDA"
  ];

  const currentDocs = watch("documents_collected") || [];

  const handleDocToggle = (doc) => {
    const newDocs = currentDocs.includes(doc) ?
    currentDocs.filter((d) => d !== doc) :
    [...currentDocs, doc];
    setValue("documents_collected", newDocs);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-1" dir="ltr">
      
      <Card>
        <CardHeader className="bg-slate-50 pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
            <Target className="w-5 h-5" />
            1. Requirements & Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-700">Client Requirements</Label>
            <Textarea {...register("requirements")} placeholder="What are they looking for?" className="h-32" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700">General Notes</Label>
            <Textarea {...register("notes")} placeholder="Meeting notes..." className="h-20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-slate-50 pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
            <Wallet className="w-5 h-5" />
            2. Budget & Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-700">Estimated Budget ($)</Label>
            <Input type="number" {...register("budget", { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700">Timeline Expectation</Label>
            <Input {...register("timeline")} placeholder="e.g. Q4 2025" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 shadow-md">
        <CardHeader className="bg-blue-50 pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
            <ClipboardList className="w-5 h-5" />
            3. Documents Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white pt-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docs.map((doc) =>
            <div key={doc} className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <Checkbox
                id={doc}
                checked={currentDocs.includes(doc)}
                onCheckedChange={() => handleDocToggle(doc)} />

                <Label htmlFor={doc} className="cursor-pointer flex-1 text-slate-700">{doc}</Label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-6 z-10 flex justify-end">
        <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-xl" disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Discovery
        </Button>
      </div>

    </form>);
}