import { base44 } from "@/api/base44Client";

export const processAutomation = async (entityName, eventType, newData, previousData = null) => {
  try {
    console.log(`Processing automation for ${entityName} ${eventType}`, newData);
    
    // Fetch active rules for this entity and event
    const rules = await base44.entities.AutomationRule.filter({
      trigger_entity: entityName,
      trigger_event: eventType,
      is_active: true
    });

    if (!rules || rules.length === 0) return;

    for (const rule of rules) {
      let conditionMet = false;

      // Check conditions
      if (!rule.condition_field) {
        // No condition, always run (e.g. on create)
        conditionMet = true;
      } else {
        conditionMet = evaluateCondition(rule, newData, previousData, eventType);
      }

      if (conditionMet) {
        console.log(`Executing rule: ${rule.name}`);
        try {
          await executeAction(rule, newData);
          await logExecution(rule, newData, 'success');
        } catch (error) {
          console.error(`Rule execution failed: ${rule.name}`, error);
          await logExecution(rule, newData, 'failed', error.message);
        }
      }
    }
  } catch (error) {
    console.error("Automation Error:", error);
  }
};

const evaluateCondition = (rule, newData, previousData, eventType) => {
  const operator = rule.condition_operator || 'equals';
  const fieldValue = newData[rule.condition_field];
  const conditionValue = rule.condition_value;

  switch (operator) {
    case 'equals':
      if (eventType === 'update' && previousData) {
        const previousValue = previousData[rule.condition_field];
        return previousValue !== conditionValue && fieldValue === conditionValue;
      }
      return fieldValue === conditionValue;
    
    case 'not_equals':
      return fieldValue !== conditionValue;
    
    case 'contains':
      return String(fieldValue || '').includes(conditionValue);
    
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue);
    
    case 'less_than':
      return Number(fieldValue) < Number(conditionValue);
    
    case 'is_empty':
      return !fieldValue || fieldValue === '';
    
    case 'is_not_empty':
      return fieldValue && fieldValue !== '';
    
    default:
      return fieldValue === conditionValue;
  }
};

const logExecution = async (rule, data, status, errorMessage = null) => {
  try {
    await base44.entities.AutomationLog.create({
      rule_id: rule.id,
      rule_name: rule.name,
      entity_type: rule.trigger_entity,
      entity_id: data.id,
      status,
      error_message: errorMessage,
      action_taken: `${rule.action_type}: ${JSON.stringify(rule.action_config)}`,
      execution_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log automation execution', error);
  }
};

const executeAction = async (rule, data) => {
  const config = rule.action_config || {};
  
  // Helper to replace placeholders like {{full_name}}
  const replacePlaceholders = (text) => {
    if (!text) return "";
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return data[key] !== undefined ? data[key] : "";
    });
  };

  if (rule.action_type === 'send_email') {
    const to = replacePlaceholders(config.email_to);
    
    if (to && to.includes('@')) {
        await base44.integrations.Core.SendEmail({
            to: to,
            subject: replacePlaceholders(config.email_subject),
            body: replacePlaceholders(config.email_body)
        });
    }
  } else if (rule.action_type === 'create_task') {
    const dueDays = Number(config.task_due_days) || 1;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    await base44.entities.Task.create({
        title: replacePlaceholders(config.task_title),
        description: replacePlaceholders(config.task_description),
        status: 'todo',
        due_date: dueDate.toISOString().split('T')[0],
        related_lead_id: rule.trigger_entity === 'Lead' ? data.id : (data.lead_id || null),
        related_opportunity_id: rule.trigger_entity === 'Opportunity' ? data.id : null
    });
  } else if (rule.action_type === 'update_entity') {
    const updateField = config.update_field;
    const updateValue = replacePlaceholders(config.update_value);
    
    if (updateField) {
      const entityName = rule.trigger_entity;
      await base44.entities[entityName].update(data.id, {
        [updateField]: updateValue
      });
    }
  }
};