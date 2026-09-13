import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Backs auto-generated admission numbers (`SCH/2026/0142`): the counter
 * behind the number, so the next one is `MAX + 1` per school, taken under an
 * advisory lock the same way `admission_applications.sequence` and
 * `invoices.sequence` already are.
 *
 * Nullable, unlike those two: every existing student was admitted with a
 * hand-typed number and never took a turn in this counter, and a student
 * created outside the enrolment flow (the student form, an import) still
 * won't. `MAX()` ignores the nulls, so the counter is exactly "how many
 * students this flow has numbered so far" regardless of how many rows have
 * none.
 */
export class StudentAdmissionSequence1790200000000 implements MigrationInterface {
    name = 'StudentAdmissionSequence1790200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "students" ADD "sequence" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_students_school_sequence" ON "students" ("school_id", "sequence") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_students_school_sequence"`);
        await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "sequence"`);
    }

}
