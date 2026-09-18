import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Lets a fee item exist with no code.
 *
 * A bursar naming a one-off or minor charge (a uniform sub-item, say) should
 * not have to invent a short code it has no other use for. Postgres treats
 * each `NULL` in a unique index as distinct from every other, so
 * `("school_id", "code")` staying unique needs no change: any number of fee
 * items at a school may have no code, and the constraint still catches two
 * with the same real one.
 */
export class FeeItemCodeOptional1792100000000 implements MigrationInterface {
    name = 'FeeItemCodeOptional1792100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fee_items" ALTER COLUMN "code" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fee_items" ALTER COLUMN "code" SET NOT NULL`);
    }

}
