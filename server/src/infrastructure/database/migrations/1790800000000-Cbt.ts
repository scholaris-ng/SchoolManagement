import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The question bank and computer-based tests (spec section 25).
 *
 * A question may name the learning objective it tests, which is the link that
 * makes "taught" and "tested" comparable in the coverage report. An attempt
 * fixes its own question order at the moment it starts and carries the
 * server's own expiry, so neither a reload nor a clock the browser controls
 * can change a pupil's paper mid-exam.
 */
export class Cbt1790800000000 implements MigrationInterface {
    name = 'Cbt1790800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "questions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "topic_id" uuid, "objective_id" uuid, "level_id" uuid, "type" character varying(20) NOT NULL, "difficulty" character varying(10) NOT NULL DEFAULT 'MEDIUM', "text" text NOT NULL, "image_url" character varying(500), "options" jsonb NOT NULL DEFAULT '[]', "correct_answer" text, "explanation" text, "marks" integer NOT NULL DEFAULT 1, "usage_count" integer NOT NULL DEFAULT 0, "created_by_user_id" uuid, "created_by_name" character varying(160) NOT NULL, CONSTRAINT "PK_questions" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_questions_school" ON "questions" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_questions_school_subject" ON "questions" ("school_id", "subject_id") `);
        await queryRunner.query(`ALTER TABLE "questions" ADD CONSTRAINT "FK_questions_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "questions" ADD CONSTRAINT "FK_questions_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // SET NULL, not CASCADE: editing a curriculum must not delete the questions written against it.
        await queryRunner.query(`ALTER TABLE "questions" ADD CONSTRAINT "FK_questions_topic" FOREIGN KEY ("topic_id") REFERENCES "curriculum_topics"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "questions" ADD CONSTRAINT "FK_questions_objective" FOREIGN KEY ("objective_id") REFERENCES "learning_objectives"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "questions" ADD CONSTRAINT "FK_questions_level" FOREIGN KEY ("level_id") REFERENCES "school_levels"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "questions" ADD CONSTRAINT "FK_questions_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "cbt_assessments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "title" character varying(160) NOT NULL, "mode" character varying(10) NOT NULL DEFAULT 'PRACTICE', "subject_id" uuid NOT NULL, "class_ids" uuid array NOT NULL DEFAULT '{}', "term_id" uuid NOT NULL, "question_ids" uuid array NOT NULL DEFAULT '{}', "duration_minutes" integer NOT NULL DEFAULT 30, "attempts_allowed" integer NOT NULL DEFAULT 1, "starts_at" TIMESTAMP WITH TIME ZONE, "ends_at" TIMESTAMP WITH TIME ZONE, "shuffle_questions" boolean NOT NULL DEFAULT true, "shuffle_options" boolean NOT NULL DEFAULT true, "show_result_immediately" boolean NOT NULL DEFAULT true, "pass_score" integer NOT NULL DEFAULT 50, "state" character varying(12) NOT NULL DEFAULT 'DRAFT', "created_by_user_id" uuid, "created_by_name" character varying(160) NOT NULL, "version" integer NOT NULL, CONSTRAINT "PK_cbt_assessments" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cbt_assessments_school" ON "cbt_assessments" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cbt_assessments_school_state" ON "cbt_assessments" ("school_id", "state") `);
        await queryRunner.query(`ALTER TABLE "cbt_assessments" ADD CONSTRAINT "FK_cbt_assessments_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cbt_assessments" ADD CONSTRAINT "FK_cbt_assessments_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cbt_assessments" ADD CONSTRAINT "FK_cbt_assessments_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cbt_assessments" ADD CONSTRAINT "FK_cbt_assessments_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "cbt_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "assessment_id" uuid NOT NULL, "student_id" uuid NOT NULL, "question_ids" uuid array NOT NULL DEFAULT '{}', "answers" jsonb NOT NULL DEFAULT '{}', "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE, "score" numeric(6,2), "total_marks" integer NOT NULL DEFAULT 0, "status" character varying(16) NOT NULL DEFAULT 'IN_PROGRESS', CONSTRAINT "PK_cbt_attempts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cbt_attempts_school" ON "cbt_attempts" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cbt_attempts_assessment_student" ON "cbt_attempts" ("assessment_id", "student_id") `);
        await queryRunner.query(`ALTER TABLE "cbt_attempts" ADD CONSTRAINT "FK_cbt_attempts_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cbt_attempts" ADD CONSTRAINT "FK_cbt_attempts_assessment" FOREIGN KEY ("assessment_id") REFERENCES "cbt_assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cbt_attempts" ADD CONSTRAINT "FK_cbt_attempts_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const table of ['cbt_attempts', 'cbt_assessments', 'questions']) {
            await queryRunner.query(`DROP TABLE "${table}" CASCADE`);
        }
    }

}
