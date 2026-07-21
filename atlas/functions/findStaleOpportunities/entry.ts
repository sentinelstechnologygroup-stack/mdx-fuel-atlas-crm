import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

Deno.serve(async (req) => {
  try {
    const atlasRuntime = createClientFromRequest(req);

    // An opportunity is "stale" if it has no Activity in the last 14 days.
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const opportunities = await atlasRuntime.asServiceRole.entities.Opportunity.list();
    const activities = await atlasRuntime.asServiceRole.entities.Activity.list();
    const users = await atlasRuntime.asServiceRole.entities.User.list();
    const userEmail = {};
    for (const u of users) userEmail[u.id] = u.email;

    const stale = [];
    for (const opp of opportunities) {
      const recent = activities.filter((a) => {
        const aDate = a.date ? new Date(a.date) : null;
        if (!aDate) return false;
        const related = a.opportunity_id === opp.id || (opp.lead_id && a.lead_id === opp.lead_id);
        return related && aDate >= cutoff;
      });

      if (recent.length === 0) {
        const ownerEmail = userEmail[opp.created_by_id] || opp.email || "";
        stale.push({
          id: opp.id,
          lead_name: opp.lead_name,
          lead_id: opp.lead_id,
          owner_email: ownerEmail,
          deal_stage: opp.deal_stage,
          amount: opp.amount
        });
      }
    }

    // Notify each owner about their stale opportunity
    let notified = 0;
    for (const opp of stale) {
      if (!opp.owner_email) continue;
      try {
        await atlasRuntime.asServiceRole.integrations.Core.SendEmail({
          to: opp.owner_email,
          subject: "Action needed: opportunity with no recent activity",
          body:
            `Hi,\n\nThe opportunity "${opp.lead_name || "Untitled"}" (stage: ${opp.deal_stage || "n/a"}, amount: ${opp.amount ?? "n/a"}) has had no activity in the last 14 days.\n\n` +
            `Please review it and log a follow-up activity soon.\n\n— CRM Workflow`,
          from_name: "CRM Alerts"
        });
        notified++;
      } catch (e) {
        // continue with other owners
      }
    }

    return Response.json({
      opportunities: stale,
      notified,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});