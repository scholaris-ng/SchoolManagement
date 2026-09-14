import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A named bank account per fee item, for schools that route different
 * charges to different accounts — tuition to the main account, PTA dues to
 * the PTA's own. Copied onto `invoice_lines` at issue time for the same
 * reason `description` and `unit_amount` already are: an invoice already
 * sent must keep naming the account it was raised under, even after the fee
 * item's own default changes.
 */
export class FeeItemPaymentAccounts1791100000000 implements MigrationInterface {
    name = 'FeeItemPaymentAccounts1791100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fee_items" ADD "bank_name" character varying(80)`);
        await queryRunner.query(`ALTER TABLE "fee_items" ADD "account_number" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "fee_items" ADD "account_name" character varying(160)`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD "bank_name" character varying(80)`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD "account_number" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD "account_name" character varying(160)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP COLUMN "account_name"`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP COLUMN "account_number"`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP COLUMN "bank_name"`);
        await queryRunner.query(`ALTER TABLE "fee_items" DROP COLUMN "account_name"`);
        await queryRunner.query(`ALTER TABLE "fee_items" DROP COLUMN "account_number"`);
        await queryRunner.query(`ALTER TABLE "fee_items" DROP COLUMN "bank_name"`);
    }

}
