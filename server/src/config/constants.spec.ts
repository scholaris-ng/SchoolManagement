import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLES,
  ROLE_LABEL,
  isPermission,
} from './constants';

describe('permission catalogue', () => {
  it('has no duplicates', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('recognises a known permission and rejects an invented one', () => {
    expect(isPermission('result.publish')).toBe(true);
    expect(isPermission('result.definitely-not-a-permission')).toBe(false);
  });
});

describe('default role permissions', () => {
  it('covers every role', () => {
    for (const role of ROLES) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_LABEL[role]).toBeTruthy();
    }
  });

  it('grants only permissions the catalogue knows', () => {
    // A typo here would seed a role with a permission no check ever matches —
    // access silently missing, with nothing to notice it by.
    for (const role of ROLES) {
      for (const permission of DEFAULT_ROLE_PERMISSIONS[role]) {
        expect(isPermission(permission)).toBe(true);
      }
    }
  });

  it('lists no role twice in its own set', () => {
    for (const role of ROLES) {
      const granted = DEFAULT_ROLE_PERMISSIONS[role];
      expect(new Set(granted).size).toBe(granted.length);
    }
  });

  it('reserves platform.manage for the platform operator', () => {
    for (const role of ROLES) {
      if (role === 'SUPER_ADMIN') continue;
      expect(DEFAULT_ROLE_PERMISSIONS[role]).not.toContain('platform.manage');
    }
  });

  it('gives a parent and a student no management permission at all', () => {
    for (const role of ['PARENT', 'STUDENT'] as const) {
      const granted = DEFAULT_ROLE_PERMISSIONS[role];
      expect(granted.filter((permission) => permission.endsWith('.manage'))).toEqual([]);
    }
  });
});
