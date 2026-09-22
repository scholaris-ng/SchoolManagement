import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Which of an invoice's own charges a payment actually settled — real money,
 * not the cosmetic `paid_line_ids` annotation on `payment_allocations`, which
 * only ever says what a receipt should print.
 *
 * Itemizing a payment across fee items is optional, so most allocations still
 * carry none of these rows. Where they exist, they must sum to their parent
 * allocation's `amount` exactly — enforced in `PaymentsService`, not here:
 * Postgres has no cheap check constraint for a sum across sibling rows.
 */
export class PaymentLineAllocations1792900000000 implements MigrationInterface {
    name = 'PaymentLineAllocations1792900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment_line_allocations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "payment_allocation_id" uuid NOT NULL, "invoice_line_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, CONSTRAINT "PK_payment_line_allocations" PRIMARY KEY ("id"), CONSTRAINT "CHK_payment_line_allocations_amount" CHECK ("amount" > 0))`);
        await queryRunner.query(`CREATE INDEX "IDX_payment_line_allocations_allocation" ON "payment_line_allocations" ("payment_allocation_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payment_line_allocations_line" ON "payment_line_allocations" ("invoice_line_id") `);
        // One breakdown row per (allocation, line): a second payment against
        // the same line is a second allocation, not a second row here.
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_payment_line_allocations_allocation_line" ON "payment_line_allocations" ("payment_allocation_id", "invoice_line_id") `);
        await queryRunner.query(`ALTER TABLE "payment_line_allocations" ADD CONSTRAINT "FK_payment_line_allocations_school" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // CASCADE: a line breakdown is only ever a detail of its parent
        // allocation, which itself is never deleted — but if it ever were,
        // the breakdown should go with it rather than orphan.
        await queryRunner.query(`ALTER TABLE "payment_line_allocations" ADD CONSTRAINT "FK_payment_line_allocations_allocation" FOREIGN KEY ("payment_allocation_id") REFERENCES "payment_allocations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // RESTRICT, same reasoning as `payment_allocations.invoice_id`: a line
        // something was paid against must never vanish.
        await queryRunner.query(`ALTER TABLE "payment_line_allocations" ADD CONSTRAINT "FK_payment_line_allocations_line" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_line_allocations" DROP CONSTRAINT "FK_payment_line_allocations_line"`);
        await queryRunner.query(`ALTER TABLE "payment_line_allocations" DROP CONSTRAINT "FK_payment_line_allocations_allocation"`);
        await queryRunner.query(`ALTER TABLE "payment_line_allocations" DROP CONSTRAINT "FK_payment_line_allocations_school"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_line_allocations_allocation_line"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_line_allocations_line"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_line_allocations_allocation"`);
        await queryRunner.query(`DROP TABLE "payment_line_allocations"`);
    }

}
