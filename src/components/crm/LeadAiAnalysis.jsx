import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Target, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Progress } from "@/components/ui/progress";

export default function LeadAiAnalysis({ lead }) {
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      try {
        // Prepare lead data for AI
        const leadData = JSON.stringify({
          name: lead.full_name,
          age: lead.age,
          city: lead.city,
          status: lead.lead_status,
          notes: lead.notes,
          last_contact: lead.last_contact_date,
          tags: lead.tags
        });

        const prompt = `
          Analyze this sales lead and provide a JSON response.
          Lead Data: ${leadData}

          Your tasks:
          1. Classify the lead as "Hot", "Warm", or "Cold" based on conversion potential.
          2. Assign a quality score from 0 to 100.
          3. Provide a brief analysis (in English) of why you gave this score based on the available data points.
          4. Suggest 3 concrete next actions (in English) for the sales agent.
          
          Consider: 
          - Completeness of data
          - Engagement level (last contact, notes)
          - Fit for the product/service based on available details
          
          Return ONLY valid JSON matching this schema:
          {
            "classification": "Hot" | "Warm" | "Cold",
            "score": number,
            "analysis": "string (English)",
            "actions": ["string (English)", "string (English)", "string (English)"]
          }
        `;

        const response = await base44.integrations.Core.InvokeLLM({
          prompt: prompt,
          response_json_schema: {
            type: "object",
            properties: {
              classification: { type: "string", enum: ["Hot", "Warm", "Cold"] },
              score: { type: "number" },
              analysis: { type: "string" },
              actions: { type: "array", items: { type: "string" } }
            }
          }
        });

        // Update the lead with AI results
        await base44.entities.Lead.update(lead.id, {
          ai_classification: response.classification,
          ai_quality_score: response.score,
          ai_analysis: response.analysis,
          ai_suggested_actions: response.actions,
          ai_last_analysis_date: new Date().toISOString()
        });

        return response;
      } finally {
        setIsAnalyzing(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['lead', lead.id]);
    }
  });

  const getClassColor = (cls) => {
    switch(cls) {
      case 'Hot': return 'bg-red-100 text-red-800 border-red-200';
      case 'Warm': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Cold': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // If no analysis exists yet
  if (!lead.ai_last_analysis_date && !isAnalyzing) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-3 bg-purple-100 rounded-full">
            <Sparkles className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-purple-900">Smart AI Analysis</h3>
            <p className="text-sm text-purple-700/80 max-w-xs">
              Get automated insights, quality scoring, and action recommendations for this lead using AI.
            </p>
          </div>
          <Button 
            onClick={() => analyzeMutation.mutate()} 
            disabled={isAnalyzing}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Run Lead Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-purple-100 shadow-sm">
      <CardHeader className="bg-purple-50/50 border-b border-purple-100 pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-purple-900">
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI Analysis & Insights
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => analyzeMutation.mutate()}
            disabled={isAnalyzing}
            className="h-8 w-8 p-0 text-purple-400 hover:text-purple-700"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-5">
        
        {/* Score and Classification */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:flex-1 space-y-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">Quality Score</span>
              <span className="font-bold text-slate-700">{lead.ai_quality_score || 0}/100</span>
            </div>
            <Progress value={lead.ai_quality_score || 0} className="h-2" indicatorClassName={getScoreColor(lead.ai_quality_score || 0)} />
          </div>
          <Badge variant="outline" className={`px-3 py-1 text-sm font-bold border w-full sm:w-auto justify-center ${getClassColor(lead.ai_classification)}`}>
            {lead.ai_classification === 'Hot' ? '🔥 Hot' : 
             lead.ai_classification === 'Warm' ? '☀️ Warm' : 
             lead.ai_classification === 'Cold' ? '❄️ Cold' : 'Unrated'}
          </Badge>
        </div>

        {/* Analysis Text */}
        <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700 leading-relaxed border border-slate-100">
          <p>{lead.ai_analysis || "Initial analysis complete."}</p>
        </div>

        {/* Action Items */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">
            <Target className="w-3 h-3" /> Recommended Actions
          </h4>
          <div className="space-y-2">
            {lead.ai_suggested_actions?.map((action, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm bg-white p-2 rounded border border-slate-100 shadow-sm">
                <span className="text-purple-500 font-bold mt-0.5">{idx + 1}.</span>
                <span className="text-slate-700">{action}</span>
              </div>
            ))}
            {(!lead.ai_suggested_actions || lead.ai_suggested_actions.length === 0) && (
              <p className="text-xs text-slate-400 italic">No recommendations at this time.</p>
            )}
          </div>
        </div>

        <div className="text-[10px] text-slate-400 text-left pt-2 border-t border-slate-50 flex justify-between">
          <span>Powered by LLM</span>
          <span>Updated: {new Date(lead.ai_last_analysis_date).toLocaleDateString('en-US')}</span>
        </div>

      </CardContent>
    </Card>
  );
}