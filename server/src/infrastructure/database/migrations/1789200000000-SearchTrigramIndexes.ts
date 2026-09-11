import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Every free-text search box in the app (staff, students, guardians,
 * notifications, audit) filters with `column ILIKE '%term%'`. A leading
 * wildcard can never use a plain btree index, so — once the tenant filter has
 * narrowed things down to one school — each of those searches was a
 * sequential scan of that school's rows on the searched table.
 *
 * `pg_trgm` GIN indexes fix that: Postgres can satisfy `ILIKE '%term%'` from a
 * trigram index directly, and can combine several single-column trigram
 * indexes with a bitmap OR for the `(a ILIKE :x OR b ILIKE :x OR ...)` shape
 * every one of these queries already uses — so no application query changes
 * anywhere here, only new indexes.
 */
export class SearchTrigramIndexes1789200000000 implements MigrationInterface {
    name = 'SearchTrigramIndexes1789200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        // staff.repository.ts fetchPaginated — name, staff number, email, designation
        await queryRunner.query(`CREATE INDEX "IDX_staff_first_name_trgm" ON "staff" USING gin ("first_name" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_staff_last_name_trgm" ON "staff" USING gin ("last_name" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_staff_staff_no_trgm" ON "staff" USING gin ("staff_no" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_staff_email_trgm" ON "staff" USING gin ("email" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_staff_designation_trgm" ON "staff" USING gin ("designation" gin_trgm_ops)`);

        // student.repository.ts fetchPaginated and search (the typeahead behind
        // the command palette and every student picker) — name and admission no
        await queryRunner.query(`CREATE INDEX "IDX_students_first_name_trgm" ON "students" USING gin ("first_name" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_students_last_name_trgm" ON "students" USING gin ("last_name" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_students_admission_no_trgm" ON "students" USING gin ("admission_no" gin_trgm_ops)`);

        // guardian.repository.ts fetchPaginated — name, email, phone
        await queryRunner.query(`CREATE INDEX "IDX_guardians_first_name_trgm" ON "guardians" USING gin ("first_name" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_guardians_last_name_trgm" ON "guardians" USING gin ("last_name" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_guardians_email_trgm" ON "guardians" USING gin ("email" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_guardians_phone_trgm" ON "guardians" USING gin ("phone" gin_trgm_ops)`);

        // notification.repository.ts fetchPaginated — title, body
        await queryRunner.query(`CREATE INDEX "IDX_notifications_title_trgm" ON "notifications" USING gin ("title" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_body_trgm" ON "notifications" USING gin ("body" gin_trgm_ops)`);

        // audit.repository.ts fetchPaginated — actor name, action, entity label
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actor_name_trgm" ON "audit_logs" USING gin ("actor_name" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action_trgm" ON "audit_logs" USING gin ("action" gin_trgm_ops)`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity_label_trgm" ON "audit_logs" USING gin ("entity_label" gin_trgm_ops)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_audit_logs_entity_label_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_audit_logs_action_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_audit_logs_actor_name_trgm"`);

        await queryRunner.query(`DROP INDEX "IDX_notifications_body_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_notifications_title_trgm"`);

        await queryRunner.query(`DROP INDEX "IDX_guardians_phone_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_guardians_email_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_guardians_last_name_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_guardians_first_name_trgm"`);

        await queryRunner.query(`DROP INDEX "IDX_students_admission_no_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_students_last_name_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_students_first_name_trgm"`);

        await queryRunner.query(`DROP INDEX "IDX_staff_designation_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_staff_email_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_staff_staff_no_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_staff_last_name_trgm"`);
        await queryRunner.query(`DROP INDEX "IDX_staff_first_name_trgm"`);

        await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm`);
    }

}
