import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Admissions (spec section 10).
 *
 * Two tables: the application itself, and the append-only trail of what the
 * school decided about it. Until now the admissions screens read a stub that
 * answered an empty list, and the "New application" form posted to a route
 * that did not exist.
 *
 * The people attached to an application are a `jsonb` column rather than rows
 * in `guardians`, which is a deliberate boundary and not a shortcut. The
 * public website writes to this table without a session; a guardian record
 * carries portal access, a place in the parent directory and a fee liability,
 * so it may not be created by an unverified visitor. The promotion happens in
 * `AdmissionsService.convert`, once the child has a place.
 *
 * Index names are spelled out rather than left to TypeORM's hashes, and
 * repeated in the entities' `@Index` decorators, so `migration:generate` sees
 * the schema it expects and does not offer to rename them.
 */
export class Admissions1789600000000 implements MigrationInterface {
    name = 'Admissions1789600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "admission_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "school_id" uuid NOT NULL, "application_no" character varying(40) NOT NULL, "sequence" integer NOT NULL, "session_id" uuid NOT NULL, "level_id" uuid NOT NULL, "applicant_type" character varying(16) NOT NULL DEFAULT 'GUARDIAN', "source" character varying(16) NOT NULL DEFAULT 'OFFICE', "first_name" character varying(60) NOT NULL, "middle_name" character varying(60), "last_name" character varying(60) NOT NULL, "gender" character varying(10) NOT NULL, "date_of_birth" date NOT NULL, "photo_url" character varying(500), "nationality" character varying(60), "state_of_origin" character varying(60), "address" text, "previous_school" character varying(160), "previous_class" character varying(80), "blood_group" character varying(8), "medical_notes" text, "applicant_email" character varying(160), "applicant_phone" character varying(20), "contacts" jsonb NOT NULL DEFAULT '[]', "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "screening_score" numeric(5,2), "interview_date" TIMESTAMP WITH TIME ZONE, "interview_note" text, "decision_note" text, "offered_class_id" uuid, "offer_expires_on" date, "submitted_at" TIMESTAMP WITH TIME ZONE, "decided_at" TIMESTAMP WITH TIME ZONE, "accepted_at" TIMESTAMP WITH TIME ZONE, "converted_student_id" uuid, "version" integer NOT NULL, CONSTRAINT "PK_admission_applications" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE INDEX "IDX_admission_applications_school" ON "admission_applications" ("school_id") `);
        // Quoted over the phone by a parent chasing a decision, so it is the
        // one lookup that must be exact and unique within the school.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_admission_applications_school_no" ON "admission_applications" ("school_id", "application_no") `);
        // The admissions list filters by stage far more often than anything else.
        await queryRunner.query(`CREATE INDEX "IDX_admission_applications_school_status" ON "admission_applications" ("school_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_admission_applications_school_session" ON "admission_applications" ("school_id", "session_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_admission_applications_school_level" ON "admission_applications" ("school_id", "level_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_admission_applications_school_created" ON "admission_applications" ("school_id", "created_at") `);
        // The next application number is MAX(sequence) + 1 within a session,
        // taken under an advisory lock. This is the index that read walks.
        await queryRunner.query(`CREATE INDEX "IDX_admission_applications_sequence" ON "admission_applications" ("school_id", "session_id", "sequence") `);

        await queryRunner.query(`ALTER TABLE "admission_applications" ADD CONSTRAINT "FK_admission_applications_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // RESTRICT on both: a session or a level with applications against it
        // cannot be deleted out from under them, which is what keeps an
        // application's "applying for JSS 1, 2026/2027" readable years later.
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD CONSTRAINT "FK_admission_applications_session" FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD CONSTRAINT "FK_admission_applications_level" FOREIGN KEY ("level_id") REFERENCES "school_levels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        // A class that is dissolved before the family replies loses the offer's
        // pointer, not the offer.
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD CONSTRAINT "FK_admission_applications_offered_class" FOREIGN KEY ("offered_class_id") REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD CONSTRAINT "FK_admission_applications_student" FOREIGN KEY ("converted_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "admission_stage_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "application_id" uuid NOT NULL, "status" character varying(16) NOT NULL, "actor_user_id" uuid, "actor_name" character varying(160) NOT NULL, "note" text, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_admission_stage_events" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE INDEX "IDX_admission_stage_events_school" ON "admission_stage_events" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_admission_stage_events_school_application" ON "admission_stage_events" ("school_id", "application_id") `);
        // How the detail screen reads one application's history, in order.
        await queryRunner.query(`CREATE INDEX "IDX_admission_stage_events_application_time" ON "admission_stage_events" ("application_id", "occurred_at") `);

        await queryRunner.query(`ALTER TABLE "admission_stage_events" ADD CONSTRAINT "FK_admission_stage_events_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "admission_stage_events" ADD CONSTRAINT "FK_admission_stage_events_application" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // The registrar may leave; what they decided stays, under their name.
        await queryRunner.query(`ALTER TABLE "admission_stage_events" ADD CONSTRAINT "FK_admission_stage_events_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admission_stage_events" DROP CONSTRAINT "FK_admission_stage_events_actor"`);
        await queryRunner.query(`ALTER TABLE "admission_stage_events" DROP CONSTRAINT "FK_admission_stage_events_application"`);
        await queryRunner.query(`ALTER TABLE "admission_stage_events" DROP CONSTRAINT "FK_admission_stage_events_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_stage_events_application_time"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_stage_events_school_application"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_stage_events_school"`);
        await queryRunner.query(`DROP TABLE "admission_stage_events"`);

        await queryRunner.query(`ALTER TABLE "admission_applications" DROP CONSTRAINT "FK_admission_applications_student"`);
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP CONSTRAINT "FK_admission_applications_offered_class"`);
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP CONSTRAINT "FK_admission_applications_level"`);
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP CONSTRAINT "FK_admission_applications_session"`);
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP CONSTRAINT "FK_admission_applications_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_applications_sequence"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_applications_school_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_applications_school_level"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_applications_school_session"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_applications_school_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_applications_school_no"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_applications_school"`);
        await queryRunner.query(`DROP TABLE "admission_applications"`);
    }

}
