import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

Deno.serve(async (req) => {
    try {
        const atlasRuntime = createClientFromRequest(req);
        
        // 1. Authenticate user
        const user = await atlasRuntime.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Delete user using service role (admin privileges)
        // This is required because regular users typically cannot delete their own entity record directly
        // due to restricted permissions on the User entity.
        await atlasRuntime.asServiceRole.entities.User.delete(user.id);

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});