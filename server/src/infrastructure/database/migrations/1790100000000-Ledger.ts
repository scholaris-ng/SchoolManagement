import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The second half of the ledger: what a family *owes* (spec section 26).
 *
 * `1790000000000-Payments` gave the school somewhere for money to land. This
 * gives it something for that money to land *against*: a fee structure the
 * office defines once per term, the invoices generated from it, the snapshot
 * lines each invoice froze at issue, and the allocations that say which bill a
 * credit paid.
 *
 * Three shapes here are deliberate and worth stating up front:
 *
 * 1. `invoice_lines` copies the fee item's description, category and amount
 *    rather than joining to it. Editing "Tuition" next term must not rewrite a
 *    bill a parent already holds.
 * 2. `invoices` has no soft delete. A withdrawn bill is `CANCELLED` — the
 *    tombstone is a status, because a deleted row cannot explain itself to the
 *    parent who was sent it.
 * 3. Neither `amount_paid` nor `balance` is stored anywhere. Both are the sum
 *    of allocations against the invoice, computed on read; a stored balance is
 *    a second source of truth that drifts from the payments table the first
 *    time a write half-fails.
 *
 * Index names are spelled out rather than left to TypeORM's hashes, and
 * repeated in the entities' `@Index` decorators, so `migration:generate` sees
 * the schema it expects and does not offer to rename them.
 */
export class Ledger1790100000000 implements MigrationInterface {
    name = 'Ledger1790100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        /* -- Who is billed for boarding ------------------------------------- */

        // Boarding is charged to boarders and nobody else, and until now
        // nothing on the pupil said which they were. Defaulting to DAY is the
        // safe direction: it under-bills rather than charging a day pupil for
        // a bed.
        await queryRunner.query(`ALTER TABLE "students" ADD "boarding_status" character varying(10) NOT NULL DEFAULT 'DAY'`);

        /* -- What the school charges, per term ------------------------------ */

        await queryRunner.query(`CREATE TABLE "fee_structures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "session_id" uuid NOT NULL, "term_id" uuid, "level_ids" jsonb NOT NULL DEFAULT '[]', "class_ids" jsonb NOT NULL DEFAULT '[]', "is_active" boolean NOT NULL DEFAULT true, "created_by_user_id" uuid, "version" integer NOT NULL, CONSTRAINT "PK_fee_structures" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fee_structures_school" ON "fee_structures" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fee_structures_school_session" ON "fee_structures" ("school_id", "session_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fee_structures_school_term" ON "fee_structures" ("school_id", "term_id") `);
        await queryRunner.query(`ALTER TABLE "fee_structures" ADD CONSTRAINT "FK_fee_structures_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // RESTRICT: a session with a fee structure hanging off it is not one
        // an administrator should be able to delete out from under the bills.
        await queryRunner.query(`ALTER TABLE "fee_structures" ADD CONSTRAINT "FK_fee_structures_session" FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fee_structures" ADD CONSTRAINT "FK_fee_structures_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "fee_structure_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "fee_structure_id" uuid NOT NULL, "fee_item_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "is_optional" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_fee_structure_lines" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fee_structure_lines_structure" ON "fee_structure_lines" ("fee_structure_id") `);
        // One line per fee item: a structure that charged Tuition twice would
        // double every invoice generated from it.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fee_structure_lines_structure_item" ON "fee_structure_lines" ("fee_structure_id", "fee_item_id") `);
        await queryRunner.query(`ALTER TABLE "fee_structure_lines" ADD CONSTRAINT "FK_fee_structure_lines_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fee_structure_lines" ADD CONSTRAINT "FK_fee_structure_lines_structure" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fee_structure_lines" ADD CONSTRAINT "FK_fee_structure_lines_item" FOREIGN KEY ("fee_item_id") REFERENCES "fee_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        /* -- What a family owes --------------------------------------------- */

        await queryRunner.query(`CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "invoice_no" character varying(40) NOT NULL, "sequence" integer NOT NULL, "session_id" uuid NOT NULL, "term_id" uuid NOT NULL, "class_id" uuid, "fee_structure_id" uuid, "issue_date" date NOT NULL, "due_date" date NOT NULL, "subtotal" numeric(12,2) NOT NULL DEFAULT 0, "discount_total" numeric(12,2) NOT NULL DEFAULT 0, "brought_forward" numeric(12,2) NOT NULL DEFAULT 0, "brought_forward_from" jsonb NOT NULL DEFAULT '[]', "total" numeric(12,2) NOT NULL DEFAULT 0, "status" character varying(16) NOT NULL DEFAULT 'ISSUED', "carried_forward_to_invoice_id" uuid, "note" text, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancel_reason" text, "cancelled_by_user_id" uuid, "created_by_user_id" uuid, "version" integer NOT NULL, CONSTRAINT "PK_invoices" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_school" ON "invoices" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_school_student" ON "invoices" ("school_id", "student_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_school_term" ON "invoices" ("school_id", "term_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_school_status" ON "invoices" ("school_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_school_due_date" ON "invoices" ("school_id", "due_date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_invoices_school_no" ON "invoices" ("school_id", "invoice_no") `);
        // The backstop under bulk billing. The generator already skips a
        // student who has a live invoice for the structure and term; this is
        // what makes two bursars pressing "Generate" at the same moment
        // produce one bill rather than two. Cancelled rows are excluded so a
        // withdrawn bill can be reissued.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_invoices_structure_student_term" ON "invoices" ("fee_structure_id", "student_id", "term_id") WHERE "fee_structure_id" IS NOT NULL AND "status" <> 'CANCELLED'`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // RESTRICT, unlike payments: a payment survives its student because
        // the money still arrived, but an invoice for nobody is meaningless —
        // and a pupil is soft-deleted anyway, so this never fires in practice.
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_session" FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        // The class is a snapshot of where the pupil sat when the bill was
        // issued, so losing the class loses the label, not the invoice.
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_class" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_structure" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_carried_forward_to" FOREIGN KEY ("carried_forward_to_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "invoice_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "fee_item_id" uuid NOT NULL, "description" character varying(200) NOT NULL, "category" character varying(20) NOT NULL, "quantity" integer NOT NULL DEFAULT 1, "unit_amount" numeric(12,2) NOT NULL, "discount_amount" numeric(12,2) NOT NULL DEFAULT 0, "line_total" numeric(12,2) NOT NULL, "is_optional" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_invoice_lines" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_lines_invoice" ON "invoice_lines" ("invoice_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_lines_school_category" ON "invoice_lines" ("school_id", "category") `);
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_invoice_lines_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_invoice_lines_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD CONSTRAINT "FK_invoice_lines_item" FOREIGN KEY ("fee_item_id") REFERENCES "fee_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        /* -- Which bill a credit paid --------------------------------------- */

        await queryRunner.query(`CREATE TABLE "payment_allocations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "payment_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "created_by_user_id" uuid, CONSTRAINT "PK_payment_allocations" PRIMARY KEY ("id"), CONSTRAINT "CHK_payment_allocations_amount" CHECK ("amount" > 0))`);
        await queryRunner.query(`CREATE INDEX "IDX_payment_allocations_payment" ON "payment_allocations" ("payment_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payment_allocations_invoice" ON "payment_allocations" ("invoice_id") `);
        // One payment settles one invoice once. Two rows for the same pair
        // would be a bookkeeping error, not a second instalment — that is a
        // second payment.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_payment_allocations_payment_invoice" ON "payment_allocations" ("payment_id", "invoice_id") `);
        await queryRunner.query(`ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_payment_allocations_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_payment_allocations_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_allocations" ADD CONSTRAINT "FK_payment_allocations_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        /* -- What the receipt and the reconciliation desk need --------------- */

        // Printed on every receipt so a family can have one checked later.
        // Added nullable and backfilled first: the column is NOT NULL and
        // globally unique, and existing Raven credits already have receipts a
        // parent may be holding.
        await queryRunner.query(`ALTER TABLE "payments" ADD "verification_code" character varying(16)`);
        await queryRunner.query(`UPDATE "payments" SET "verification_code" = upper(substr(md5(random()::text || id::text), 1, 10)) WHERE "verification_code" IS NULL`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "verification_code" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_payments_verification_code" ON "payments" ("verification_code") `);
        // The teller number or transfer reference a member of staff copies off
        // the slip. It cannot live in `provider_reference`: that one is unique
        // per provider, and two families genuinely do quote the same bank
        // narration.
        await queryRunner.query(`ALTER TABLE "payments" ADD "external_reference" character varying(80)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "reconciled_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "reconciled_by_user_id" uuid`);

        // A collection account raised for a specific bill, so the credit that
        // lands on it allocates itself.
        await queryRunner.query(`ALTER TABLE "payment_accounts" ADD "invoice_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_payment_accounts_invoice" ON "payment_accounts" ("invoice_id") `);
        await queryRunner.query(`ALTER TABLE "payment_accounts" ADD CONSTRAINT "FK_payment_accounts_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_accounts" DROP CONSTRAINT "FK_payment_accounts_invoice"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_accounts_invoice"`);
        await queryRunner.query(`ALTER TABLE "payment_accounts" DROP COLUMN "invoice_id"`);

        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "reconciled_by_user_id"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "reconciled_at"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "external_reference"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_verification_code"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "verification_code"`);

        await queryRunner.query(`ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_invoice"`);
        await queryRunner.query(`ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_payment"`);
        await queryRunner.query(`ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_allocations_payment_invoice"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_allocations_invoice"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_allocations_payment"`);
        await queryRunner.query(`DROP TABLE "payment_allocations"`);

        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_invoice_lines_item"`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_invoice_lines_invoice"`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP CONSTRAINT "FK_invoice_lines_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoice_lines_school_category"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoice_lines_invoice"`);
        await queryRunner.query(`DROP TABLE "invoice_lines"`);

        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_carried_forward_to"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_structure"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_class"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_term"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_session"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_student"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_structure_student_term"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_school_no"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_school_due_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_school_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_school_term"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_school_student"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_invoices_school"`);
        await queryRunner.query(`DROP TABLE "invoices"`);

        await queryRunner.query(`ALTER TABLE "fee_structure_lines" DROP CONSTRAINT "FK_fee_structure_lines_item"`);
        await queryRunner.query(`ALTER TABLE "fee_structure_lines" DROP CONSTRAINT "FK_fee_structure_lines_structure"`);
        await queryRunner.query(`ALTER TABLE "fee_structure_lines" DROP CONSTRAINT "FK_fee_structure_lines_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fee_structure_lines_structure_item"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fee_structure_lines_structure"`);
        await queryRunner.query(`DROP TABLE "fee_structure_lines"`);

        await queryRunner.query(`ALTER TABLE "fee_structures" DROP CONSTRAINT "FK_fee_structures_term"`);
        await queryRunner.query(`ALTER TABLE "fee_structures" DROP CONSTRAINT "FK_fee_structures_session"`);
        await queryRunner.query(`ALTER TABLE "fee_structures" DROP CONSTRAINT "FK_fee_structures_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fee_structures_school_term"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fee_structures_school_session"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fee_structures_school"`);
        await queryRunner.query(`DROP TABLE "fee_structures"`);

        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "boarding_status"`);
    }

}
