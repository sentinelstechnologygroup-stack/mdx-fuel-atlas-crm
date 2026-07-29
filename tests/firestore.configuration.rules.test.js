// PHASE 5: administrative configuration entity authorization.

import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  afterAll,
  beforeAll,
  describe,
  it,
} from 'vitest';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';

const SHARED_CONFIGURATION_ENTITIES = [
  'OrganizationSettings',
  'CustomField',
  'Team',
  'Territory',
];

const PRIVILEGED_CONFIGURATION_ENTITIES = [
  'RoleDefinition',
  'ModulePermission',
  'UserPermissionOverride',
];

const ADMINISTRATIVE_CONFIGURATION_ENTITIES = [
  {
    entityName: 'AuditLog',
    canRead: isAdminTier,
    canCreate: () => false,
    canUpdate: () => false,
    canDelete: () => false,
  },
  {
    entityName: 'OnboardingTemplate',
    canRead: isAdminTier,
    canCreate: isAdminTier,
    canUpdate: isAdminTier,
    canDelete: isAdminTier,
  },
  {
    entityName: 'Query',
    canRead: () => false,
    canCreate: () => false,
    canUpdate: () => false,
    canDelete: () => false,
  },
];

const BROWSER_USERS = [
  {
    label: 'Super Administrator',
    uid: 'config-super-admin',
    role: 'super_admin',
    status: 'active',
  },
  {
    label: 'Administrator',
    uid: 'config-administrator',
    role: 'administrator',
    status: 'active',
  },
  {
    label: 'Supervisor',
    uid: 'config-supervisor',
    role: 'supervisor',
    status: 'active',
  },
  {
    label: 'Salesperson',
    uid: 'config-salesperson',
    role: 'salesperson',
    status: 'active',
  },
  {
    label: 'Viewer Support',
    uid: 'config-viewer-support',
    role: 'viewer_support',
    status: 'active',
  },
  {
    label: 'Inactive',
    uid: 'config-inactive',
    role: 'salesperson',
    status: 'inactive',
  },
];

let testEnvironment;

function isActive(user) {
  return user.status === 'active';
}

function isAdminTier(user) {
  return (
    isActive(user) &&
    (
      user.role === 'super_admin' ||
      user.role === 'administrator'
    )
  );
}

function legacyRoleFor(role) {
  return role === 'administrator'
    ? 'admin'
    : role;
}

function profileFor(user) {
  return {
    uid: user.uid,
    email: `${user.uid}@example.test`,
    display_name: user.label,
    role: legacyRoleFor(user.role),
    status: user.status,
    application_role: user.role,
    account_status: user.status,
    team_id: 'team-alpha',
    supervisor_user_id: 'config-supervisor',
    territory_ids: ['territory-alpha'],
  };
}

function firestoreFor(user) {
  return testEnvironment
    .authenticatedContext(user.uid, {
      role: legacyRoleFor(user.role),
      status: user.status,
      application_role: user.role,
      account_status: user.status,
    })
    .firestore();
}

function entityRecord(
  database,
  entityName,
  recordId = 'configuration-record'
) {
  return doc(
    database,
    'entities',
    entityName,
    'records',
    recordId
  );
}

function entityCollection(
  database,
  entityName
) {
  return collection(
    database,
    'entities',
    entityName,
    'records'
  );
}

function payloadFor(entityName, suffix = '') {
  return {
    name: `${entityName} ${suffix}`.trim(),
    label: `${entityName} ${suffix}`.trim(),
    status: 'active',
    description:
      `Configuration fixture ${suffix}`.trim(),
  };
}

async function expectPermission(
  allowed,
  operation
) {
  if (allowed) {
    await assertSucceeds(operation);
    return;
  }

  await assertFails(operation);
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  await testEnvironment.clearFirestore();

  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      const database = context.firestore();

      for (const user of BROWSER_USERS) {
        await setDoc(
          doc(database, 'userProfiles', user.uid),
          profileFor(user)
        );
      }

      for (const entityName of [
        ...SHARED_CONFIGURATION_ENTITIES,
        ...PRIVILEGED_CONFIGURATION_ENTITIES,
        ...ADMINISTRATIVE_CONFIGURATION_ENTITIES.map(
          ({ entityName }) => entityName
        ),
      ]) {
        await setDoc(
          entityRecord(database, entityName),
          payloadFor(entityName, 'seeded')
        );

        for (const user of BROWSER_USERS) {
          await setDoc(
            entityRecord(
              database,
              entityName,
              `update-${user.uid}`
            ),
            payloadFor(
              entityName,
              `update-${user.uid}`
            )
          );

          await setDoc(
            entityRecord(
              database,
              entityName,
              `delete-${user.uid}`
            ),
            payloadFor(
              entityName,
              `delete-${user.uid}`
            )
          );
        }
      }
    }
  );
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe(
  'shared configuration entity reads',
  () => {
    for (
      const entityName of
      SHARED_CONFIGURATION_ENTITIES
    ) {
      for (const user of BROWSER_USERS) {
        it(
          `${user.label} ${
            isActive(user) ? 'can' : 'cannot'
          } get ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              isActive(user),
              getDoc(
                entityRecord(database, entityName)
              )
            );
          }
        );

        it(
          `${user.label} ${
            isActive(user) ? 'can' : 'cannot'
          } list ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              isActive(user),
              getDocs(
                entityCollection(
                  database,
                  entityName
                )
              )
            );
          }
        );
      }
    }
  }
);

describe(
  'shared configuration entity writes',
  () => {
    for (
      const entityName of
      SHARED_CONFIGURATION_ENTITIES
    ) {
      for (const user of BROWSER_USERS) {
        it(
          `${user.label} ${
            isAdminTier(user) ? 'can' : 'cannot'
          } create ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              isAdminTier(user),
              setDoc(
                entityRecord(
                  database,
                  entityName,
                  `created-${user.uid}`
                ),
                payloadFor(
                  entityName,
                  user.uid
                )
              )
            );
          }
        );

        it(
          `${user.label} ${
            isAdminTier(user) ? 'can' : 'cannot'
          } update ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              isAdminTier(user),
              updateDoc(
                entityRecord(
                  database,
                  entityName
                ),
                {
                  description:
                    `Updated by ${user.uid}`,
                }
              )
            );
          }
        );
      }
    }
  }
);

describe(
  'shared configuration entity deletion',
  () => {
    for (const user of BROWSER_USERS) {
      it(
        `${user.label} ${
          isAdminTier(user) ? 'can' : 'cannot'
        } delete CustomField`,
        async () => {
          const database = firestoreFor(user);

          await expectPermission(
            isAdminTier(user),
            deleteDoc(
              entityRecord(
                database,
                'CustomField'
              )
            )
          );
        }
      );
    }

    for (const entityName of [
      'OrganizationSettings',
      'Team',
      'Territory',
    ]) {
      for (const user of BROWSER_USERS) {
        it(
          `${user.label} cannot delete ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await assertFails(
              deleteDoc(
                entityRecord(
                  database,
                  entityName
                )
              )
            );
          }
        );
      }
    }
  }
);

describe(
  'privileged configuration entity reads',
  () => {
    for (
      const entityName of
      PRIVILEGED_CONFIGURATION_ENTITIES
    ) {
      for (const user of BROWSER_USERS) {
        it(
          `${user.label} ${
            isAdminTier(user) ? 'can' : 'cannot'
          } get ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              isAdminTier(user),
              getDoc(
                entityRecord(database, entityName)
              )
            );
          }
        );

        it(
          `${user.label} ${
            isAdminTier(user) ? 'can' : 'cannot'
          } list ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              isAdminTier(user),
              getDocs(
                entityCollection(
                  database,
                  entityName
                )
              )
            );
          }
        );
      }
    }
  }
);

describe(
  'privileged configuration entity browser writes',
  () => {
    for (
      const entityName of
      PRIVILEGED_CONFIGURATION_ENTITIES
    ) {
      for (const user of BROWSER_USERS) {
        it(
          `${user.label} cannot create ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await assertFails(
              setDoc(
                entityRecord(
                  database,
                  entityName,
                  `created-${user.uid}`
                ),
                payloadFor(
                  entityName,
                  user.uid
                )
              )
            );
          }
        );

        it(
          `${user.label} cannot update ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await assertFails(
              updateDoc(
                entityRecord(
                  database,
                  entityName
                ),
                {
                  description:
                    `Forbidden update by ${user.uid}`,
                }
              )
            );
          }
        );

        it(
          `${user.label} cannot delete ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await assertFails(
              deleteDoc(
                entityRecord(
                  database,
                  entityName
                )
              )
            );
          }
        );
      }
    }
  }
);

describe(
  'administrative configuration entity authorization',
  () => {
    for (
      const {
        entityName,
        canRead,
        canCreate,
        canUpdate,
        canDelete,
      } of ADMINISTRATIVE_CONFIGURATION_ENTITIES
    ) {
      for (const user of BROWSER_USERS) {
        it(
          `${user.label} ${
            canRead(user) ? 'can' : 'cannot'
          } get ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              canRead(user),
              getDoc(
                entityRecord(database, entityName)
              )
            );
          }
        );

        it(
          `${user.label} ${
            canRead(user) ? 'can' : 'cannot'
          } list ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              canRead(user),
              getDocs(
                entityCollection(
                  database,
                  entityName
                )
              )
            );
          }
        );

        it(
          `${user.label} ${
            canCreate(user) ? 'can' : 'cannot'
          } create ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              canCreate(user),
              setDoc(
                entityRecord(
                  database,
                  entityName,
                  `created-${user.uid}`
                ),
                payloadFor(
                  entityName,
                  user.uid
                )
              )
            );
          }
        );

        it(
          `${user.label} ${
            canUpdate(user) ? 'can' : 'cannot'
          } update ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              canUpdate(user),
              updateDoc(
                entityRecord(
                  database,
                  entityName,
                  `update-${user.uid}`
                ),
                {
                  description:
                    `Updated by ${user.uid}`,
                }
              )
            );
          }
        );

        it(
          `${user.label} ${
            canDelete(user) ? 'can' : 'cannot'
          } delete ${entityName}`,
          async () => {
            const database = firestoreFor(user);

            await expectPermission(
              canDelete(user),
              deleteDoc(
                entityRecord(
                  database,
                  entityName,
                  `delete-${user.uid}`
                )
              )
            );
          }
        );
      }
    }
  }
);