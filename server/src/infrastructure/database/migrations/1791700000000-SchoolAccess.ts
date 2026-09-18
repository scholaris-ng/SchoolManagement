import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A school's access window: free for 14 days, then only for as long as someone
 * has activated it.
 *
 * `access_ends_at` is the single moment the software stops working for that
 * school. The trial and a paid month are the same thing to the code — a date —
 * which is why activating extends this column rather than adding a second one
 * to reconcile with it.
 *
 * The default is what gives every school its trial, wherever it is created:
 * registration, the seed, or a row inserted by hand all start the clock without
 * any of them having to remember to. Existing schools get the same default, so
 * each has 14 days from the day this runs — none is locked out by having been
 * created long ago.
 *
 * `last_activated_*` say who last activated a school and when, so the Schools
 * screen can show it without reading the audit log.
 */
export class SchoolAccess1791700000000 implements MigrationInterface {
    name = 'SchoolAccess1791700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "schools" ADD "access_ends_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '14 days')`);
        await queryRunner.query(`ALTER TABLE "schools" ADD "last_activated_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "schools" ADD "last_activated_by" character varying(160)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "last_activated_by"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "last_activated_at"`);
        await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "access_ends_at"`);
    }
}
