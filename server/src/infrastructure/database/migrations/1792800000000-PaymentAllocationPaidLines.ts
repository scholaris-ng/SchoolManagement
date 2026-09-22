import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Which of an invoice's charges the office says a payment actually covered.
 *
 * `byCategory` and a receipt's "Applied to" table both spread a payment
 * pro-rata across every line of the invoice it settled, because a family
 * rarely says "this part is the bus fare". Sometimes the office knows better
 * — a payment sized to exactly clear tuition and exam, say — and wants the
 * receipt to say so. This is that annotation: which lines of *this*
 * allocation's invoice this payment is marked as having paid for. It changes
 * nothing about how much is owed; see `PaymentsService.markReceiptItems`.
 */
export class PaymentAllocationPaidLines1792800000000 implements MigrationInterface {
    name = 'PaymentAllocationPaidLines1792800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_allocations" ADD "paid_line_ids" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_allocations" DROP COLUMN "paid_line_ids"`);
    }

}
