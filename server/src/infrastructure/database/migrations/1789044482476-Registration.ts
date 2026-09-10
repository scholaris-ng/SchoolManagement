import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * School self-registration (spec section 6): the administrator's name split
 * into parts, proof that they control their email address, and the one-time
 * codes that establish it.
 *
 * The three `users` columns are added in three steps rather than the one
 * `migration:generate` produced. A plain `ADD ... NOT NULL` with no default
 * fails outright on a table that already has rows, so each column is added
 * nullable, backfilled from `display_name`, and only then constrained.
 */
export class Registration1789044482476 implements MigrationInterface {
    name = 'Registration1789044482476'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "code_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "consumed_at" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_c1ea2921e767f83cd44c0af203f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c4f1838323ae1dff5aa0014891" ON "email_verifications" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ace31bf2021c8077abb81e44e9" ON "email_verifications" ("user_id", "consumed_at") `);

        await queryRunner.query(`ALTER TABLE "users" ADD "first_name" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "last_name" character varying(100)`);

        // Split the existing display name at its last space, matching
        // `splitName` in session.service.ts. A single-word name becomes the
        // first name with an empty last name.
        await queryRunner.query(`
            UPDATE "users"
               SET "first_name" = COALESCE(NULLIF(regexp_replace("display_name", '\\s+\\S+$', ''), ''), "display_name"),
                   "last_name"  = CASE
                                    WHEN "display_name" ~ '\\s' THEN regexp_replace("display_name", '^.*\\s', '')
                                    ELSE ''
                                  END
             WHERE "first_name" IS NULL
        `);

        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "first_name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "last_name" SET NOT NULL`);

        // Everyone who predates this column signed in through Firebase, which
        // had already confirmed their address.
        await queryRunner.query(`ALTER TABLE "users" ADD "email_verified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`UPDATE "users" SET "email_verified" = true`);

        await queryRunner.query(`ALTER TABLE "email_verifications" ADD CONSTRAINT "FK_c4f1838323ae1dff5aa00148915" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_verifications" DROP CONSTRAINT "FK_c4f1838323ae1dff5aa00148915"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_name"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "first_name"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ace31bf2021c8077abb81e44e9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c4f1838323ae1dff5aa0014891"`);
        await queryRunner.query(`DROP TABLE "email_verifications"`);
    }

}
