import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Which earlier invoice a line was carried in from.
 *
 * A follow-up invoice that takes over what is still owing on an earlier one
 * for the same term now carries that balance as real lines, one per fee item
 * still outstanding, instead of as a single lump. That is what lets a payment
 * on the follow-up name the fee item it was for, the same as on any invoice.
 *
 * Those lines are not new billing — the earlier invoice's own lines already
 * count as billed — so anything that adds up what was billed leaves out a line
 * where this is set, and an invoice's `subtotal` never includes one.
 *
 * SET NULL rather than RESTRICT: cancelling the follow-up reopens the earlier
 * invoice, which can then be deleted, and that must not be blocked by a
 * cancelled invoice's leftover lines.
 */
export class InvoiceLineCarriedFrom1793400000000 implements MigrationInterface {
    name = 'InvoiceLineCarriedFrom1793400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD "carried_from_invoice_id" uuid`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_invoice_lines_carried_from_invoice" FOREIGN KEY ("carried_from_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_lines_carried_from_invoice" ON "invoice_lines" ("carried_from_invoice_id") WHERE "carried_from_invoice_id" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_invoice_lines_carried_from_invoice"`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_invoice_lines_carried_from_invoice"`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP COLUMN "carried_from_invoice_id"`);
    }

}
