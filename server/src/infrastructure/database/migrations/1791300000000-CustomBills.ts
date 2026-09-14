import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A one-off bill for whoever a school needs to invoice outside its own
 * enrolled students — a contractor, a visitor, a single charge before
 * admission is final. Deliberately outside the real ledger: no student,
 * so nothing here touches a balance, the debtors list, or a payment
 * allocation. See `CustomBill` for the fuller reasoning.
 */
export class CustomBills1791300000000 implements MigrationInterface {
    name = 'CustomBills1791300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "custom_bills" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "payer_name" character varying(200) NOT NULL, "lines" jsonb NOT NULL, "total" numeric(12,2) NOT NULL, "note" text, "created_by_user_id" uuid, CONSTRAINT "PK_custom_bills" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_custom_bills_school" ON "custom_bills" ("school_id") `);
        await queryRunner.query(`ALTER TABLE "custom_bills" ADD CONSTRAINT "FK_custom_bills_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_bills" DROP CONSTRAINT "FK_custom_bills_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_custom_bills_school"`);
        await queryRunner.query(`DROP TABLE "custom_bills"`);
    }

}
