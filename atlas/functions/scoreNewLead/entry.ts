import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    /* fall through */
  }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch (e) {
      /* ignore */
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const atlasRuntime = createClientFromRequest(req);
    const { leadId } = await req.json().catch(() => ({}));
    if (!leadId) return Response.json({ error: "leadId required" }, { status: 400 });

    const leads = await atlasRuntime.asServiceRole.entities.Lead.filter({ id: leadId });
    const lead = leads[0];
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });

    // Pull the DiscoveryData for this lead
    let discovery = [];
    try {
      discovery = await atlasRuntime.asServiceRole.entities.DiscoveryData.filter({ lead_id: leadId });
    } catch (e) {
      discovery = [];
    }
    const dd = discovery[0] || null;

    const discoveryText = dd
      ? `Requirements: ${dd.requirements || "n/a"}\nBudget: ${dd.budget ?? "n/a"}\nTimeline: ${dd.timeline || "n/a"}\nNotes: ${dd.notes || "n/a"}\nDocuments collected: ${(dd.documents_collected || []).join(", ") || "none"}`
      : "No discovery data on file.";

    let score = 0;
    let classification = "Cold";
    let reasoning = "";

    // Have the SalesAssistant analyze the discovery data and score the lead
    try {
      const conv = await atlasRuntime.asServiceRole.agents.createConversation({
        agent_name: "SalesAssistant",
        metadata: { source: "lead_qualification_workflow", lead_id: leadId }
      });
      await atlasRuntime.asServiceRole.agents.addMessage(conv, {
        role: "user",
        content:
          `A new lead was created. Analyze the discovery data below and score this lead's quality.\n\n` +
          `Lead: ${lead.full_name || ""} (source year: ${lead.source_year || "n/a"}, city: ${lead.city || "n/a"})\n\n` +
          `Discovery Data:\n${discoveryText}\n\n` +
          `Respond with ONLY a JSON object: {"score": <integer 0-100>, "classification": "Hot"|"Warm"|"Cold", "reasoning": "<1-2 sentences>"}`
      });
      const updated = await atlasRuntime.asServiceRole.agents.getConversation(conv.id);
      const assistantMsg = (updated.messages || []).filter((m) => m.role === "assistant").pop();
      const json = extractJson(assistantMsg ? assistantMsg.content : "");
      if (json) {
        score = Number(json.score) || 0;
        classification = json.classification || "Cold";
        reasoning = json.reasoning || "";
      }
    } catch (e) {
      // on any agent error, leave defaults (score 0 -> not high)
    }

    // Persist the AI scoring on the lead
    try {
      await atlasRuntime.asServiceRole.entities.Lead.update(leadId, {
        ai_quality_score: score,
        ai_classification: classification,
        ai_analysis: reasoning,
        ai_last_analysis_date: new Date().toISOString()
      });
    } catch (e) {
      /* ignore */
    }

    return Response.json({
      leadId,
      leadName: lead.full_name,
      score,
      classification,
      reasoning,
      ownerEmail: lead.assigned_to || ""
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});