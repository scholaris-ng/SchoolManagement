import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The student search now matches a pupil's middle name as well as their first
 * name and surname (`searchWordsClause` in `shared/pagination/personName.ts`).
 *
 * `SearchTrigramIndexes` covered `first_name`, `last_name` and `admission_no`,
 * and Postgres can only answer an `(a ILIKE x OR b ILIKE x OR ...)` from
 * trigram indexes when *every* column in the OR has one — one unindexed
 * column sends the whole condition back to a sequential scan of the school's
 * pupils. So the new column gets the same index the others have.
 */
export class StudentMiddleNameSearchIndex1793900000000 implements MigrationInterface {
    name = 'StudentMiddleNameSearchIndex1793900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_students_middle_name_trgm" ON "students" USING gin ("middle_name" gin_trgm_ops)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_students_middle_name_trgm"`);
    }

}
