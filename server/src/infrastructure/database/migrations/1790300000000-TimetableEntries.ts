import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The timetable grid (spec section 16).
 *
 * One row per lesson: a class, a subject, a teacher and optionally a room, in
 * one period on one weekday of one term. Until now the timetable screen drew
 * the school's real periods with nothing scheduled into them and every save
 * was unrouted; this is the table those saves land in.
 *
 * The three unique indexes are the clash rules. A class, a teacher and a room
 * can each be in only one place per period, and the database enforces that so
 * two people building the grid at once cannot both succeed. The room rule is
 * partial: a lesson with no room assigned clashes with nothing on that axis.
 *
 * Index and constraint names are spelled out, as `Attendance` does, so the
 * entity's decorators and `migration:generate` agree on them.
 */
export class TimetableEntries1790300000000 implements MigrationInterface {
    name = 'TimetableEntries1790300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "timetable_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "term_id" uuid NOT NULL, "class_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "teacher_id" uuid NOT NULL, "room_id" uuid, "period_id" uuid NOT NULL, "day" character varying(10) NOT NULL, CONSTRAINT "PK_timetable_entries" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE INDEX "IDX_timetable_entries_school" ON "timetable_entries" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_timetable_entries_term" ON "timetable_entries" ("term_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_timetable_entries_class_slot" ON "timetable_entries" ("term_id", "class_id", "day", "period_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_timetable_entries_teacher_slot" ON "timetable_entries" ("term_id", "teacher_id", "day", "period_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_timetable_entries_room_slot" ON "timetable_entries" ("term_id", "room_id", "day", "period_id") WHERE "room_id" IS NOT NULL`);

        await queryRunner.query(`ALTER TABLE "timetable_entries" ADD CONSTRAINT "FK_timetable_entries_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" ADD CONSTRAINT "FK_timetable_entries_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" ADD CONSTRAINT "FK_timetable_entries_class" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" ADD CONSTRAINT "FK_timetable_entries_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" ADD CONSTRAINT "FK_timetable_entries_teacher" FOREIGN KEY ("teacher_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" ADD CONSTRAINT "FK_timetable_entries_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" ADD CONSTRAINT "FK_timetable_entries_period" FOREIGN KEY ("period_id") REFERENCES "timetable_periods"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "timetable_entries" DROP CONSTRAINT "FK_timetable_entries_period"`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" DROP CONSTRAINT "FK_timetable_entries_room"`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" DROP CONSTRAINT "FK_timetable_entries_teacher"`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" DROP CONSTRAINT "FK_timetable_entries_subject"`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" DROP CONSTRAINT "FK_timetable_entries_class"`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" DROP CONSTRAINT "FK_timetable_entries_term"`);
        await queryRunner.query(`ALTER TABLE "timetable_entries" DROP CONSTRAINT "FK_timetable_entries_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_timetable_entries_room_slot"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_timetable_entries_teacher_slot"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_timetable_entries_class_slot"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_timetable_entries_term"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_timetable_entries_school"`);
        await queryRunner.query(`DROP TABLE "timetable_entries"`);
    }

}
