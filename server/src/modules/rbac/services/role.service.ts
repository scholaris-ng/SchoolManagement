import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { RoleRepository, type RoleWithCount } from '../repositories/role.repository';
import type { CreateRoleInput, UpdateRoleInput } from '../validators/role.schema';

export class RoleService {
  static Instance = new RoleService();

  private constructor(
    private readonly roles = RoleRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchRoles(context: RequestContext): Promise<RoleWithCount[]> {
    return this.roles.findForSchool(context.schoolId);
  }

  async createRole(context: RequestContext, input: CreateRoleInput) {
    const key = toKey(input.name);
    const existing = await this.roles.findByKey(context.schoolId, key);
    if (existing) throw AppError.conflict('A role with that name already exists.');

    const role = await this.roles.create({
      schoolId: context.schoolId,
      name: input.name,
      key,
      description: input.description ?? null,
      isSystem: false,
      permissions: input.permissions,
    });

    await this.audit.record(context, {
      action: 'role.created',
      entityType: 'Role',
      entityId: role.id,
      entityLabel: role.name,
      after: { permissions: role.permissions.length },
      severity: 'CRITICAL',
    });

    return { ...role, memberCount: 0 };
  }

  async updateRole(context: RequestContext, id: string, patch: UpdateRoleInput) {
    const role = await this.roles.findByIdScoped(context.schoolId, id);
    if (!role) throw AppError.notFound('Role');

    // A built-in role's permissions are the school's to change; its name and key
    // are not, so seeding and any code that matches on the key stay meaningful.
    if (role.isSystem && patch.name && patch.name !== role.name) {
      throw AppError.validation('Built-in roles cannot be renamed.');
    }

    const before = { name: role.name, permissions: role.permissions };

    const updated = await this.roles.update(role.id, {
      ...(patch.name && !role.isSystem ? { name: patch.name, key: toKey(patch.name) } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.permissions ? { permissions: patch.permissions } : {}),
    });
    if (!updated) throw AppError.notFound('Role');

    // A permission change is the highest-consequence edit in the product: it
    // silently changes what a group of people can do. Always logged CRITICAL.
    await this.audit.record(context, {
      action: 'role.permissions_changed',
      entityType: 'Role',
      entityId: updated.id,
      entityLabel: updated.name,
      before,
      after: { name: updated.name, permissions: updated.permissions },
      severity: 'CRITICAL',
    });

    const memberCount = await this.roles.countMembers(updated.id);
    return { ...updated, memberCount };
  }
}

/** `Head of Year` becomes `head_of_year` — stable across renames of the label. */
function toKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
