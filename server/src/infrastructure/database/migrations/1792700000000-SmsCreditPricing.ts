import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * What a top-up was paid for, in naira, and the per-page price it was
 * converted at — so the ledger reconciles against money received even after
 * the price changes. Null on debits and refunds, which move pages only.
 */
export class SmsCreditPricing1792700000000 implements MigrationInterface {
    name = 'SmsCreditPricing1792700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sms_credit_entries" ADD "amount_ngn" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "sms_credit_entries" ADD "unit_price_ngn" numeric(10,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sms_credit_entries" DROP COLUMN "unit_price_ngn"`);
        await queryRunner.query(`ALTER TABLE "sms_credit_entries" DROP COLUMN "amount_ngn"`);
    }

}
