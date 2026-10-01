import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The WhatsApp number the in-app support widget sends issues and complaints
 * to. A single row — the platform has exactly one — rather than a column
 * bolted onto an unrelated table, since nothing else about this belongs to
 * any other entity.
 */
export class PlatformSupportSettings1793500000000 implements MigrationInterface {
    name = 'PlatformSupportSettings1793500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "platform_support_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "whatsapp_number" character varying(32), "updated_by" character varying(160), CONSTRAINT "PK_platform_support_settings_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "platform_support_settings"`);
    }

}
