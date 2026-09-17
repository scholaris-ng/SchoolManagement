import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A standalone counter behind invoice numbers, so deleting an invoice can
 * never cause a later one to reuse its number.
 *
 * Every sequence in this app — this one included, until now — is
 * `MAX(sequence) + 1` over existing rows (see `InvoiceRepository.nextSequence`
 * before this migration, and `AdmissionRepository`'s equivalent). That is
 * exactly why nothing was ever hard-deleted: removing the row holding the
 * current maximum would hand the next invoice raised in that session the
 * same number, now pointing at a different bill — the one thing `Invoice`'s
 * own comment says must never happen. Hard-deleting an invoice needed this
 * fixed first.
 *
 * Seeded from whatever `MAX(sequence)` already is per school/session, so an
 * existing school's next invoice number is unaffected by this migration.
 */
export class InvoiceNumberCounters1791900000000 implements MigrationInterface {
    name = 'InvoiceNumberCounters1791900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "invoice_number_counters" (
                "school_id" uuid NOT NULL,
                "session_id" uuid NOT NULL,
                "last_sequence" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_invoice_number_counters" PRIMARY KEY ("school_id", "session_id")
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "invoice_number_counters"
            ADD CONSTRAINT "FK_invoice_number_counters_school" FOREIGN KEY ("school_id")
                REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "invoice_number_counters"
            ADD CONSTRAINT "FK_invoice_number_counters_session" FOREIGN KEY ("session_id")
                REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            INSERT INTO "invoice_number_counters" ("school_id", "session_id", "last_sequence")
            SELECT "school_id", "session_id", MAX("sequence")
              FROM "invoices"
             GROUP BY "school_id", "session_id"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoice_number_counters" DROP CONSTRAINT "FK_invoice_number_counters_session"`);
        await queryRunner.query(`ALTER TABLE "invoice_number_counters" DROP CONSTRAINT "FK_invoice_number_counters_school"`);
        await queryRunner.query(`DROP TABLE "invoice_number_counters"`);
    }

}
