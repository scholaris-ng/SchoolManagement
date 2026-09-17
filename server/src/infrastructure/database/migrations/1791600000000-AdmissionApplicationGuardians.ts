import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Lets an office application be created with nobody on it yet, and an
 * existing `Guardian` record attached afterwards — typically a family the
 * school already knows, such as a sibling already on roll.
 *
 * A join table, the same shape as `student_guardians`, rather than a column
 * on `admission_applications`: an application may end up with more than one
 * linked guardian (both parents, say), and the qualities of the attachment
 * (which one is primary) belong to the pairing, not to either side.
 *
 * This is deliberately separate from the `contacts` jsonb column. `contacts`
 * holds whatever a walk-in or a web visitor typed, unverified, and is only
 * ever promoted into real rows at `AdmissionsService.convert`. A row here
 * points at a `Guardian` the school already has, so linking one grants
 * nothing by itself — no portal access, no billing — but does carry a real,
 * already-verified person onto the application before that point.
 */
export class AdmissionApplicationGuardians1791600000000 implements MigrationInterface {
    name = 'AdmissionApplicationGuardians1791600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "admission_application_guardians" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "application_id" uuid NOT NULL, "guardian_id" uuid NOT NULL, "relationship" character varying(16) NOT NULL DEFAULT 'GUARDIAN', "is_primary_contact" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_admission_application_guardians" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE INDEX "IDX_admission_application_guardians_school" ON "admission_application_guardians" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_admission_application_guardians_application" ON "admission_application_guardians" ("application_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_admission_application_guardians_guardian" ON "admission_application_guardians" ("guardian_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_admission_application_guardians_school_application" ON "admission_application_guardians" ("school_id", "application_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_admission_application_guardians_school_guardian" ON "admission_application_guardians" ("school_id", "guardian_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_admission_application_guardians_application_guardian" ON "admission_application_guardians" ("application_id", "guardian_id") `);

        await queryRunner.query(`ALTER TABLE "admission_application_guardians" ADD CONSTRAINT "FK_admission_application_guardians_application" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "admission_application_guardians" ADD CONSTRAINT "FK_admission_application_guardians_guardian" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admission_application_guardians" DROP CONSTRAINT "FK_admission_application_guardians_guardian"`);
        await queryRunner.query(`ALTER TABLE "admission_application_guardians" DROP CONSTRAINT "FK_admission_application_guardians_application"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_application_guardians_application_guardian"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_application_guardians_school_guardian"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_application_guardians_school_application"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_application_guardians_guardian"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_application_guardians_application"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_application_guardians_school"`);
        await queryRunner.query(`DROP TABLE "admission_application_guardians"`);
    }

}
