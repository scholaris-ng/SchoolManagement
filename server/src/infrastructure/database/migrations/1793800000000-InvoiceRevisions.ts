import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Every version an invoice has had.
 *
 * Correcting a mistake used to mean cancelling the bill and raising a new one,
 * which left two invoice numbers for one term and a balance carried from one
 * onto the other. An edit is now the correction, and this is what makes an edit
 * safe to allow: each one stores the invoice as it stood afterwards, what moved,
 * who moved it and why, so the earlier wording is never lost.
 *
 * `snapshot` holds the whole invoice — charges, discounts, totals, due date and
 * note — rather than a delta, so one row reads on its own and a later change to
 * how fees are calculated cannot make an old version unreadable. `changes` is
 * the plain list of what differed from the version before it.
 *
 * Version 1 is written lazily, the first time an invoice is edited, from the
 * state it was in just before that edit. An invoice nobody has touched has no
 * rows here and is by definition still its original self.
 *
 * `created_by_name` is captured as it was, for the same reason `audit_logs`
 * does: the entry must still read correctly after the person is renamed or
 * leaves the school.
 */
export class InvoiceRevisions1793800000000 implements MigrationInterface {
    name = 'InvoiceRevisions1793800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "invoice_revisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "revision_no" integer NOT NULL, "snapshot" jsonb NOT NULL, "changes" jsonb NOT NULL DEFAULT '[]', "reason" text, "amount_paid" numeric(12,2) NOT NULL DEFAULT 0, "created_by_user_id" uuid, "created_by_name" character varying(160) NOT NULL, CONSTRAINT "PK_invoice_revisions" PRIMARY KEY ("id"))`);
        // One number per invoice; also what stops two simultaneous edits from
        // both writing "version 3".
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_invoice_revisions_invoice_no" ON "invoice_revisions" ("invoice_id", "revision_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_revisions_school" ON "invoice_revisions" ("school_id") `);
        await queryRunner.query(`ALTER TABLE "invoice_revisions" ADD CONSTRAINT "FK_invoice_revisions_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // CASCADE: an invoice can only be hard-deleted when nothing was ever
        // paid or carried (`Invoice.deletable`), and its history goes with it.
        await queryRunner.query(`ALTER TABLE "invoice_revisions" ADD CONSTRAINT "FK_invoice_revisions_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoice_revisions" DROP CONSTRAINT "FK_invoice_revisions_invoice"`);
        await queryRunner.query(`ALTER TABLE "invoice_revisions" DROP CONSTRAINT "FK_invoice_revisions_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoice_revisions_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoice_revisions_invoice_no"`);
        await queryRunner.query(`DROP TABLE "invoice_revisions"`);
    }

}
