import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Prepaid SMS credit per school. `schools.sms_credits` is the balance the send
 * path checks; `sms_credit_entries` is every movement of it — a top-up by a
 * platform administrator, a debit per message page, a refund when the gateway
 * refused — so a balance can always be explained. See `SmsCreditEntry`.
 */
export class SmsCredits1792600000000 implements MigrationInterface {
    name = 'SmsCredits1792600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "schools" ADD "sms_credits" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`CREATE TABLE "sms_credit_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "type" character varying(12) NOT NULL, "units" integer NOT NULL, "balance_after" integer NOT NULL, "note" text, "sms_message_id" uuid, "actor_user_id" uuid, "actor_name" character varying(160), CONSTRAINT "PK_sms_credit_entries_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_sms_credit_entries_school_created" ON "sms_credit_entries" ("school_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "sms_credit_entries" ADD CONSTRAINT "FK_sms_credit_entries_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sms_credit_entries" ADD CONSTRAINT "FK_sms_credit_entries_message" FOREIGN KEY ("sms_message_id") REFERENCES "sms_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sms_credit_entries" DROP CONSTRAINT "FK_sms_credit_entries_message"`);
        await queryRunner.query(`ALTER TABLE "sms_credit_entries" DROP CONSTRAINT "FK_sms_credit_entries_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sms_credit_entries_school_created"`);
        await queryRunner.query(`DROP TABLE "sms_credit_entries"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "sms_credits"`);
    }

}
