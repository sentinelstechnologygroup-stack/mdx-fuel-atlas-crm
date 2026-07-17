import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        const { opportunityId } = payload;

        if (!opportunityId) {
             return Response.json({ error: 'Missing opportunityId' }, { status: 400 });
        }

        // Authorization check: Ensure user has access to this opportunity
        const authorizedOpps = await base44.entities.Opportunity.filter({ id: opportunityId });
        if (!authorizedOpps || authorizedOpps.length === 0) {
             return Response.json({ error: 'Opportunity not found or access denied' }, { status: 403 });
        }
        const opportunity = authorizedOpps[0];

        // Use service role for consistent behavior and permission bypass for system actions
        const adminClient = base44.asServiceRole;

        if (opportunity.client_id) {
             return Response.json({ message: 'Client already exists for this opportunity', clientId: opportunity.client_id });
        }

        // 2. Fetch Lead
        const leads = await adminClient.entities.Lead.list();
        const lead = leads.find(l => l.id === opportunity.lead_id);

        if (!lead) {
             return Response.json({ error: 'Related Lead not found' }, { status: 404 });
        }

        // 3. Prepare Client Data
        // Merge documents
        const leadDocs = lead.documents || [];
        const oppDocs = opportunity.documents || [];
        // Unique documents by url to avoid duplicates
        const allDocs = [...leadDocs, ...oppDocs].filter((doc, index, self) => 
            index === self.findIndex((d) => (d.url === doc.url))
        );

        const clientData = {
            crm_lead_id: lead.id,
            crm_opportunity_id: opportunity.id,
            full_name: lead.full_name,
            email: lead.email || opportunity.email,
            phone_number: lead.phone_number || opportunity.phone_number,
            product_type: opportunity.product_type,
            initial_amount: opportunity.amount,
            contract_start_date: new Date().toISOString().split('T')[0], // Today as start date for conversion
            onboarding_status: "Not Started",
            customer_segment: (opportunity.amount || 0) > 50000 ? "Key Account" : (opportunity.amount || 0) > 10000 ? "Enterprise" : "SMB", 
            health_score: 100,
            last_engagement_date: new Date().toISOString(),
            renewal_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], // 1 year renewal default
            assigned_csm: user.email, // Assign to converter initially
            documents: allDocs
        };

        // 4. Create Client
        const newClient = await adminClient.entities.Client.create(clientData);

        // 5. Update Opportunity
        await adminClient.entities.Opportunity.update(opportunity.id, { client_id: newClient.id });

        // 6. Create Onboarding Task
        await adminClient.entities.Task.create({
            title: `Onboard new client: ${newClient.full_name}`,
            description: `Complete initial onboarding checklist for ${newClient.full_name}. Source Opportunity: ${opportunity.product_type}`,
            status: "todo",
            priority: "high",
            assigned_to: user.email,
            related_client_id: newClient.id,
            due_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0] // Due in 7 days
        });

        // 7. Update Lead status to Converted if not already
        if (lead.lead_status !== "Converted") {
            await adminClient.entities.Lead.update(lead.id, { lead_status: "Converted" });
        }

        return Response.json({ success: true, client: newClient });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});