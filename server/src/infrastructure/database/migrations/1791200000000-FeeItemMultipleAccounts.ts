import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A fee item can be paid into more than one account — a school that splits
 * tuition between a main account and a capital-development account, say —
 * and a fee structure chooses which of an item's accounts apply to it,
 * rather than an item having exactly one fixed destination.
 *
 * `fee_items.bank_name/account_number/account_name` and the matching columns
 * on `invoice_lines` (added in `1791100000000-FeeItemPaymentAccounts`) held
 * at most one account each and are replaced here: `fee_item_payment_accounts`
 * is the new child table, `fee_structure_lines.account_ids` records which of
 * an item's accounts a given structure selected, and `invoice_lines.accounts`
 * is the equivalent snapshot array taken when a bill is raised. Whatever a
 * school had already filled in under the old single-account columns is
 * carried forward rather than dropped.
 */
export class FeeItemMultipleAccounts1791200000000 implements MigrationInterface {
    name = 'FeeItemMultipleAccounts1791200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "fee_item_payment_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "fee_item_id" uuid NOT NULL, "label" character varying(80), "bank_name" character varying(80) NOT NULL, "account_number" character varying(20) NOT NULL, "account_name" character varying(160) NOT NULL, "sort_order" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_fee_item_payment_accounts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fee_item_payment_accounts_school" ON "fee_item_payment_accounts" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fee_item_payment_accounts_item" ON "fee_item_payment_accounts" ("fee_item_id") `);
        await queryRunner.query(`ALTER TABLE "fee_item_payment_accounts" ADD CONSTRAINT "FK_fee_item_payment_accounts_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fee_item_payment_accounts" ADD CONSTRAINT "FK_fee_item_payment_accounts_item" FOREIGN KEY ("fee_item_id") REFERENCES "fee_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Carry forward whatever a school had already filled in as one item's
        // single account, as that item's first (and so far only) account.
        await queryRunner.query(`
            INSERT INTO "fee_item_payment_accounts"
                ("school_id", "fee_item_id", "bank_name", "account_number", "account_name", "sort_order")
            SELECT "school_id", "id", "bank_name", "account_number", "account_name", 0
              FROM "fee_items"
             WHERE "bank_name" IS NOT NULL AND "account_number" IS NOT NULL AND "account_name" IS NOT NULL
        `);

        await queryRunner.query(`ALTER TABLE "fee_structure_lines" ADD "account_ids" jsonb NOT NULL DEFAULT '[]'`);

        // A structure line billing an item that just gained exactly one
        // migrated account picks it up automatically, so a schedule already
        // printed with "pay into X" keeps saying so after this migration —
        // the join is necessarily one-to-one at this point in the row's
        // history, since the insert above created at most one account per item.
        await queryRunner.query(`
            UPDATE "fee_structure_lines" fsl
               SET "account_ids" = jsonb_build_array(fia."id"::text)
              FROM "fee_item_payment_accounts" fia
             WHERE fia."fee_item_id" = fsl."fee_item_id"
        `);

        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD "accounts" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`
            UPDATE "invoice_lines"
               SET "accounts" = jsonb_build_array(
                     jsonb_build_object(
                       'label', NULL,
                       'bankName', "bank_name",
                       'accountNumber', "account_number",
                       'accountName', "account_name"
                     )
                   )
             WHERE "bank_name" IS NOT NULL AND "account_number" IS NOT NULL AND "account_name" IS NOT NULL
        `);

        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP COLUMN "account_name"`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP COLUMN "account_number"`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP COLUMN "bank_name"`);
        await queryRunner.query(`ALTER TABLE "fee_items" DROP COLUMN "account_name"`);
        await queryRunner.query(`ALTER TABLE "fee_items" DROP COLUMN "account_number"`);
        await queryRunner.query(`ALTER TABLE "fee_items" DROP COLUMN "bank_name"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fee_items" ADD "bank_name" character varying(80)`);
        await queryRunner.query(`ALTER TABLE "fee_items" ADD "account_number" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "fee_items" ADD "account_name" character varying(160)`);
        // Best-effort: takes each item's first account by sort order, if it has one.
        await queryRunner.query(`
            UPDATE "fee_items" fi
               SET "bank_name" = fia."bank_name",
                   "account_number" = fia."account_number",
                   "account_name" = fia."account_name"
              FROM (
                SELECT DISTINCT ON ("fee_item_id") "fee_item_id", "bank_name", "account_number", "account_name"
                  FROM "fee_item_payment_accounts"
                 ORDER BY "fee_item_id", "sort_order"
              ) fia
             WHERE fia."fee_item_id" = fi."id"
        `);

        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD "bank_name" character varying(80)`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD "account_number" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "invoice_lines" ADD "account_name" character varying(160)`);
        // Best-effort: takes the first account in the snapshot array, if any.
        await queryRunner.query(`
            UPDATE "invoice_lines"
               SET "bank_name" = "accounts"->0->>'bankName',
                   "account_number" = "accounts"->0->>'accountNumber',
                   "account_name" = "accounts"->0->>'accountName'
             WHERE jsonb_array_length("accounts") > 0
        `);
        await queryRunner.query(`ALTER TABLE "invoice_lines" DROP COLUMN "accounts"`);

        await queryRunner.query(`ALTER TABLE "fee_structure_lines" DROP COLUMN "account_ids"`);

        await queryRunner.query(`ALTER TABLE "fee_item_payment_accounts" DROP CONSTRAINT "FK_fee_item_payment_accounts_item"`);
        await queryRunner.query(`ALTER TABLE "fee_item_payment_accounts" DROP CONSTRAINT "FK_fee_item_payment_accounts_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fee_item_payment_accounts_item"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fee_item_payment_accounts_school"`);
        await queryRunner.query(`DROP TABLE "fee_item_payment_accounts"`);
    }

}
