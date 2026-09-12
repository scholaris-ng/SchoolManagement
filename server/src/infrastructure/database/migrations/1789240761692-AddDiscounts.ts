import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDiscounts1789240761692 implements MigrationInterface {
    name = 'AddDiscounts1789240761692'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "discounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "school_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "type" character varying(20) NOT NULL, "mode" character varying(10) NOT NULL, "value" numeric(12,2) NOT NULL, "applies_to_fee_item_ids" jsonb NOT NULL DEFAULT '[]', "description" text, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_66c522004212dc814d6e2f14ecc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_478bb43e90343a2ed645d77889" ON "discounts" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b05bb87c1f45501a21b2fdf6a3" ON "discounts" ("school_id", "is_active") `);
        await queryRunner.query(`ALTER TABLE "discounts" ADD CONSTRAINT "FK_478bb43e90343a2ed645d77889c" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "discounts" DROP CONSTRAINT "FK_478bb43e90343a2ed645d77889c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b05bb87c1f45501a21b2fdf6a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_478bb43e90343a2ed645d77889"`);
        await queryRunner.query(`DROP TABLE "discounts"`);
    }

}
