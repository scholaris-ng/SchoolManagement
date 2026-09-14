import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Where a custom bill's total can be paid — a bill-level list, since its
 * charges are freeform text rather than fee items with their own accounts
 * to hang a payment destination off. See `CustomBill.accounts`.
 */
export class CustomBillAccounts1791400000000 implements MigrationInterface {
    name = 'CustomBillAccounts1791400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_bills" ADD "accounts" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_bills" DROP COLUMN "accounts"`);
    }

}
