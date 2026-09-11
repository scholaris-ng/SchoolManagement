import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The attendance register (spec section 11).
 *
 * One row per child per day, written only when somebody has actually taken the
 * register — see `AttendanceRecord` for why an unmarked pupil deliberately has
 * no row. This is the table the attendance screen, the admin dashboard's rate
 * for today and the class attendance summary all read; each of those three
 * answered a flat zero for as long as it did not exist.
 *
 * Index names are spelled out rather than left to TypeORM's hashes (as
 * `SearchTrigramIndexes` already does) and repeated in the entity's `@Index`
 * decorators, so `migration:generate` sees the schema it expects and does not
 * offer to rename them.
 */
export class Attendance1789400000000 implements MigrationInterface {
    name = 'Attendance1789400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "attendance_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "class_id" uuid NOT NULL, "term_id" uuid NOT NULL, "date" date NOT NULL, "status" character varying(16) NOT NULL, "reason" character varying(16), "note" text, "marked_by_user_id" uuid, "marked_by_name" character varying(160), "marked_at" TIMESTAMP WITH TIME ZONE NOT NULL, "guardian_notified_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_attendance_records" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE INDEX "IDX_attendance_records_school" ON "attendance_records" ("school_id") `);
        // The register: one class on one date.
        await queryRunner.query(`CREATE INDEX "IDX_attendance_records_school_class_date" ON "attendance_records" ("school_id", "class_id", "date") `);
        // Today's school-wide rate, and the trend over a window of days.
        await queryRunner.query(`CREATE INDEX "IDX_attendance_records_school_date" ON "attendance_records" ("school_id", "date") `);
        // One mark per child per day, whichever class it was taken in. Also the
        // conflict target the register's upsert writes against, so a second save
        // of the same day corrects the marks instead of duplicating them.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_attendance_records_student_date" ON "attendance_records" ("student_id", "date") `);

        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_attendance_records_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_attendance_records_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // RESTRICT, not CASCADE: deleting a class must not silently erase the
        // registers taken for it. `removeClass` already refuses a class that
        // still has pupils in it.
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_attendance_records_class" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_attendance_records_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        // The teacher's account may be closed long before the register stops
        // mattering, so the mark keeps `marked_by_name` and loses only the link.
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_attendance_records_marked_by" FOREIGN KEY ("marked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_attendance_records_marked_by"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_attendance_records_term"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_attendance_records_class"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_attendance_records_student"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_attendance_records_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_attendance_records_student_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_attendance_records_school_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_attendance_records_school_class_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_attendance_records_school"`);
        await queryRunner.query(`DROP TABLE "attendance_records"`);
    }

}
