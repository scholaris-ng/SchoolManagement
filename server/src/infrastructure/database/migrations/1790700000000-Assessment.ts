import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Assessment (spec sections 19–22): grading schemes with their components and
 * bands; the score sheets teachers fill in, one per class, subject and term,
 * and the marks on them; the written parts of a report card; stock comments;
 * and issued transcripts.
 *
 * Every results screen answered zero until now, and the admin dashboard and
 * analytics reported the same. Marks are the one table here that is read by
 * almost everything else — report cards, broadsheets, transcripts, analytics
 * and the dashboards are all projections of it.
 */
export class Assessment1790700000000 implements MigrationInterface {
    name = 'Assessment1790700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "grading_schemes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "description" text, "is_default" boolean NOT NULL DEFAULT false, "pass_mark" integer NOT NULL DEFAULT 40, "level_ids" uuid array NOT NULL DEFAULT '{}', "show_position" boolean NOT NULL DEFAULT true, "version" integer NOT NULL, CONSTRAINT "PK_grading_schemes" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_grading_schemes_school" ON "grading_schemes" ("school_id") `);
        await queryRunner.query(`ALTER TABLE "grading_schemes" ADD CONSTRAINT "FK_grading_schemes_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "assessment_components" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "scheme_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "code" character varying(20) NOT NULL, "max_score" integer NOT NULL, "sequence" integer NOT NULL, "type" character varying(24) NOT NULL DEFAULT 'CONTINUOUS_ASSESSMENT', CONSTRAINT "PK_assessment_components" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_assessment_components_school" ON "assessment_components" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_assessment_components_scheme_sequence" ON "assessment_components" ("scheme_id", "sequence") `);
        await queryRunner.query(`ALTER TABLE "assessment_components" ADD CONSTRAINT "FK_assessment_components_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_components" ADD CONSTRAINT "FK_assessment_components_scheme" FOREIGN KEY ("scheme_id") REFERENCES "grading_schemes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "grade_bands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "scheme_id" uuid NOT NULL, "label" character varying(8) NOT NULL, "min_score" integer NOT NULL, "max_score" integer NOT NULL, "remark" character varying(80) NOT NULL, "grade_point" numeric(4,2), "is_pass" boolean NOT NULL DEFAULT true, "color" character varying(20), CONSTRAINT "PK_grade_bands" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_grade_bands_school" ON "grade_bands" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_grade_bands_scheme" ON "grade_bands" ("scheme_id") `);
        await queryRunner.query(`ALTER TABLE "grade_bands" ADD CONSTRAINT "FK_grade_bands_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "grade_bands" ADD CONSTRAINT "FK_grade_bands_scheme" FOREIGN KEY ("scheme_id") REFERENCES "grading_schemes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "score_sheets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "class_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "term_id" uuid NOT NULL, "grading_scheme_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "submitted_by_name" character varying(160), "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_by_name" character varying(160), "approved_at" TIMESTAMP WITH TIME ZONE, "published_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, CONSTRAINT "PK_score_sheets" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_score_sheets_school" ON "score_sheets" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_score_sheets_school_term" ON "score_sheets" ("school_id", "term_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_score_sheets_class_subject_term" ON "score_sheets" ("class_id", "subject_id", "term_id") `);
        await queryRunner.query(`ALTER TABLE "score_sheets" ADD CONSTRAINT "FK_score_sheets_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "score_sheets" ADD CONSTRAINT "FK_score_sheets_class" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "score_sheets" ADD CONSTRAINT "FK_score_sheets_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "score_sheets" ADD CONSTRAINT "FK_score_sheets_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // RESTRICT: a scheme with sheets marked against it cannot vanish and leave their grades meaningless.
        await queryRunner.query(`ALTER TABLE "score_sheets" ADD CONSTRAINT "FK_score_sheets_scheme" FOREIGN KEY ("grading_scheme_id") REFERENCES "grading_schemes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "score_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "score_sheet_id" uuid NOT NULL, "student_id" uuid NOT NULL, "component_id" uuid NOT NULL, "score" numeric(6,2), CONSTRAINT "PK_score_entries" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_score_entries_school" ON "score_entries" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_score_entries_student" ON "score_entries" ("student_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_score_entries_sheet_student_component" ON "score_entries" ("score_sheet_id", "student_id", "component_id") `);
        await queryRunner.query(`ALTER TABLE "score_entries" ADD CONSTRAINT "FK_score_entries_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "score_entries" ADD CONSTRAINT "FK_score_entries_sheet" FOREIGN KEY ("score_sheet_id") REFERENCES "score_sheets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "score_entries" ADD CONSTRAINT "FK_score_entries_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "score_entries" ADD CONSTRAINT "FK_score_entries_component" FOREIGN KEY ("component_id") REFERENCES "assessment_components"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "report_cards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "term_id" uuid NOT NULL, "form_teacher_comment" text, "principal_comment" text, "verification_code" character varying(24), "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_report_cards" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_report_cards_school" ON "report_cards" ("school_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_report_cards_student_term" ON "report_cards" ("student_id", "term_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_report_cards_verification_code" ON "report_cards" ("verification_code") WHERE "verification_code" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "report_cards" ADD CONSTRAINT "FK_report_cards_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_cards" ADD CONSTRAINT "FK_report_cards_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_cards" ADD CONSTRAINT "FK_report_cards_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "comment_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "audience" character varying(16) NOT NULL, "band" character varying(16) NOT NULL, "text" text NOT NULL, "usage_count" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_comment_templates" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_comment_templates_school" ON "comment_templates" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_comment_templates_school_audience" ON "comment_templates" ("school_id", "audience") `);
        await queryRunner.query(`ALTER TABLE "comment_templates" ADD CONSTRAINT "FK_comment_templates_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "transcript_issues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "verification_code" character varying(24) NOT NULL, "issued_by_name" character varying(160) NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL, "cumulative_average" numeric(5,2) NOT NULL DEFAULT 0, CONSTRAINT "PK_transcript_issues" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_transcript_issues_school" ON "transcript_issues" ("school_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transcript_issues_student" ON "transcript_issues" ("student_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transcript_issues_verification_code" ON "transcript_issues" ("verification_code") `);
        await queryRunner.query(`ALTER TABLE "transcript_issues" ADD CONSTRAINT "FK_transcript_issues_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transcript_issues" ADD CONSTRAINT "FK_transcript_issues_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const table of ['transcript_issues', 'comment_templates', 'report_cards', 'score_entries', 'score_sheets', 'grade_bands', 'assessment_components', 'grading_schemes']) {
            await queryRunner.query(`DROP TABLE "${table}" CASCADE`);
        }
    }

}
