import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Lets a guardian record exist with no email address.
 *
 * A guardian who doesn't want a parent-portal account has no use for one —
 * the only thing an email is required for is `GuardiansService.invite`,
 * which already refuses to run without one. Postgres treats each `NULL` in a
 * unique index as distinct from every other, so `("school_id", "email")`
 * staying unique needs no change: any number of guardians at a school may
 * have no email, and the constraint still catches two with the same real one.
 */
export class GuardianEmailOptional1791800000000 implements MigrationInterface {
    name = 'GuardianEmailOptional1791800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "guardians" ALTER COLUMN "email" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "guardians" ALTER COLUMN "email" SET NOT NULL`);
    }

}
