import { MigrationInterface, QueryRunner } from "typeorm";

export class BulkImportsAndFeeItems1789133102054 implements MigrationInterface {
    name = 'BulkImportsAndFeeItems1789133102054'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "fee_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "school_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "code" character varying(20) NOT NULL, "description" text, "amount" numeric(12,2) NOT NULL, "category" character varying(20) NOT NULL, "is_optional" boolean NOT NULL DEFAULT false, "is_recurring" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_4ce7181a0ac3570405af9c3c736" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_89f21575f5c0d9b8c98de4e803" ON "fee_items" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4f592e548e580fe038c0ea436e" ON "fee_items" ("school_id", "is_active") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b0a9384e8064225adf85552ff7" ON "fee_items" ("school_id", "code") `);
        await queryRunner.query(`CREATE TABLE "import_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "entity" character varying(16) NOT NULL, "file_name" character varying(255) NOT NULL, "mapping" jsonb NOT NULL, "rows" jsonb NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'VALIDATED', "total_rows" integer NOT NULL DEFAULT '0', "valid_rows" integer NOT NULL DEFAULT '0', "error_rows" integer NOT NULL DEFAULT '0', "warning_rows" integer NOT NULL DEFAULT '0', "duplicate_rows" integer NOT NULL DEFAULT '0', "created" integer NOT NULL DEFAULT '0', "updated" integer NOT NULL DEFAULT '0', "skipped" integer NOT NULL DEFAULT '0', "failed" integer NOT NULL DEFAULT '0', "issues" jsonb NOT NULL DEFAULT '[]', "started_by_user_id" uuid, "started_by_name" character varying(160) NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4d206c602f173f98e4bb85819a3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_349d3741c6a2f349054e5557c1" ON "import_jobs" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_767c1a9d6f281077a8c267328c" ON "import_jobs" ("school_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_07916f8e983404551a916120f0" ON "import_jobs" ("school_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "fee_items" ADD CONSTRAINT "FK_89f21575f5c0d9b8c98de4e8036" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "import_jobs" ADD CONSTRAINT "FK_349d3741c6a2f349054e5557c1c" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "import_jobs" ADD CONSTRAINT "FK_76b592795146c716b21f83fb46c" FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "import_jobs" DROP CONSTRAINT "FK_76b592795146c716b21f83fb46c"`);
        await queryRunner.query(`ALTER TABLE "import_jobs" DROP CONSTRAINT "FK_349d3741c6a2f349054e5557c1c"`);
        await queryRunner.query(`ALTER TABLE "fee_items" DROP CONSTRAINT "FK_89f21575f5c0d9b8c98de4e8036"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07916f8e983404551a916120f0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_767c1a9d6f281077a8c267328c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_349d3741c6a2f349054e5557c1"`);
        await queryRunner.query(`DROP TABLE "import_jobs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0a9384e8064225adf85552ff7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f592e548e580fe038c0ea436e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_89f21575f5c0d9b8c98de4e803"`);
        await queryRunner.query(`DROP TABLE "fee_items"`);
    }

}
