import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The first half of the ledger: money that arrived (spec section 27).
 *
 * `payment_accounts` are the bank account numbers a provider issues for a
 * family to transfer into — one per bill, tied to a student. `payments` are
 * the credits that landed. Both exist before invoices do, deliberately: a
 * school can start collecting fees through Raven today, and attributing each
 * credit to a named student is what makes the invoice that follows
 * reconcilable rather than a fresh guess.
 *
 * Index names are spelled out rather than left to TypeORM's hashes, and
 * repeated in the entities' `@Index` decorators, so `migration:generate` sees
 * the schema it expects and does not offer to rename them.
 */
export class Payments1790000000000 implements MigrationInterface {
    name = 'Payments1790000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "provider" character varying(20) NOT NULL, "account_number" character varying(20) NOT NULL, "account_name" character varying(160) NOT NULL, "bank_name" character varying(80) NOT NULL, "amount" numeric(12,2) NOT NULL, "is_permanent" boolean NOT NULL DEFAULT false, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "note" text, "created_by_user_id" uuid, "provider_payload" jsonb, CONSTRAINT "PK_payment_accounts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_payment_accounts_school" ON "payment_accounts" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payment_accounts_school_student" ON "payment_accounts" ("school_id", "student_id") `);
        // A credit is matched to a student by nothing but the account number
        // Raven reports it against, so two rows must never share one.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_payment_accounts_provider_number" ON "payment_accounts" ("provider", "account_number") `);
        await queryRunner.query(`ALTER TABLE "payment_accounts" ADD CONSTRAINT "FK_payment_accounts_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_accounts" ADD CONSTRAINT "FK_payment_accounts_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid, "payment_account_id" uuid, "reference" character varying(40) NOT NULL, "provider" character varying(20) NOT NULL, "provider_reference" character varying(80), "method" character varying(20) NOT NULL, "amount" numeric(12,2) NOT NULL, "fee" numeric(12,2) NOT NULL DEFAULT 0, "currency" character varying(3) NOT NULL DEFAULT 'NGN', "status" character varying(16) NOT NULL DEFAULT 'SUCCESSFUL', "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL, "payer_name" character varying(160), "is_reconciled" boolean NOT NULL DEFAULT false, "note" text, "recorded_by_user_id" uuid, "provider_payload" jsonb, CONSTRAINT "PK_payments" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_payments_school" ON "payments" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payments_school_student" ON "payments" ("school_id", "student_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payments_school_paid_at" ON "payments" ("school_id", "paid_at") `);
        // The provider's own id for a credit. Unique, so a webhook delivered
        // twice — which Raven's "refire notification" makes routine — writes
        // one payment, not two.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_payments_provider_reference" ON "payments" ("provider", "provider_reference") `);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // A deleted student loses the pointer, not the payment: the money
        // still arrived, and the ledger still has to add up to the bank.
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_account" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_account"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_student"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_provider_reference"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_school_paid_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_school_student"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_school"`);
        await queryRunner.query(`DROP TABLE "payments"`);

        await queryRunner.query(`ALTER TABLE "payment_accounts" DROP CONSTRAINT "FK_payment_accounts_student"`);
        await queryRunner.query(`ALTER TABLE "payment_accounts" DROP CONSTRAINT "FK_payment_accounts_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_accounts_provider_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_accounts_school_student"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_accounts_school"`);
        await queryRunner.query(`DROP TABLE "payment_accounts"`);
    }

}
