import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * City and state on an applicant's home address.
 *
 * `admission_applications.address` was, and stays, one free-text field for the
 * street line — but a school reads a family's location structured far more
 * often than it reads the street: which state a bus route should cover, which
 * families share a city for a car pool list. Contacts already carry the same
 * two fields inside their `jsonb` blob and needed no migration; the applicant's
 * own address lives in real columns, so it does.
 */
export class AdmissionApplicantCityState1789700000000 implements MigrationInterface {
    name = 'AdmissionApplicantCityState1789700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD "city" character varying(60)`);
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD "state" character varying(60)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP COLUMN "state"`);
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP COLUMN "city"`);
    }

}
