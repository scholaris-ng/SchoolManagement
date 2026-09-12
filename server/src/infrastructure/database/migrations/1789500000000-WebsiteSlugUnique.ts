import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `website_content.slug` is the school's public web address — spec section 31
 * ("school.platformdomain.com") — and is independently editable from the
 * settings screen rather than fixed to the school's own immutable `slug`. It
 * was only ever a plain index, so two schools could quietly save the same
 * address and the public page would resolve to whichever one Postgres
 * happened to return first (`WebsiteRepository.findPublishedBySlug`). The
 * application layer now checks for a clash before saving; this makes the
 * database refuse one too, in case anything writes around the service.
 *
 * No backfill is needed: the table has no soft delete, and existing rows come
 * from seed data with distinct slugs.
 */
export class WebsiteSlugUnique1789500000000 implements MigrationInterface {
    name = 'WebsiteSlugUnique1789500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_45e5f26e1a31d31210d737bebc"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_45e5f26e1a31d31210d737bebc" ON "website_content" ("slug")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_45e5f26e1a31d31210d737bebc"`);
        await queryRunner.query(`CREATE INDEX "IDX_45e5f26e1a31d31210d737bebc" ON "website_content" ("slug")`);
    }

}
