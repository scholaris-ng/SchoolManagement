import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Every text message the server tries to send, whatever for — see
 * `SmsMessage`. The unique `dedupe_key` is what stops a job that runs twice
 * (a restart, a manual re-run) from texting anyone twice.
 */
export class SmsMessages1792500000000 implements MigrationInterface {
    name = 'SmsMessages1792500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sms_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "purpose" character varying(40) NOT NULL, "recipient_phone" character varying(40) NOT NULL, "recipient_name" character varying(160), "student_id" uuid, "guardian_id" uuid, "body" text NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'QUEUED', "provider" character varying(20), "provider_message_id" character varying(120), "provider_response" jsonb, "error_message" text, "dedupe_key" character varying(160), "sent_at" TIMESTAMP WITH TIME ZONE, "triggered_by_user_id" uuid, CONSTRAINT "UQ_sms_messages_dedupe_key" UNIQUE ("dedupe_key"), CONSTRAINT "PK_sms_messages_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_sms_messages_school_id" ON "sms_messages" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_sms_messages_student_id" ON "sms_messages" ("student_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_sms_messages_school_created" ON "sms_messages" ("school_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_sms_messages_school_purpose_created" ON "sms_messages" ("school_id", "purpose", "created_at") `);
        await queryRunner.query(`ALTER TABLE "sms_messages" ADD CONSTRAINT "FK_sms_messages_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sms_messages" ADD CONSTRAINT "FK_sms_messages_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sms_messages" ADD CONSTRAINT "FK_sms_messages_guardian" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sms_messages" DROP CONSTRAINT "FK_sms_messages_guardian"`);
        await queryRunner.query(`ALTER TABLE "sms_messages" DROP CONSTRAINT "FK_sms_messages_student"`);
        await queryRunner.query(`ALTER TABLE "sms_messages" DROP CONSTRAINT "FK_sms_messages_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sms_messages_school_purpose_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sms_messages_school_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sms_messages_student_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sms_messages_school_id"`);
        await queryRunner.query(`DROP TABLE "sms_messages"`);
    }

}
