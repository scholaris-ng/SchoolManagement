import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The token behind the "respond to this offer" link a family is emailed.
 *
 * Only the SHA-256 of it is stored, never the token itself — the same rule
 * `email_verifications` follows for its codes, for the same reason: anyone
 * who could read this column could otherwise accept or decline a place on a
 * family's behalf. Nullable and unindexed-unique on purpose: an application
 * that has never been offered a place has no token, and reusing a hash is not
 * a constraint worth enforcing when a collision is already a cryptographic
 * impossibility.
 */
export class AdmissionOfferToken1789900000000 implements MigrationInterface {
    name = 'AdmissionOfferToken1789900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admission_applications" ADD "offer_token_hash" character varying(64)`);
        await queryRunner.query(`CREATE INDEX "IDX_admission_applications_offer_token" ON "admission_applications" ("offer_token_hash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_admission_applications_offer_token"`);
        await queryRunner.query(`ALTER TABLE "admission_applications" DROP COLUMN "offer_token_hash"`);
    }

}
