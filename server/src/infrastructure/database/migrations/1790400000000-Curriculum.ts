import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The curriculum tree (spec section 13): a curriculum per class, subject and
 * session; its topics in teaching order; each topic's performance objectives,
 * carrying the two dates that are coverage — taught, and assessed.
 *
 * Until now the curriculum screens listed nothing and every write was
 * unrouted. Deletes cascade down the tree: a plan is not a record of anything
 * that happened, so nothing below it needs to outlive it.
 *
 * Index and constraint names are spelled out, as `Attendance` does, so the
 * entities' decorators and `migration:generate` agree on them.
 */
export class Curriculum1790400000000 implements MigrationInterface {
    name = 'Curriculum1790400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "curricula" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "session_id" uuid NOT NULL, "class_id" uuid NOT NULL, "level_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "name" character varying(160) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_by_user_id" uuid, "created_by_name" character varying(160) NOT NULL, "created_by_role" character varying(40) NOT NULL, CONSTRAINT "PK_curricula" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_curricula_school" ON "curricula" ("school_id") `);
        // One plan per class, subject and session — see `Curriculum`.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_curricula_session_class_subject" ON "curricula" ("session_id", "class_id", "subject_id") `);
        await queryRunner.query(`ALTER TABLE "curricula" ADD CONSTRAINT "FK_curricula_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "curricula" ADD CONSTRAINT "FK_curricula_session" FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "curricula" ADD CONSTRAINT "FK_curricula_class" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "curricula" ADD CONSTRAINT "FK_curricula_level" FOREIGN KEY ("level_id") REFERENCES "school_levels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "curricula" ADD CONSTRAINT "FK_curricula_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // The author's account may be closed long before the plan stops being
        // read, so the row keeps `created_by_name` and loses only the link.
        await queryRunner.query(`ALTER TABLE "curricula" ADD CONSTRAINT "FK_curricula_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "curriculum_topics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "curriculum_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "description" text, "sequence" integer NOT NULL, "suggested_weeks" integer NOT NULL DEFAULT 1, CONSTRAINT "PK_curriculum_topics" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_curriculum_topics_school" ON "curriculum_topics" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_curriculum_topics_curriculum_sequence" ON "curriculum_topics" ("curriculum_id", "sequence") `);
        await queryRunner.query(`ALTER TABLE "curriculum_topics" ADD CONSTRAINT "FK_curriculum_topics_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "curriculum_topics" ADD CONSTRAINT "FK_curriculum_topics_curriculum" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "learning_objectives" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "topic_id" uuid NOT NULL, "statement" text NOT NULL, "sequence" integer NOT NULL, "bloom_level" character varying(16), "taught_at" date, "assessed_at" date, CONSTRAINT "PK_learning_objectives" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_learning_objectives_school" ON "learning_objectives" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_learning_objectives_topic_sequence" ON "learning_objectives" ("topic_id", "sequence") `);
        await queryRunner.query(`ALTER TABLE "learning_objectives" ADD CONSTRAINT "FK_learning_objectives_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "learning_objectives" ADD CONSTRAINT "FK_learning_objectives_topic" FOREIGN KEY ("topic_id") REFERENCES "curriculum_topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // Nothing is assessed before it is taught — enforced here as well as in
        // `CurriculumService.markCoverage`, so no hand-built write can say otherwise.
        await queryRunner.query(`ALTER TABLE "learning_objectives" ADD CONSTRAINT "CHK_learning_objectives_assessed_after_taught" CHECK ("assessed_at" IS NULL OR "taught_at" IS NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "learning_objectives" DROP CONSTRAINT "CHK_learning_objectives_assessed_after_taught"`);
        await queryRunner.query(`ALTER TABLE "learning_objectives" DROP CONSTRAINT "FK_learning_objectives_topic"`);
        await queryRunner.query(`ALTER TABLE "learning_objectives" DROP CONSTRAINT "FK_learning_objectives_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_learning_objectives_topic_sequence"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_learning_objectives_school"`);
        await queryRunner.query(`DROP TABLE "learning_objectives"`);

        await queryRunner.query(`ALTER TABLE "curriculum_topics" DROP CONSTRAINT "FK_curriculum_topics_curriculum"`);
        await queryRunner.query(`ALTER TABLE "curriculum_topics" DROP CONSTRAINT "FK_curriculum_topics_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_curriculum_topics_curriculum_sequence"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_curriculum_topics_school"`);
        await queryRunner.query(`DROP TABLE "curriculum_topics"`);

        await queryRunner.query(`ALTER TABLE "curricula" DROP CONSTRAINT "FK_curricula_created_by"`);
        await queryRunner.query(`ALTER TABLE "curricula" DROP CONSTRAINT "FK_curricula_subject"`);
        await queryRunner.query(`ALTER TABLE "curricula" DROP CONSTRAINT "FK_curricula_level"`);
        await queryRunner.query(`ALTER TABLE "curricula" DROP CONSTRAINT "FK_curricula_class"`);
        await queryRunner.query(`ALTER TABLE "curricula" DROP CONSTRAINT "FK_curricula_session"`);
        await queryRunner.query(`ALTER TABLE "curricula" DROP CONSTRAINT "FK_curricula_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_curricula_session_class_subject"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_curricula_school"`);
        await queryRunner.query(`DROP TABLE "curricula"`);
    }

}
