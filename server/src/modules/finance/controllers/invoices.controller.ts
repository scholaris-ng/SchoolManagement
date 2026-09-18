import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../../../shared/response/apiResponse';
import { contextOf } from '../../../shared/middleware/tenant.middleware';
import { InvoicesService } from '../services/invoices.service';
import type {
  BulkDeleteInvoicesInput,
  CancelInvoiceInput,
  CreateInvoiceInput,
  FetchDebtorsQuery,
  FetchInvoicesQuery,
  SendInvoiceEmailInput,
  UpdateInvoiceInput,
} from '../validators/invoices.schema';

const service = () => InvoicesService.Instance;

export class InvoicesController {
  static async fetchAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchInvoices(
        contextOf(req),
        req.validated!.query as FetchInvoicesQuery,
      );
      res.status(200).json(ApiResponse.paginated(page));
    } catch (error) {
      next(error);
    }
  }

  static async fetchOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchInvoice(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as CreateInvoiceInput;
      const invoice = await service().createInvoice(contextOf(req), body);
      res.status(201).json(ApiResponse.created(invoice, `Invoice ${invoice.invoiceNo} issued`));
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const { reason } = req.validated!.body as CancelInvoiceInput;
      res
        .status(200)
        .json(ApiResponse.ok(await service().cancelInvoice(contextOf(req), id, reason)));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const body = req.validated!.body as UpdateInvoiceInput;
      res.status(200).json(ApiResponse.ok(await service().updateInvoice(contextOf(req), id, body)));
    } catch (error) {
      next(error);
    }
  }

  static async sendEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      const body = req.validated!.body as SendInvoiceEmailInput;
      res.status(200).json(ApiResponse.ok(await service().emailInvoice(contextOf(req), id, body)));
    } catch (error) {
      next(error);
    }
  }

  /**
   * A batch is not all-or-nothing — see `InvoicesService.deleteInvoices`.
   * `200` with a body, not `204`: the caller needs to know which of several
   * selected invoices were actually removed.
   */
  static async deleteMany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated!.body as BulkDeleteInvoicesInput;
      res.status(200).json(ApiResponse.ok(await service().deleteInvoices(contextOf(req), body)));
    } catch (error) {
      next(error);
    }
  }

  /** A student's statement: every charge, waiver and credit, with a summary. */
  static async ledger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.validated!.params as { id: string };
      res.status(200).json(ApiResponse.ok(await service().fetchLedger(contextOf(req), id)));
    } catch (error) {
      next(error);
    }
  }

  static async debtors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = await service().fetchDebtors(
        contextOf(req),
        req.validated!.query as FetchDebtorsQuery,
      );
      res.status(200).json(ApiResponse.paginated(page));
    } catch (error) {
      next(error);
    }
  }
}
