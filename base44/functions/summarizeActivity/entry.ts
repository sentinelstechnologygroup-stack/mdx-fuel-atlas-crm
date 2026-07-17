import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { activityText, leadId } = await req.json();

        if (!activityText || !leadId) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Fetch lead data for context
        const leads = await base44.entities.Lead.filter({ id: leadId });
        const lead = leads[0];

        if (!lead) {
            return Response.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Call AI to summarize and extract structured data
        const aiResult = await base44.integrations.Core.InvokeLLM({
            prompt: `אתה עוזר מקצועי המנתח תיעוד שיחות ופגישות עם לקוחות במערכת CRM.

קיבלת תיעוד חופשי של פעילות עם לקוח, ועליך לחלץ ממנו מידע מובנה ומקצועי.

**פרטי הלקוח הקיימים:**
- שם: ${lead.full_name}
- טלפון: ${lead.phone_number || 'לא ידוע'}
- אימייל: ${lead.email || 'לא ידוע'}
- עיר: ${lead.city || 'לא ידועה'}
- גיל: ${lead.age || 'לא ידוע'}
- סטטוס משפחתי: ${lead.marital_status || 'לא ידוע'}

**התיעוד שהתקבל:**
${activityText}

**המשימה שלך:**
1. צור סיכום מקצועי ומסודר של הפעילות (2-4 משפטים)
2. חלץ נקודות מפתח חשובות
3. זהה פעולות שצריך לבצע (call to action)
4. זהה צעדים הבאים (next steps)
5. אם נזכר מידע חדש על הלקוח שלא קיים בפרטים הנוכחיים (כמו גיל, עיר, טלפון, אימייל, מצב משפחתי, הערות רלוונטיות) - חלץ אותו

חשוב: אל תמציא מידע שלא מופיע בטקסט!`,
            response_json_schema: {
                type: "object",
                properties: {
                    professional_summary: {
                        type: "string",
                        description: "סיכום מקצועי של הפעילות"
                    },
                    key_points: {
                        type: "array",
                        items: { type: "string" },
                        description: "נקודות מפתח חשובות מהשיחה"
                    },
                    call_to_action: {
                        type: "string",
                        description: "פעולה שצריך לבצע כעת"
                    },
                    next_steps: {
                        type: "array",
                        items: { type: "string" },
                        description: "צעדים הבאים"
                    },
                    extracted_lead_data: {
                        type: "object",
                        description: "מידע חדש על הלקוח שנמצא בשיחה",
                        properties: {
                            age: { type: "number" },
                            city: { type: "string" },
                            email: { type: "string" },
                            phone_number: { type: "string" },
                            marital_status: { 
                                type: "string",
                                enum: ["Married", "Widowed", "Divorced", "Single"]
                            },
                            spouse_age: { type: "number" },
                            estimated_property_value: { type: "number" },
                            existing_mortgage_balance: { type: "number" },
                            has_children: { type: "boolean" },
                            additional_notes: { type: "string" }
                        }
                    }
                },
                required: ["professional_summary", "key_points", "call_to_action", "next_steps"]
            }
        });

        // Update lead with extracted data (only non-empty fields that are currently empty in lead)
        const leadUpdates = {};
        if (aiResult.extracted_lead_data) {
            const extracted = aiResult.extracted_lead_data;
            
            // Only update fields that are currently empty/null in the lead
            if (!lead.age && extracted.age) leadUpdates.age = extracted.age;
            if (!lead.city && extracted.city) leadUpdates.city = extracted.city;
            if (!lead.email && extracted.email) leadUpdates.email = extracted.email;
            if (!lead.phone_number && extracted.phone_number) leadUpdates.phone_number = extracted.phone_number;
            if (!lead.marital_status && extracted.marital_status) leadUpdates.marital_status = extracted.marital_status;
            if (!lead.spouse_age && extracted.spouse_age) leadUpdates.spouse_age = extracted.spouse_age;
            if (!lead.estimated_property_value && extracted.estimated_property_value) {
                leadUpdates.estimated_property_value = extracted.estimated_property_value;
            }
            if (!lead.existing_mortgage_balance && extracted.existing_mortgage_balance) {
                leadUpdates.existing_mortgage_balance = extracted.existing_mortgage_balance;
            }
            if (lead.has_children === null && extracted.has_children !== null) {
                leadUpdates.has_children = extracted.has_children;
            }
            
            // Append additional notes if found
            if (extracted.additional_notes) {
                const currentNotes = lead.notes || '';
                const timestamp = new Date().toLocaleDateString('he-IL');
                leadUpdates.notes = currentNotes + `\n\n[${timestamp}] ${extracted.additional_notes}`;
            }
        }

        // Update lead if there are changes
        if (Object.keys(leadUpdates).length > 0) {
            await base44.entities.Lead.update(leadId, leadUpdates);
        }

        return Response.json({
            summary: aiResult,
            leadUpdates,
            updatedFieldsCount: Object.keys(leadUpdates).length
        });

    } catch (error) {
        console.error('Error summarizing activity:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});