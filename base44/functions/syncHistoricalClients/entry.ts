import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Security Check: Ensure user is authenticated and is an admin
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }
        
        // Use service role for migration to bypass RLS and ensure all data is processed
        const adminClient = base44.asServiceRole;

        // Fetch data using service role
        const opportunities = await adminClient.entities.Opportunity.list();
        const leads = await adminClient.entities.Lead.list();
        const existingClients = await adminClient.entities.Client.list();

        // Debug log
        console.log(`Found ${opportunities.length} opps, ${leads.length} leads, ${existingClients.length} clients`);

        const wonOpportunities = opportunities.filter(o => 
            (o.deal_stage && (o.deal_stage.includes('Won') || o.deal_stage === 'Closed Won'))
        );

        console.log(`Found ${wonOpportunities.length} won opportunities to check`);

        let processedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const opportunity of wonOpportunities) {
            try {
                 // Check if already linked
                if (opportunity.client_id) {
                    skippedCount++;
                    continue;
                }

                 // Double check if a client exists with this crm_opportunity_id (avoid duplicates)
                const existingClient = existingClients.find(c => c.crm_opportunity_id === opportunity.id);
                if (existingClient) {
                     // Update opportunity with link if missing
                     console.log(`Linking existing client ${existingClient.id} to opp ${opportunity.id}`);
                     await adminClient.entities.Opportunity.update(opportunity.id, { client_id: existingClient.id });
                     skippedCount++;
                     continue;
                }

                const lead = leads.find(l => l.id === opportunity.lead_id);
                if (!lead) {
                    console.log(`Lead not found for opp ${opportunity.id}, skipping`);
                    continue;
                }

                // Prepare Client Data
                const leadDocs = lead.documents || [];
                const oppDocs = opportunity.documents || [];
                // Unique documents by url
                const allDocs = [...leadDocs, ...oppDocs].filter((doc, index, self) => 
                    index === self.findIndex((d) => (d.url === doc.url))
                );

                const clientData = {
                    crm_lead_id: lead.id,
                    crm_opportunity_id: opportunity.id,
                    full_name: lead.full_name,
                    email: lead.email || opportunity.email || "unknown@example.com", // Fallback to avoid schema errors if email required
                    phone_number: lead.phone_number || opportunity.phone_number,
                    product_type: opportunity.product_type || "Unknown",
                    initial_amount: opportunity.amount || 0,
                    contract_start_date: opportunity.updated_date ? opportunity.updated_date.split('T')[0] : new Date().toISOString().split('T')[0],
                    onboarding_status: "Not Started",
                    customer_segment: (opportunity.amount || 0) > 50000 ? "Key Account" : (opportunity.amount || 0) > 10000 ? "Enterprise" : "SMB",
                    health_score: 100,
                    last_engagement_date: opportunity.updated_date || new Date().toISOString(),
                    renewal_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                    documents: allDocs
                };

                console.log(`Creating client for opp ${opportunity.id}: ${clientData.full_name}`);

                // Create Client
                const newClient = await adminClient.entities.Client.create(clientData);

                // Update Opportunity
                await adminClient.entities.Opportunity.update(opportunity.id, { client_id: newClient.id });
                
                // Update Lead if needed
                if (lead.lead_status !== "Converted") {
                    await adminClient.entities.Lead.update(lead.id, { lead_status: "Converted" });
                }

                processedCount++;

            } catch (err) {
                console.error(`Failed to process opportunity ${opportunity.id}:`, err);
                errors.push(`Error processing ${opportunity.id}: ${err.message}`);
            }
        }

        return Response.json({ 
            success: true, 
            processed: processedCount, 
            skipped: skippedCount,
            total_won: wonOpportunities.length,
            errors 
        });

    } catch (error) {
        console.error("Global error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});