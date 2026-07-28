import { atlas } from '@/api/atlasClient';

function unwrapUsers(response) {
  return Array.isArray(response?.data?.users)
    ? response.data.users
    : [];
}

export async function listEmployeeLookup() {
  const response = await atlas.functions.invoke(
    'listEmployeeLookup',
    {}
  );

  return unwrapUsers(response);
}

export async function listManagedUsers() {
  const response = await atlas.functions.invoke(
    'listUsers',
    {}
  );

  return unwrapUsers(response);
}

export async function updateManagedUserRole(
  userId,
  applicationRole
) {
  const response = await atlas.functions.invoke(
    'updateUserAccount',
    {
      action: 'role',
      target_user_id: userId,
      value: applicationRole,
    }
  );

  return response?.data?.user || null;
}
