import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { RoleService } from '../services/role.service';
import type { CreateRoleInput, UpdateRoleInput } from '../validators/role.schema';

export class RoleController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await RoleService.Instance.fetchRoles(contextOf(req));
      res.status(200).json(ApiResponse.ok(roles));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await RoleService.Instance.createRole(
        contextOf(req),
        req.validated!.body as CreateRoleInput,
      );
      res.status(201).json(ApiResponse.created(role, 'Role created'));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const role = await RoleService.Instance.updateRole(
        contextOf(req),
        id,
        req.validated!.body as UpdateRoleInput,
      );
      res.status(200).json(ApiResponse.ok(role, 'Role updated'));
    } catch (error) {
      next(error);
    }
  }
}
