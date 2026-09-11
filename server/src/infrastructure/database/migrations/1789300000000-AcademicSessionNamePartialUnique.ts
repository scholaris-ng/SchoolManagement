import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `academic_sessions` soft-deletes (`removeSession` calls `softDeleteScoped`),
 * but its (school_id, name) unique index was a plain index — it has no idea
 * about `deleted_at`, so it still counts a soft-deleted row. Deleting session
 * "2026/2027" and then creating a new one with that same name passed the
 * app-level `findByName` check (which does exclude deleted rows) only to
 * fail at the database with a raw "duplicate key value violates unique
 * constraint" — the soft-deleted row was still occupying the name.
 *
 * Postgres partial indexes fix this: `WHERE deleted_at IS NULL` means only
 * live rows compete for uniqueness, exactly what a soft delete is supposed
 * to free up.
 */
export class AcademicSessionNamePartialUnique1789300000000 implements MigrationInterface {
    name = 'AcademicSessionNamePartialUnique1789300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_ea34b951b96a1ce2d9a8f7a86c"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ea34b951b96a1ce2d9a8f7a86c" ON "academic_sessions" ("school_id", "name") WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_ea34b951b96a1ce2d9a8f7a86c"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ea34b951b96a1ce2d9a8f7a86c" ON "academic_sessions" ("school_id", "name")`);
    }

}
