import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { leadId, leadName, ownerEmail, score, classification, reasoning } = await req.json().catch(() => ({}));
    if (!leadId) return Response.json({ error: "leadId required" }, { status: 400 });

    const owner = ownerEmail || "";

    // 1. Create a Task for the owner
    let task = null;
    try {
      task = await base44.asServiceRole.entities.Task.create({
        title: `Follow up with qualified lead: ${leadName || leadId}`,
        description: `This lead scored ${score}/100 (${classification}) and was auto-qualified. ${reasoning || ""}`.trim(),
        status: "todo",
        priority: "high",
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        assigned_to: owner,
        related_lead_id: leadId
      });
    } catch (e) {
      /* ignore */
    }

    // 2. Send a notification to the owner
    let notified = false;
    if (owner) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: owner,
          subject: `New qualified lead: ${leadName || leadId}`,
          body:
            `Hi,\n\nA new lead "${leadName || ""}" was auto-qualified with a score of ${score}/100 (${classification}).\n\n` +
            `${reasoning || ""}\n\nA follow-up task has been created for you.\n\n— CRM Workflow`,
          from_name: "CRM Alerts"
        });
        notified = true;
      } catch (e) {
        /* ignore */
      }
    }

    // 3. Update the Lead status to "Qualified"
    let statusUpdated = false;
    try {
      await base44.asServiceRole.entities.Lead.update(leadId, { lead_status: "Qualified" });
      statusUpdated = true;
    } catch (e) {
      /* ignore */
    }

    return Response.json({
      leadId,
      taskCreated: !!task,
      notified,
      statusUpdated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});