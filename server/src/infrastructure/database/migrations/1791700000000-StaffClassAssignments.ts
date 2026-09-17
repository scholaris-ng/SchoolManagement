import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Which classes a member of staff is attached to, with no subject required.
 *
 * `teaching_assignments` ties a teacher to a class only together with a
 * subject, and stays that way — result entry, schemes of work and CBT all
 * depend on that triple. But a school assigning a new teacher to a class
 * commonly does that before its subject list exists at all, and picking
 * classes for that teacher used to save nothing in that case: the staff
 * screen's "classes taught" was read entirely from `teaching_assignments`,
 * so a class chosen with no subject to pair it with vanished silently on
 * save. This table is what a class assignment lands in regardless — the
 * staff repository now reads "classes taught" as the union of the two.
 */
export class StaffClassAssignments1791700000000 implements MigrationInterface {
    name = 'StaffClassAssignments1791700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "staff_class_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "class_id" uuid NOT NULL, "staff_id" uuid NOT NULL, CONSTRAINT "PK_staff_class_assignments" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE INDEX "IDX_staff_class_assignments_school" ON "staff_class_assignments" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_staff_class_assignments_class" ON "staff_class_assignments" ("class_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_staff_class_assignments_staff" ON "staff_class_assignments" ("staff_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_staff_class_assignments_school_staff" ON "staff_class_assignments" ("school_id", "staff_id") `);
        // One row per class per teacher — re-saving the same class for the
        // same person corrects nothing, it just is the same fact twice.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_staff_class_assignments_class_staff" ON "staff_class_assignments" ("class_id", "staff_id") `);

        await queryRunner.query(`ALTER TABLE "staff_class_assignments" ADD CONSTRAINT "FK_staff_class_assignments_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_class_assignments" ADD CONSTRAINT "FK_staff_class_assignments_class" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_class_assignments" ADD CONSTRAINT "FK_staff_class_assignments_staff" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "staff_class_assignments" DROP CONSTRAINT "FK_staff_class_assignments_staff"`);
        await queryRunner.query(`ALTER TABLE "staff_class_assignments" DROP CONSTRAINT "FK_staff_class_assignments_class"`);
        await queryRunner.query(`ALTER TABLE "staff_class_assignments" DROP CONSTRAINT "FK_staff_class_assignments_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_staff_class_assignments_class_staff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_staff_class_assignments_school_staff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_staff_class_assignments_staff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_staff_class_assignments_class"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_staff_class_assignments_school"`);
        await queryRunner.query(`DROP TABLE "staff_class_assignments"`);
    }

}
