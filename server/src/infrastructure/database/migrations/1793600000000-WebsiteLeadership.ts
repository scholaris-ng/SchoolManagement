import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The next slice of the public site's content model, after the lean pass that
 * stopped a new school's page from showing AB.10's: a founder or proprietor,
 * a list of core values, and a leadership team — the three sections
 * `about-blocks.tsx` already knows how to render (and already hides when
 * empty) but that, until now, had no field on `website_content` for a school
 * to actually fill in.
 */
export class WebsiteLeadership1793600000000 implements MigrationInterface {
    name = 'WebsiteLeadership1793600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "website_content" ADD "founder" jsonb`);
        await queryRunner.query(`ALTER TABLE "website_content" ADD "values" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "website_content" ADD "leadership" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "website_content" DROP COLUMN "leadership"`);
        await queryRunner.query(`ALTER TABLE "website_content" DROP COLUMN "values"`);
        await queryRunner.query(`ALTER TABLE "website_content" DROP COLUMN "founder"`);
    }

}
