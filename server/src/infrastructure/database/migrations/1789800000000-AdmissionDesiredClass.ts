import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The class an applicant is actually applying into — "Primary 1", "SS 1" —
 * alongside the level they already roll up under.
 *
 * `admission_applications.level_id` names a rung on the school's ladder, and
 * for a school whose levels are themselves specific grades that was enough.
 * It is not enough for a school whose levels are broad stages (Nursery,
 * Junior, Senior) and whose specific grades live in `school_classes` instead
 * — the public form had nothing finer than "Junior" to offer, which is not
 * what a parent came to choose. `desired_class_id` is additive and nullable
 * rather than a replacement: existing applications named only a level, and
 * `level_id` stays exactly as useful as it always was for the admissions
 * list and the funnel's grouping.
 */
export class AdmissionDesiredClass1789800000000 implements MigrationInterface {
    name = 'AdmissionDesiredClass1789800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD "desired_class_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_admission_applications_school_desired_class" ON "admission_applications" ("school_id", "desired_class_id") `);
        // A class that is later dissolved loses the application's pointer to
        // it, not the application — the same choice already made for
        // `offered_class_id`.
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD CONSTRAINT "FK_admission_applications_desired_class" FOREIGN KEY ("desired_class_id") REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP CONSTRAINT "FK_admission_applications_desired_class"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_applications_school_desired_class"`);
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP COLUMN "desired_class_id"`);
    }

}
