import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Discounts granted to a named student, and the record on each invoice of
 * which of them it carries. See `StudentDiscount` and `Invoice.appliedDiscounts`.
 */
export class StudentDiscounts1792400000000 implements MigrationInterface {
    name = 'StudentDiscounts1792400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "student_discounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "discount_id" uuid NOT NULL, "session_id" uuid, "term_id" uuid, "note" text, "granted_by_user_id" uuid, "is_active" boolean NOT NULL DEFAULT true, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_by_user_id" uuid, CONSTRAINT "PK_d9791052660736e702c448d15cc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6af64824ca55a48f5508a52424" ON "student_discounts" ("school_id", "student_id", "is_active") `);
        await queryRunner.query(`CREATE INDEX "IDX_c0f7c2f875a169d40b2bcfaddb" ON "student_discounts" ("discount_id") `);
        await queryRunner.query(`ALTER TABLE "student_discounts" ADD CONSTRAINT "FK_6f7233650f0231b0d2844b9bb17" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_discounts" ADD CONSTRAINT "FK_55cb3baeb2f1cfea0bacc7cb4f1" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_discounts" ADD CONSTRAINT "FK_c0f7c2f875a169d40b2bcfaddb8" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_discounts" ADD CONSTRAINT "FK_a28ed078785faeddc1a847a222e" FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_discounts" ADD CONSTRAINT "FK_b19f791263912c7bb549dbe1897" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "applied_discounts" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "applied_discounts"`);
        await queryRunner.query(`ALTER TABLE "student_discounts" DROP CONSTRAINT "FK_b19f791263912c7bb549dbe1897"`);
        await queryRunner.query(`ALTER TABLE "student_discounts" DROP CONSTRAINT "FK_a28ed078785faeddc1a847a222e"`);
        await queryRunner.query(`ALTER TABLE "student_discounts" DROP CONSTRAINT "FK_c0f7c2f875a169d40b2bcfaddb8"`);
        await queryRunner.query(`ALTER TABLE "student_discounts" DROP CONSTRAINT "FK_55cb3baeb2f1cfea0bacc7cb4f1"`);
        await queryRunner.query(`ALTER TABLE "student_discounts" DROP CONSTRAINT "FK_6f7233650f0231b0d2844b9bb17"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c0f7c2f875a169d40b2bcfaddb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6af64824ca55a48f5508a52424"`);
        await queryRunner.query(`DROP TABLE "student_discounts"`);
    }

}
