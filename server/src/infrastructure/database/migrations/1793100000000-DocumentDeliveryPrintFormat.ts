import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Which shape of paper a printed copy was: the whole document on A4 or a half
 * sheet, or the narrow slip a thermal POS roll takes.
 *
 * Worth a column rather than a line in `note`, because at a desk these are two
 * different acts — one produces a document a parent files, the other a till slip
 * handed over on the spot — and the office needs to be able to *filter* on it:
 * "which receipts only ever got a slip?" is a real question, and free text
 * cannot answer it.
 *
 * Nullable, and null on every existing row: the prints logged before this
 * migration genuinely are of unknown shape, and a default of `FULL_PAGE` would
 * have the register assert something nobody recorded. The check constraint keeps
 * it null off the `PRINT` channel, so an emailed copy can never claim a paper
 * size.
 */
export class DocumentDeliveryPrintFormat1793100000000 implements MigrationInterface {
    name = 'DocumentDeliveryPrintFormat1793100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_deliveries" ADD "print_format" character varying(16)`);
        await queryRunner.query(`ALTER TABLE "document_deliveries" ADD CONSTRAINT "CHK_document_deliveries_print_format" CHECK (("channel" = 'PRINT') OR ("print_format" IS NULL))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_deliveries" DROP CONSTRAINT "CHK_document_deliveries_print_format"`);
        await queryRunner.query(`ALTER TABLE "document_deliveries" DROP COLUMN "print_format"`);
    }

}
