import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Payment receipts were built against Firebase Storage (`storage_path` plus a
 * signed URL minted fresh on every read) but this server actually stores
 * files in Cloudinary, which was never configured for Firebase — every
 * submission failed with a 500. Cloudinary hands back one stable public link
 * at upload time, so there is nothing left to re-sign: the column just holds
 * that link directly. No data migration needed — no receipt had ever been
 * submitted successfully.
 */
export class PaymentReceiptFileUrl1793300000000 implements MigrationInterface {
    name = 'PaymentReceiptFileUrl1793300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_receipts" RENAME COLUMN "storage_path" TO "file_url"`);
        await queryRunner.query(`ALTER TABLE "payment_receipts" ALTER COLUMN "file_url" TYPE character varying(1000)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_receipts" ALTER COLUMN "file_url" TYPE character varying(500)`);
        await queryRunner.query(`ALTER TABLE "payment_receipts" RENAME COLUMN "file_url" TO "storage_path"`);
    }

}
