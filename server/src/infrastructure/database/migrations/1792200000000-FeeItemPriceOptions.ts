import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Extra named prices for the same fee item — "Zone A" transport at one
 * price, "Zone B" at another — a bursar picks between on a hand-raised
 * invoice instead of always billing the item's own `amount`. See
 * `FeeItemPriceOption`.
 */
export class FeeItemPriceOptions1792200000000 implements MigrationInterface {
    name = 'FeeItemPriceOptions1792200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fee_items" ADD "price_options" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fee_items" DROP COLUMN "price_options"`);
    }

}
