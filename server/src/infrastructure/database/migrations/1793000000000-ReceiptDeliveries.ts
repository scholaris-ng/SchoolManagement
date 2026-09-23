import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A record of every copy of a receipt that left the office — printed, emailed
 * or sent on WhatsApp.
 *
 * Deliberately not part of `payments`: a payment happens once, but the receipt
 * for it goes out as many times as a family asks for it, and each of those
 * sendings has its own channel, recipient, sender and moment. The audit trail
 * already carries `receipt.emailed`, but audit is a security log nobody works
 * from — a bursar asked "did Mrs Chizea ever get her receipt?" needs the
 * answer on the receipt itself, so this is ordinary domain data.
 *
 * `status` is the honest part. Only email is actually sent by this system, so
 * only email starts out `CONFIRMED`. A print goes to a printer this server
 * knows nothing about, and a WhatsApp message is typed into WhatsApp by a
 * person who may never press Send — both start `PREPARED`, and stay that way
 * until somebody in the office says the family has it.
 */
export class ReceiptDeliveries1793000000000 implements MigrationInterface {
    name = 'ReceiptDeliveries1793000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "receipt_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "payment_id" uuid NOT NULL, "channel" character varying(16) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PREPARED', "recipient_name" character varying(160), "recipient_contact" character varying(160), "guardian_id" uuid, "include_charges" boolean NOT NULL DEFAULT false, "note" text, "failure_reason" text, "sent_by_user_id" uuid, "sent_by_name" character varying(160) NOT NULL, "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "confirmed_by_user_id" uuid, "confirmed_by_name" character varying(160), "confirmed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_receipt_deliveries" PRIMARY KEY ("id"))`);
        // The receipt's own log, newest first — the one read that runs on every
        // receipt page, and the aggregate the payments list joins against.
        await queryRunner.query(`CREATE INDEX "IDX_receipt_deliveries_payment" ON "receipt_deliveries" ("payment_id", "sent_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_receipt_deliveries_school_sent" ON "receipt_deliveries" ("school_id", "sent_at") `);
        await queryRunner.query(`ALTER TABLE "receipt_deliveries" ADD CONSTRAINT "FK_receipt_deliveries_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // CASCADE: without the payment there is no receipt, so a log of copies
        // of it has nothing left to describe.
        await queryRunner.query(`ALTER TABLE "receipt_deliveries" ADD CONSTRAINT "FK_receipt_deliveries_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // SET NULL: a guardian removed from the school later must not erase the
        // fact that a receipt was sent to them — `recipient_name` and
        // `recipient_contact` are captured at send time and carry the record on
        // their own.
        await queryRunner.query(`ALTER TABLE "receipt_deliveries" ADD CONSTRAINT "FK_receipt_deliveries_guardian" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "receipt_deliveries" DROP CONSTRAINT "FK_receipt_deliveries_guardian"`);
        await queryRunner.query(`ALTER TABLE "receipt_deliveries" DROP CONSTRAINT "FK_receipt_deliveries_payment"`);
        await queryRunner.query(`ALTER TABLE "receipt_deliveries" DROP CONSTRAINT "FK_receipt_deliveries_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_receipt_deliveries_school_sent"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_receipt_deliveries_payment"`);
        await queryRunner.query(`DROP TABLE "receipt_deliveries"`);
    }

}
