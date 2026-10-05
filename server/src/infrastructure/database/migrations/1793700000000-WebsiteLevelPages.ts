import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebsiteLevelPages1793700000000 implements MigrationInterface {
  name = 'WebsiteLevelPages1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "website_content" ADD "level_pages" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "website_content" DROP COLUMN "level_pages"`);
  }
}
