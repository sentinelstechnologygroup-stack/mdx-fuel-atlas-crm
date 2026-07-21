import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

// createAuthorizedRecord — thin, named wrapper over the authorizedRecords gateway.
Deno.serve(async (req) => {
  try {
    const atlasRuntime = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (_e) { body = {}; }
    const res = await atlasRuntime.functions.invoke('authorizedRecords', { ...body, operation: 'create' });
    return Response.json(res?.data ?? res, { status: res?.status ?? 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});