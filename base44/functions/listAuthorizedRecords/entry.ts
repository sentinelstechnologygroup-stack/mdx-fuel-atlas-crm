import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// listAuthorizedRecords — thin, named wrapper over the authorizedRecords gateway.
// Delegates to the single authoritative authorization core (see authorizedRecords).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (_e) { body = {}; }
    const res = await base44.functions.invoke('authorizedRecords', { ...body, operation: 'list' });
    return Response.json(res?.data ?? res, { status: res?.status ?? 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});