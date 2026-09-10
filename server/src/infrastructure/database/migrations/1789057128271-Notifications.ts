import { MigrationInterface, QueryRunner } from "typeorm";

export class Notifications1789057128271 implements MigrationInterface {
    name = 'Notifications1789057128271'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "user_id" uuid NOT NULL, "category" character varying(16) NOT NULL, "title" character varying(200) NOT NULL, "body" text NOT NULL, "action_url" character varying(500), "severity" character varying(16) NOT NULL DEFAULT 'INFO', "entity_type" character varying(80), "entity_id" character varying(80), "read_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7f3fdb086b7b384df55f634c54" ON "notifications" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9a8a82462cab47c73d25f49261" ON "notifications" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5323ccd23482802bd9759e88ee" ON "notifications" ("user_id", "read_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a7d100f0411c65d4b3a3ab73b" ON "notifications" ("school_id", "user_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "notification_preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "category" character varying(16) NOT NULL, "in_app" boolean NOT NULL DEFAULT true, "push" boolean NOT NULL DEFAULT true, "email" boolean NOT NULL DEFAULT false, "sms" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_64c90edc7310c6be7c10c96f67" ON "notification_preferences" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5906e7816659c2d55066f409bf" ON "notification_preferences" ("user_id", "category") `);
        await queryRunner.query(`CREATE TABLE "push_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token" character varying(512) NOT NULL, "platform" character varying(16) NOT NULL DEFAULT 'WEB', "user_agent" character varying(400), "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_869b4a9ba2c9e030aafc4b7dc7a" UNIQUE ("token"), CONSTRAINT "PK_32734e87f299c29ca3878861f4f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_94c371aff70dedeb89dae39f44" ON "push_tokens" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_7f3fdb086b7b384df55f634c54b" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD CONSTRAINT "FK_64c90edc7310c6be7c10c96f675" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "push_tokens" ADD CONSTRAINT "FK_94c371aff70dedeb89dae39f440" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "push_tokens" DROP CONSTRAINT "FK_94c371aff70dedeb89dae39f440"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT "FK_64c90edc7310c6be7c10c96f675"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_7f3fdb086b7b384df55f634c54b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94c371aff70dedeb89dae39f44"`);
        await queryRunner.query(`DROP TABLE "push_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5906e7816659c2d55066f409bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_64c90edc7310c6be7c10c96f67"`);
        await queryRunner.query(`DROP TABLE "notification_preferences"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a7d100f0411c65d4b3a3ab73b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5323ccd23482802bd9759e88ee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a8a82462cab47c73d25f49261"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f3fdb086b7b384df55f634c54"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
    }

}
