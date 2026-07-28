// tests/userDirectoryService.test.js
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock('@/api/atlasClient', () => ({
  atlas: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

import {
  listEmployeeLookup,
  listManagedUsers,
  updateManagedUserRole,
} from '@/api/userDirectoryService';

describe('user directory callable service', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it('loads the minimal employee lookup', async () => {
    const users = [
      {
        id: 'salesperson-user',
        email: 'salesperson@example.test',
      },
    ];

    mocks.invoke.mockResolvedValue({
      data: {
        users,
      },
    });

    await expect(
      listEmployeeLookup()
    ).resolves.toEqual(users);

    expect(mocks.invoke).toHaveBeenCalledWith(
      'listEmployeeLookup',
      {}
    );
  });

  it('loads the privileged managed-user directory', async () => {
    const users = [
      {
        id: 'admin-user',
        application_role: 'administrator',
      },
    ];

    mocks.invoke.mockResolvedValue({
      data: {
        users,
      },
    });

    await expect(
      listManagedUsers()
    ).resolves.toEqual(users);

    expect(mocks.invoke).toHaveBeenCalledWith(
      'listUsers',
      {}
    );
  });

  it('returns an empty list for a malformed response', async () => {
    mocks.invoke.mockResolvedValue({
      data: {},
    });

    await expect(
      listEmployeeLookup()
    ).resolves.toEqual([]);
  });

  it('updates roles through updateUserAccount', async () => {
    const updatedUser = {
      id: 'viewer-support-user',
      application_role: 'salesperson',
    };

    mocks.invoke.mockResolvedValue({
      data: {
        user: updatedUser,
      },
    });

    await expect(
      updateManagedUserRole(
        'viewer-support-user',
        'salesperson'
      )
    ).resolves.toEqual(updatedUser);

    expect(mocks.invoke).toHaveBeenCalledWith(
      'updateUserAccount',
      {
        action: 'role',
        target_user_id: 'viewer-support-user',
        value: 'salesperson',
      }
    );
  });
});
