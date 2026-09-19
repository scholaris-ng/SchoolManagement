import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Who reversed a payment, when, and why — the three facts a reversed row has
 * to carry now that `REVERSED` is something the office can actually do. See
 * `PaymentsService.reversePayment`.
 */
export class PaymentReversal1792300000000 implements MigrationInterface {
    name = 'PaymentReversal1792300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" ADD "reversed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "reversed_by_user_id" uuid`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "reversal_reason" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "reversal_reason"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "reversed_by_user_id"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "reversed_at"`);
    }

}
