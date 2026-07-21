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
    const { opportunities = [] } = await req.json().catch(() => ({}));

    // Re-check the window that opened after the 3-day wait
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const activities = await atlasRuntime.asServiceRole.entities.Activity.list();
    const users = await atlasRuntime.asServiceRole.entities.User.list();
    const userEmail = {};
    for (const u of users) userEmail[u.id] = u.email;

    const results = [];
    for (const opp of opportunities) {
      const recent = activities.filter((a) => {
        const aDate = a.date ? new Date(a.date) : null;
        if (!aDate) return false;
        const related = a.opportunity_id === opp.id || (opp.lead_id && a.lead_id === opp.lead_id);
        return related && aDate >= since;
      });

      if (recent.length > 0) {
        results.push({ id: opp.id, lead_name: opp.lead_name, stillStale: false, recentActivityCount: recent.length });
        continue;
      }

      // Still no activity — use the SalesAssistant to summarize recent interactions
      let oppRec = null;
      try {
        const list = await atlasRuntime.asServiceRole.entities.Opportunity.filter({ id: opp.id });
        oppRec = list[0];
      } catch (e) {
        /* ignore */
      }
      const owner = (oppRec && userEmail[oppRec.created_by_id]) || opp.owner_email || "";

      const allRelated = activities.filter(
        (a) => a.opportunity_id === opp.id || (opp.lead_id && a.lead_id === opp.lead_id)
      );
      const interactionsText =
        allRelated
          .map((a) => `- ${a.date || "n/a"} | ${a.type || ""} | ${a.status || ""}: ${a.summary || ""}`)
          .join("\n") || "No prior interactions logged.";

      let taskTitle = `Follow up: ${opp.lead_name || "Opportunity"}`;
      let taskDescription = "No activity on this opportunity for 17+ days. Review and re-engage the client.";

      try {
        const conv = await atlasRuntime.asServiceRole.agents.createConversation({
          agent_name: "SalesAssistant",
          metadata: { source: "stale_opportunity_workflow", opportunity_id: opp.id }
        });
        await atlasRuntime.asServiceRole.agents.addMessage(conv, {
          role: "user",
          content:
            `The opportunity "${opp.lead_name || ""}" (stage: ${opp.deal_stage || ""}, amount: ${opp.amount ?? ""}) has had no activity in the last 14 days and still none after a 3-day follow-up window.\n\n` +
            `Recent interactions:\n${interactionsText}\n\n` +
            `Summarize the recent interactions and suggest a single concrete follow-up task. ` +
            `Respond with ONLY a JSON object: {"summary": "<2-3 sentence summary>", "task_title": "<short task title>", "task_description": "<detailed next step>"}`
        });
        const updated = await atlasRuntime.asServiceRole.agents.getConversation(conv.id);
        const assistantMsg = (updated.messages || []).filter((m) => m.role === "assistant").pop();
        const json = extractJson(assistantMsg ? assistantMsg.content : "");
        if (json) {
          taskTitle = json.task_title || taskTitle;
          const summaryPart = json.summary ? `Summary: ${json.summary}\n\n` : "";
          taskDescription = summaryPart + (json.task_description || taskDescription);
        }
      } catch (e) {
        // fall back to the default task content
      }

      // Create the follow-up Task
      let task = null;
      try {
        task = await atlasRuntime.asServiceRole.entities.Task.create({
          title: taskTitle,
          description: taskDescription,
          status: "todo",
          priority: "high",
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          assigned_to: owner,
          related_opportunity_id: opp.id,
          related_lead_id: opp.lead_id
        });
      } catch (e) {
        /* ignore */
      }

      results.push({
        id: opp.id,
        lead_name: opp.lead_name,
        stillStale: true,
        taskCreated: !!task,
        owner
      });
    }

    return Response.json({
      results,
      followedUp: results.filter((r) => r.stillStale).length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});