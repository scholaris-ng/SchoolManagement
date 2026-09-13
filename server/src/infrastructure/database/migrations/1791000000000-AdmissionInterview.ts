import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A venue (room, or a video-call link) and a pass/fail outcome for the
 * interview `interview_date` already schedules — that column existed but
 * nothing ever set it, and there was nowhere to say where it happens or how
 * it went.
 */
export class AdmissionInterview1791000000000 implements MigrationInterface {
    name = 'AdmissionInterview1791000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD "interview_venue" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD "interview_outcome" character varying(16)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP COLUMN "interview_outcome"`);
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP COLUMN "interview_venue"`);
    }

}
