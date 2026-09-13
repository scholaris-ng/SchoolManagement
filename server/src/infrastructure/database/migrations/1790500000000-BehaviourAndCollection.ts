import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The pastoral record (spec sections 12, 23 and 24): behaviour scales and
 * traits, the observations rated against them, house-point awards, the
 * pickup list for each child, and the log of each child actually leaving.
 *
 * Every one of these screens rendered an empty state until now and every
 * write was unrouted. Observations, awards and collection events are
 * append-only tables; the rest are the school's own configuration.
 */
export class BehaviourAndCollection1790500000000 implements MigrationInterface {
    name = 'BehaviourAndCollection1790500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "behaviour_scales" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "min" integer NOT NULL, "max" integer NOT NULL, "points" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_behaviour_scales" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_behaviour_scales_school" ON "behaviour_scales" ("school_id") `);
        await queryRunner.query(`ALTER TABLE "behaviour_scales" ADD CONSTRAINT "FK_behaviour_scales_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "behaviour_traits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "category" character varying(16) NOT NULL, "description" text, "scale_id" uuid NOT NULL, "level_ids" uuid array NOT NULL DEFAULT '{}', "appears_on_report_card" boolean NOT NULL DEFAULT true, "sequence" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_behaviour_traits" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_behaviour_traits_school" ON "behaviour_traits" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_behaviour_traits_school_sequence" ON "behaviour_traits" ("school_id", "sequence") `);
        await queryRunner.query(`ALTER TABLE "behaviour_traits" ADD CONSTRAINT "FK_behaviour_traits_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // RESTRICT: a scale with traits on it cannot vanish and leave their ratings meaningless.
        await queryRunner.query(`ALTER TABLE "behaviour_traits" ADD CONSTRAINT "FK_behaviour_traits_scale" FOREIGN KEY ("scale_id") REFERENCES "behaviour_scales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "behaviour_observations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "trait_id" uuid NOT NULL, "term_id" uuid NOT NULL, "rating" integer NOT NULL, "scale_max" integer NOT NULL, "note" text, "observed_by_user_id" uuid, "observed_by_name" character varying(160) NOT NULL, "observed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_behaviour_observations" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_behaviour_observations_school" ON "behaviour_observations" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_behaviour_observations_student_term" ON "behaviour_observations" ("student_id", "term_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_behaviour_observations_school_observed" ON "behaviour_observations" ("school_id", "observed_at") `);
        await queryRunner.query(`ALTER TABLE "behaviour_observations" ADD CONSTRAINT "FK_behaviour_observations_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "behaviour_observations" ADD CONSTRAINT "FK_behaviour_observations_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "behaviour_observations" ADD CONSTRAINT "FK_behaviour_observations_trait" FOREIGN KEY ("trait_id") REFERENCES "behaviour_traits"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "behaviour_observations" ADD CONSTRAINT "FK_behaviour_observations_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "behaviour_observations" ADD CONSTRAINT "FK_behaviour_observations_observed_by" FOREIGN KEY ("observed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "house_point_awards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "house_id" uuid NOT NULL, "term_id" uuid NOT NULL, "points" integer NOT NULL, "reason" character varying(20) NOT NULL, "note" text, "awarded_by_user_id" uuid, "awarded_by_name" character varying(160) NOT NULL, "awarded_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_house_point_awards" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_house_point_awards_school" ON "house_point_awards" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_house_point_awards_student_term" ON "house_point_awards" ("student_id", "term_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_house_point_awards_house_term" ON "house_point_awards" ("house_id", "term_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_house_point_awards_school_awarded" ON "house_point_awards" ("school_id", "awarded_at") `);
        await queryRunner.query(`ALTER TABLE "house_point_awards" ADD CONSTRAINT "FK_house_point_awards_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "house_point_awards" ADD CONSTRAINT "FK_house_point_awards_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "house_point_awards" ADD CONSTRAINT "FK_house_point_awards_house" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "house_point_awards" ADD CONSTRAINT "FK_house_point_awards_term" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "house_point_awards" ADD CONSTRAINT "FK_house_point_awards_awarded_by" FOREIGN KEY ("awarded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "pickup_persons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "name" character varying(160) NOT NULL, "relationship" character varying(60) NOT NULL, "phone" character varying(40) NOT NULL, "photo_url" character varying(500), "authorization_status" character varying(16) NOT NULL DEFAULT 'PENDING', "authorized_by_name" character varying(160), "authorized_at" TIMESTAMP WITH TIME ZONE, "note" text, CONSTRAINT "PK_pickup_persons" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_pickup_persons_school" ON "pickup_persons" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pickup_persons_student" ON "pickup_persons" ("student_id") `);
        await queryRunner.query(`ALTER TABLE "pickup_persons" ADD CONSTRAINT "FK_pickup_persons_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pickup_persons" ADD CONSTRAINT "FK_pickup_persons_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "collection_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "pickup_person_id" uuid, "pickup_person_name" character varying(160) NOT NULL, "relationship" character varying(60) NOT NULL, "released_by_user_id" uuid, "released_by_name" character varying(160) NOT NULL, "released_at" TIMESTAMP WITH TIME ZONE NOT NULL, "method" character varying(10) NOT NULL, "parent_notified" boolean NOT NULL DEFAULT false, "note" text, CONSTRAINT "PK_collection_events" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_collection_events_school" ON "collection_events" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_collection_events_student_released" ON "collection_events" ("student_id", "released_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_collection_events_school_released" ON "collection_events" ("school_id", "released_at") `);
        await queryRunner.query(`ALTER TABLE "collection_events" ADD CONSTRAINT "FK_collection_events_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_events" ADD CONSTRAINT "FK_collection_events_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_events" ADD CONSTRAINT "FK_collection_events_pickup_person" FOREIGN KEY ("pickup_person_id") REFERENCES "pickup_persons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_events" ADD CONSTRAINT "FK_collection_events_released_by" FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const table of ['collection_events', 'pickup_persons', 'house_point_awards', 'behaviour_observations', 'behaviour_traits', 'behaviour_scales']) {
            await queryRunner.query(`DROP TABLE "${table}" CASCADE`);
        }
    }

}
