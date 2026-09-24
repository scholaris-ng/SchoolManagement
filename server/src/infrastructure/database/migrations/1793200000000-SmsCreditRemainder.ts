import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A top-up rarely divides evenly by the per-page price — ₦100 at ₦8/page is
 * 12.5 pages. Rather than discard the half-page each time (which quietly
 * shorted a school that topped up in several small amounts), the leftover
 * naira is banked here and folded into the next top-up.
 */
export class SmsCreditRemainder1793200000000 implements MigrationInterface {
    name = 'SmsCreditRemainder1793200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "schools" ADD "sms_credit_remainder_ngn" numeric(10,2) NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "sms_credit_remainder_ngn"`);
    }

}
