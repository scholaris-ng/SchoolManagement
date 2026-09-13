import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A family's own evidence of an offline payment, and the office's sign-off on
 * it (spec section 27).
 *
 * Kept entirely separate from `payments`: a row here is a claim a parent
 * made, not money the office has confirmed. It only ever produces a real
 * `payments` row — via `payment_id`, set at approval — and never becomes one
 * by being edited in place, so the ledger stays exactly what section 26 says
 * it must be: ordinary transfers and desk takings, never a photograph of one.
 */
export class PaymentReceipts1790900000000 implements MigrationInterface {
    name = 'PaymentReceipts1790900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "invoice_id" uuid, "amount" numeric(12,2) NOT NULL, "method" character varying(20) NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reference" character varying(80), "note" text, "storage_path" character varying(500) NOT NULL, "mime_type" character varying(120) NOT NULL, "size_bytes" bigint NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "submitted_by_user_id" uuid, "submitted_by_name" character varying(160) NOT NULL, "reviewed_by_user_id" uuid, "reviewed_by_name" character varying(160), "reviewed_at" TIMESTAMP WITH TIME ZONE, "review_note" text, "payment_id" uuid, CONSTRAINT "PK_payment_receipts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_payment_receipts_school" ON "payment_receipts" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payment_receipts_school_student" ON "payment_receipts" ("school_id", "student_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payment_receipts_school_status" ON "payment_receipts" ("school_id", "status") `);
        await queryRunner.query(`ALTER TABLE "payment_receipts" ADD CONSTRAINT "FK_payment_receipts_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_receipts" ADD CONSTRAINT "FK_payment_receipts_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // A cancelled or reissued invoice must not leave an old claim pointing at
        // nothing sensible, but the claim itself — and the slip behind it — is
        // still worth keeping.
        await queryRunner.query(`ALTER TABLE "payment_receipts" ADD CONSTRAINT "FK_payment_receipts_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_receipts" ADD CONSTRAINT "FK_payment_receipts_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_receipts" DROP CONSTRAINT "FK_payment_receipts_payment"`);
        await queryRunner.query(`ALTER TABLE "payment_receipts" DROP CONSTRAINT "FK_payment_receipts_invoice"`);
        await queryRunner.query(`ALTER TABLE "payment_receipts" DROP CONSTRAINT "FK_payment_receipts_student"`);
        await queryRunner.query(`ALTER TABLE "payment_receipts" DROP CONSTRAINT "FK_payment_receipts_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_receipts_school_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_receipts_school_student"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_receipts_school"`);
        await queryRunner.query(`DROP TABLE "payment_receipts"`);
    }

}
