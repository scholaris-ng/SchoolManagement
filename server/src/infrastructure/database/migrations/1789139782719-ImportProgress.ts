import { MigrationInterface, QueryRunner } from "typeorm";

export class ImportProgress1789139782719 implements MigrationInterface {
    name = 'ImportProgress1789139782719'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "import_jobs" ADD "processed_rows" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "import_jobs" DROP COLUMN "processed_rows"`);
    }

}
