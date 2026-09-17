import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Lets a fee item be billed by quantity — a locker, a textbook, a bus trip —
 * rather than always once. Off by default for every existing item: nothing
 * already configured suddenly grows a quantity field it never asked for.
 */
export class FeeItemHasQuantity1792000000000 implements MigrationInterface {
    name = 'FeeItemHasQuantity1792000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fee_items" ADD "has_quantity" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fee_items" DROP COLUMN "has_quantity"`);
    }

}
