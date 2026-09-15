import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Payment accounts, centralised.
 *
 * Before this, a fee item owned its own private copies of the bank details
 * families paid it into (`fee_item_payment_accounts`), and a custom bill
 * embedded its own copy again (`custom_bills.accounts`). A school with the
 * same account attached to several fee items had to re-type it on each one,
 * and edit it in each place separately when it changed — exactly the
 * scattered-edit problem this migration exists to close.
 *
 * `payment_destinations` is the one place an account now lives. A fee item
 * points at the ones it accepts (`fee_items.payment_destination_ids`); a fee
 * structure line narrows that further, never widens it
 * (`fee_structure_lines.account_ids`, unchanged in shape — it already held
 * ids, just against the old per-item table); a custom bill points at its own
 * chosen set (`custom_bills.payment_destination_ids`). An invoice line still
 * copies the details it was billed under, because that has to survive an
 * account being edited or deleted later — nothing about that snapshot
 * changes here.
 *
 * Existing per-item accounts are copied across as-is, one row each, with
 * their ids preserved — so `fee_structure_lines.account_ids`, which already
 * pointed at those ids, keeps resolving correctly with no rewrite needed.
 * This does not merge rows that happen to describe the same real account
 * under two different fee items — a school that had "Access · 1931256885"
 * on two different fee items keeps two rows here too. There is no database
 * constraint added to prevent that (see `PaymentDestination`): the data
 * being copied already contains exactly that kind of duplicate, so a unique
 * index here would fail the migration outright. The new central screen is
 * what makes the duplication visible for the first time; a bursar can merge
 * such rows by hand, and the service refuses a genuinely *new* duplicate
 * from this point on.
 */
export class PaymentDestinations1791500000000 implements MigrationInterface {
    name = 'PaymentDestinations1791500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment_destinations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "label" character varying(80), "bank_name" character varying(80) NOT NULL, "account_number" character varying(20) NOT NULL, "account_name" character varying(160) NOT NULL, "sort_order" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_payment_destinations" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_payment_destinations_school" ON "payment_destinations" ("school_id") `);
        await queryRunner.query(`ALTER TABLE "payment_destinations" ADD CONSTRAINT "FK_payment_destinations_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Carry every existing per-item account across, ids preserved, before
        // the unique index goes on — so a school that already had the same
        // account typed twice keeps both rows (visible and mergeable in the
        // new screen) rather than the migration itself failing on them.
        await queryRunner.query(`
            INSERT INTO "payment_destinations" ("id", "created_at", "updated_at", "school_id", "label", "bank_name", "account_number", "account_name", "sort_order")
            SELECT "id", "created_at", "updated_at", "school_id", "label", "bank_name", "account_number", "account_name", "sort_order"
              FROM "fee_item_payment_accounts"
        `);

        await queryRunner.query(`ALTER TABLE "fee_items" ADD "payment_destination_ids" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`
            UPDATE "fee_items" fi
               SET "payment_destination_ids" = agg.ids
              FROM (
                SELECT "fee_item_id", to_jsonb(array_agg("id")) AS ids
                  FROM "fee_item_payment_accounts"
                 GROUP BY "fee_item_id"
              ) agg
             WHERE agg."fee_item_id" = fi."id"
        `);

        // `fee_structure_lines.account_ids` already holds ids from the old
        // table; those ids are unchanged in the new one, so nothing here
        // needs to be rewritten — only the table they resolve against moves.

        await queryRunner.query(`ALTER TABLE "fee_item_payment_accounts" DROP CONSTRAINT "FK_fee_item_payment_accounts_item"`);
        await queryRunner.query(`ALTER TABLE "fee_item_payment_accounts" DROP CONSTRAINT "FK_fee_item_payment_accounts_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fee_item_payment_accounts_item"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fee_item_payment_accounts_school"`);
        await queryRunner.query(`DROP TABLE "fee_item_payment_accounts"`);

        // A custom bill's embedded accounts have no id of their own to
        // preserve, so each distinct one becomes a fresh central row —
        // matched against an identical one from a fee item first, so a bill
        // typed against the same account a fee item already uses does not
        // duplicate it.
        await queryRunner.query(`
            INSERT INTO "payment_destinations" ("school_id", "label", "bank_name", "account_number", "account_name")
            SELECT DISTINCT ON (cb."school_id", acc->>'bankName', acc->>'accountNumber')
                   cb."school_id", acc->>'label', acc->>'bankName', acc->>'accountNumber', acc->>'accountName'
              FROM "custom_bills" cb
              CROSS JOIN LATERAL jsonb_array_elements(cb."accounts") AS acc
             WHERE NOT EXISTS (
                     SELECT 1 FROM "payment_destinations" pd
                      WHERE pd."school_id" = cb."school_id"
                        AND pd."bank_name" = acc->>'bankName'
                        AND pd."account_number" = acc->>'accountNumber'
                   )
             ORDER BY cb."school_id", acc->>'bankName', acc->>'accountNumber'
        `);

        await queryRunner.query(`ALTER TABLE "custom_bills" ADD "payment_destination_ids" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`
            UPDATE "custom_bills" cb
               SET "payment_destination_ids" = agg.ids
              FROM (
                SELECT cb2."id" AS bill_id, to_jsonb(array_agg(DISTINCT pd."id")) AS ids
                  FROM "custom_bills" cb2
                  CROSS JOIN LATERAL jsonb_array_elements(cb2."accounts") AS acc
                  JOIN "payment_destinations" pd
                    ON pd."school_id" = cb2."school_id"
                   AND pd."bank_name" = acc->>'bankName'
                   AND pd."account_number" = acc->>'accountNumber'
                 GROUP BY cb2."id"
              ) agg
             WHERE agg.bill_id = cb."id"
        `);
        await queryRunner.query(`ALTER TABLE "custom_bills" DROP COLUMN "accounts"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_bills" ADD "accounts" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`
            UPDATE "custom_bills" cb
               SET "accounts" = COALESCE(agg.accounts, '[]'::jsonb)
              FROM (
                SELECT cb2."id" AS bill_id,
                       jsonb_agg(
                         jsonb_build_object(
                           'label', pd."label",
                           'bankName', pd."bank_name",
                           'accountNumber', pd."account_number",
                           'accountName', pd."account_name"
                         )
                       ) AS accounts
                  FROM "custom_bills" cb2
                  CROSS JOIN LATERAL jsonb_array_elements_text(cb2."payment_destination_ids") AS destination_id
                  JOIN "payment_destinations" pd ON pd."id" = destination_id::uuid
                 GROUP BY cb2."id"
              ) agg
             WHERE agg.bill_id = cb."id"
        `);
        await queryRunner.query(`ALTER TABLE "custom_bills" DROP COLUMN "payment_destination_ids"`);

        await queryRunner.query(`CREATE TABLE "fee_item_payment_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "fee_item_id" uuid NOT NULL, "label" character varying(80), "bank_name" character varying(80) NOT NULL, "account_number" character varying(20) NOT NULL, "account_name" character varying(160) NOT NULL, "sort_order" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_fee_item_payment_accounts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fee_item_payment_accounts_school" ON "fee_item_payment_accounts" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fee_item_payment_accounts_item" ON "fee_item_payment_accounts" ("fee_item_id") `);
        await queryRunner.query(`ALTER TABLE "fee_item_payment_accounts" ADD CONSTRAINT "FK_fee_item_payment_accounts_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fee_item_payment_accounts" ADD CONSTRAINT "FK_fee_item_payment_accounts_item" FOREIGN KEY ("fee_item_id") REFERENCES "fee_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Best-effort: a fresh row per (item, destination) pair, so a
        // destination shared by several items reappears once for each,
        // matching the shape the table used to have. Ids are not the
        // originals — nothing downstream still needs them to be.
        await queryRunner.query(`
            INSERT INTO "fee_item_payment_accounts" ("school_id", "fee_item_id", "label", "bank_name", "account_number", "account_name")
            SELECT fi."school_id", fi."id", pd."label", pd."bank_name", pd."account_number", pd."account_name"
              FROM "fee_items" fi
              CROSS JOIN LATERAL jsonb_array_elements_text(fi."payment_destination_ids") AS destination_id
              JOIN "payment_destinations" pd ON pd."id" = destination_id::uuid
        `);
        await queryRunner.query(`ALTER TABLE "fee_items" DROP COLUMN "payment_destination_ids"`);

        await queryRunner.query(`ALTER TABLE "payment_destinations" DROP CONSTRAINT "FK_payment_destinations_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_destinations_school"`);
        await queryRunner.query(`DROP TABLE "payment_destinations"`);
    }

}
