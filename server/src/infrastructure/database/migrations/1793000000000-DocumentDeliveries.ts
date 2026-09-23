import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A record of every finance document that left the office — a receipt, an
 * invoice, a custom bill or a fee schedule — printed, emailed or sent on
 * WhatsApp (spec sections 25–27).
 *
 * The audit trail already records the *act* of sending, for security. This
 * records the *delivery*, as ordinary domain data, because the two questions are
 * not the same one: audit answers "who did what" across two hundred kinds of
 * action, while a bursar with a parent on the phone needs "has this family been
 * sent their receipt, by whom, and did it get there?" — on one screen, filtered
 * by channel and by whether anybody has confirmed it.
 *
 * Which shape of paper a print produced is added a migration later, by
 * `DocumentDeliveryPrintFormat1793100000000`.
 *
 * `document_id` carries no foreign key, and that is deliberate. It points at one
 * of four tables, and more to the point a delivery is a thing that *happened*:
 * it has to stay readable after the invoice behind it is cancelled, reissued or
 * hard-deleted, exactly as `payment_receipts.submitted_by_name` stays readable
 * after the parent's account is gone. `document_label` and `student_name` are
 * captured at send time for the same reason, so a row in this register never
 * depends on four joins — or on the document still existing — to make sense.
 */
export class DocumentDeliveries1793000000000 implements MigrationInterface {
    name = 'DocumentDeliveries1793000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "document_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "document_type" character varying(16) NOT NULL, "document_id" uuid NOT NULL, "document_label" character varying(80) NOT NULL, "student_id" uuid, "student_name" character varying(160), "channel" character varying(16) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PREPARED', "recipient_name" character varying(160), "recipient_contact" character varying(160), "guardian_id" uuid, "include_charges" boolean NOT NULL DEFAULT false, "note" text, "failure_reason" text, "sent_by_user_id" uuid, "sent_by_name" character varying(160) NOT NULL, "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "confirmed_by_user_id" uuid, "confirmed_by_name" character varying(160), "confirmed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_document_deliveries" PRIMARY KEY ("id"))`);
        // One document's own log, and the aggregate a list of documents joins
        // against to mark the ones that never went out.
        await queryRunner.query(`CREATE INDEX "IDX_document_deliveries_document" ON "document_deliveries" ("document_type", "document_id", "sent_at") `);
        // The register itself: a school's copies, newest first.
        await queryRunner.query(`CREATE INDEX "IDX_document_deliveries_school_sent" ON "document_deliveries" ("school_id", "sent_at") `);
        // "What is still unconfirmed?" — the one filter the office works from daily.
        await queryRunner.query(`CREATE INDEX "IDX_document_deliveries_school_status" ON "document_deliveries" ("school_id", "status") `);
        await queryRunner.query(`ALTER TABLE "document_deliveries" ADD CONSTRAINT "FK_document_deliveries_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // SET NULL on both: a student who leaves, or a guardian removed from the
        // school, must not erase the fact that a document was sent to them.
        // `student_name` and `recipient_name` are captured at send time and carry
        // the record on their own.
        await queryRunner.query(`ALTER TABLE "document_deliveries" ADD CONSTRAINT "FK_document_deliveries_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_deliveries" ADD CONSTRAINT "FK_document_deliveries_guardian" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_deliveries" DROP CONSTRAINT "FK_document_deliveries_guardian"`);
        await queryRunner.query(`ALTER TABLE "document_deliveries" DROP CONSTRAINT "FK_document_deliveries_student"`);
        await queryRunner.query(`ALTER TABLE "document_deliveries" DROP CONSTRAINT "FK_document_deliveries_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_deliveries_school_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_deliveries_school_sent"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_deliveries_document"`);
        await queryRunner.query(`DROP TABLE "document_deliveries"`);
    }

}
