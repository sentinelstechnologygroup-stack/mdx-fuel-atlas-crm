import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import * as XLSX from 'npm:xlsx';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { reportId, timeRange } = await req.json();

        // 1. Calculate Date Range
        let startDate = null;
        let endDate = null;
        const now = new Date();

        switch (timeRange) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'this_week':
                const firstDay = now.getDate() - now.getDay();
                startDate = new Date(now.setDate(firstDay));
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'this_year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'all':
            default:
                // No filter
                break;
        }

        // Helper to filter by date
        const filterByDate = (items, dateField = 'created_date') => {
            if (!startDate) return items;
            return items.filter(item => {
                const itemDate = new Date(item[dateField]);
                if (endDate) {
                    return itemDate >= startDate && itemDate <= endDate;
                }
                return itemDate >= startDate;
            });
        };

        let data = [];
        let sheetName = "Report";

        // 2. Fetch and Filter Data based on Report ID
        switch (reportId) {
            case 'list': // Detailed Report (Opportunities)
            case 'advanced': // Opportunities Dashboard
            case 'sales': // Sales Performance
            case 'forecast': // Forecast
                // Export Opportunities
                const opportunities = await base44.entities.Opportunity.list();
                const filteredOpps = filterByDate(opportunities, 'created_date'); // Or expected_close_date? Using created_date for consistency
                
                data = filteredOpps.map(o => ({
                    "ID": o.id,
                    "Lead Name": o.lead_name,
                    "Product": o.product_type,
                    "Stage": o.deal_stage,
                    "Amount": o.amount,
                    "Probability": o.probability,
                    "Close Date": o.expected_close_date,
                    "Created Date": o.created_date,
                    "Owner": o.owner || user.email // Assuming owner field or defaulting
                }));
                sheetName = "Opportunities";
                break;

            case 'conversion': // Conversion Rates
            case 'sources': // Lead Sources
                // Export Leads
                const leads = await base44.entities.Lead.list();
                const filteredLeads = filterByDate(leads, 'created_date');
                
                data = filteredLeads.map(l => ({
                    "ID": l.id,
                    "Name": l.full_name,
                    "Email": l.email,
                    "Phone": l.phone_number,
                    "Status": l.lead_status,
                    "Source Year": l.source_year,
                    "City": l.city,
                    "Created Date": l.created_date
                }));
                sheetName = "Leads";
                break;

            case 'activity': // Activity Report
                // Export Activities
                const activities = await base44.entities.Activity.list();
                const filteredActivities = filterByDate(activities, 'date'); // Activity usually has 'date' field
                
                data = filteredActivities.map(a => ({
                    "ID": a.id,
                    "Type": a.type,
                    "Status": a.status,
                    "Date": a.date,
                    "Summary": a.summary,
                    "Lead ID": a.lead_id,
                    "Created Date": a.created_date
                }));
                sheetName = "Activities";
                break;

            default:
                // Default to Opportunities if unknown or custom
                const defaultOpps = await base44.entities.Opportunity.list();
                data = filterByDate(defaultOpps).map(o => ({
                    "ID": o.id,
                    "Name": o.lead_name,
                    "Stage": o.deal_stage,
                    "Amount": o.amount
                }));
                sheetName = "Data";
                break;
        }

        // 3. Generate Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        // Write to base64 string to avoid binary corruption in JSON-oriented SDKs
        const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

        return Response.json({
            file: base64,
            filename: `${sheetName}_${timeRange}.xlsx`
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});