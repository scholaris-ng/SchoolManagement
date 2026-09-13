import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Schemes of work and lesson notes (spec sections 14 and 15) — the two
 * documents derived from a curriculum: the plan laid across a term's weeks,
 * and what a teacher actually did with one of those weeks.
 *
 * Both copy their topic and objective text in at creation rather than only
 * linking to the curriculum, so the document a head teacher approved keeps
 * saying what it said. `version` on both is the optimistic lock the client
 * echoes back as `If-Match`.
 */
export class SchemesAndLessonNotes1790600000000 implements MigrationInterface {
    name = 'SchemesAndLessonNotes1790600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "schemes_of_work" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "curriculum_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "class_id" uuid NOT NULL, "term_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "created_by_user_id" uuid, "created_by_name" character varying(160) NOT NULL, "approved_by_name" character varying(160), "approved_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, CONSTRAINT "PK_schemes_of_work" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_schemes_of_work_school" ON "schemes_of_work" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_schemes_of_work_school_status" ON "schemes_of_work" ("school_id", "status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_schemes_of_work_curriculum_term" ON "schemes_of_work" ("curriculum_id", "term_id") `);
        await queryRunner.query(`ALTER TABLE "schemes_of_work" ADD CONSTRAINT "FK_schemes_of_work_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schemes_of_work" ADD CONSTRAINT "FK_schemes_of_work_curriculum" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schemes_of_work" ADD CONSTRAINT "FK_schemes_of_work_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schemes_of_work" ADD CONSTRAINT "FK_schemes_of_work_class" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schemes_of_work" ADD CONSTRAINT "FK_schemes_of_work_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schemes_of_work" ADD CONSTRAINT "FK_schemes_of_work_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "scheme_weeks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "scheme_id" uuid NOT NULL, "week_number" integer NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "topic_id" uuid, "topic_title" character varying(200) NOT NULL DEFAULT '', "objective_ids" uuid array NOT NULL DEFAULT '{}', "objective_statements" text array NOT NULL DEFAULT '{}', "activities" text, "resources" text, "is_break" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_scheme_weeks" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_scheme_weeks_school" ON "scheme_weeks" ("school_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_scheme_weeks_scheme_week" ON "scheme_weeks" ("scheme_id", "week_number") `);
        await queryRunner.query(`ALTER TABLE "scheme_weeks" ADD CONSTRAINT "FK_scheme_weeks_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scheme_weeks" ADD CONSTRAINT "FK_scheme_weeks_scheme" FOREIGN KEY ("scheme_id") REFERENCES "schemes_of_work"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scheme_weeks" ADD CONSTRAINT "FK_scheme_weeks_topic" FOREIGN KEY ("topic_id") REFERENCES "curriculum_topics"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "lesson_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "teacher_id" uuid NOT NULL, "teacher_name" character varying(160) NOT NULL, "scheme_id" uuid NOT NULL, "scheme_week_id" uuid NOT NULL, "class_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "term_id" uuid NOT NULL, "week_number" integer NOT NULL, "date" date NOT NULL, "topic" character varying(200) NOT NULL, "objective_ids" uuid array NOT NULL DEFAULT '{}', "objective_statements" text array NOT NULL DEFAULT '{}', "content" text NOT NULL, "resources" text, "assignment" text, "challenges" text, "student_difficulties" text, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "reviewer_name" character varying(160), "reviewed_at" TIMESTAMP WITH TIME ZONE, "review_comment" text, "version" integer NOT NULL, CONSTRAINT "PK_lesson_notes" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_lesson_notes_school" ON "lesson_notes" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_lesson_notes_teacher_status" ON "lesson_notes" ("teacher_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_lesson_notes_school_date" ON "lesson_notes" ("school_id", "date") `);
        await queryRunner.query(`ALTER TABLE "lesson_notes" ADD CONSTRAINT "FK_lesson_notes_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_notes" ADD CONSTRAINT "FK_lesson_notes_teacher" FOREIGN KEY ("teacher_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_notes" ADD CONSTRAINT "FK_lesson_notes_scheme" FOREIGN KEY ("scheme_id") REFERENCES "schemes_of_work"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_notes" ADD CONSTRAINT "FK_lesson_notes_scheme_week" FOREIGN KEY ("scheme_week_id") REFERENCES "scheme_weeks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_notes" ADD CONSTRAINT "FK_lesson_notes_class" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_notes" ADD CONSTRAINT "FK_lesson_notes_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_notes" ADD CONSTRAINT "FK_lesson_notes_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const table of ['lesson_notes', 'scheme_weeks', 'schemes_of_work']) {
            await queryRunner.query(`DROP TABLE "${table}" CASCADE`);
        }
    }

}
