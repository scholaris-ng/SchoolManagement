import { MigrationInterface, QueryRunner } from "typeorm";

export class StudentsAndGuardians1789050469671 implements MigrationInterface {
    name = 'StudentsAndGuardians1789050469671'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "students" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "school_id" uuid NOT NULL, "admission_no" character varying(32) NOT NULL, "first_name" character varying(60) NOT NULL, "middle_name" character varying(60), "last_name" character varying(60) NOT NULL, "gender" character varying(10) NOT NULL, "date_of_birth" date NOT NULL, "photo_url" character varying(500), "photo_storage_path" character varying(500), "photo_consent" boolean NOT NULL DEFAULT false, "admission_date" date NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "current_class_id" uuid, "house_id" uuid, "blood_group" character varying(8), "medical_notes" text, "emergency_contact_name" character varying(120), "emergency_contact_phone" character varying(20), "address" text, "nationality" character varying(60), "state_of_origin" character varying(60), "religion" character varying(60), "custom_fields" jsonb NOT NULL DEFAULT '{}', "version" integer NOT NULL, CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aa8edc7905ad764f8592456964" ON "students" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e72a01d029ea7ca28f4ae3e2f" ON "students" ("school_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8594c4a4260e5c5f5ebea0711" ON "students" ("school_id", "last_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_aaa70228cdda4826118fa1b037" ON "students" ("school_id", "current_class_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b67c9f7352d815cf3981156802" ON "students" ("school_id", "status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_670050a1751e1c95b2454323a4" ON "students" ("school_id", "admission_no") `);
        await queryRunner.query(`CREATE TABLE "student_enrollments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "session_id" uuid NOT NULL, "term_id" uuid, "level_id" uuid NOT NULL, "class_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "enrolled_on" date NOT NULL, "exited_on" date, "note" text, CONSTRAINT "PK_65f64fb270d4575b099b16e00a2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6969e646aa55906ab338683340" ON "student_enrollments" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_08caafd8a026a19ecf54db0e95" ON "student_enrollments" ("student_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e0065a563e994ae10669b73188" ON "student_enrollments" ("session_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e875df488b1b297f25e3dff303" ON "student_enrollments" ("class_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8cd5c8de83c3dcc339f28fe861" ON "student_enrollments" ("school_id", "session_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_336f02451afa699a58490bc9cf" ON "student_enrollments" ("school_id", "class_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_0d56c5fe3a62c614f080d7cb8e" ON "student_enrollments" ("school_id", "student_id", "session_id") `);
        await queryRunner.query(`CREATE TABLE "student_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "name" character varying(200) NOT NULL, "category" character varying(32) NOT NULL DEFAULT 'OTHER', "storage_path" character varying(500) NOT NULL, "download_url" character varying(1000), "mime_type" character varying(120) NOT NULL, "size_bytes" bigint NOT NULL DEFAULT '0', "uploaded_by_name" character varying(160) NOT NULL, "uploaded_by_user_id" uuid, CONSTRAINT "PK_b5805e41001d410755048c8dfc4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bb5d70352bbd80968b1b871531" ON "student_documents" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8b0e086cbeca4ba69aadaac854" ON "student_documents" ("student_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fb173deeb83f027b2b256338af" ON "student_documents" ("school_id", "category") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3561380cd4c3b64426f8323de" ON "student_documents" ("school_id", "student_id") `);
        await queryRunner.query(`CREATE TABLE "guardians" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "school_id" uuid NOT NULL, "user_id" uuid, "title" character varying(16), "first_name" character varying(60) NOT NULL, "last_name" character varying(60) NOT NULL, "email" character varying(160) NOT NULL, "phone" character varying(20) NOT NULL, "alt_phone" character varying(20), "occupation" character varying(120), "address" text, "photo_url" character varying(500), "has_portal_access" boolean NOT NULL DEFAULT false, "invited_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, CONSTRAINT "PK_3dcf02f3dc96a2c017106f280be" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f7e300b647548abd1f0ae128ca" ON "guardians" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f1d05a3a2d70db0a25479b6718" ON "guardians" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_282adb3fb6de87eafedc729af7" ON "guardians" ("school_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_6244397e5bbd001c10b888afc0" ON "guardians" ("school_id", "last_name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_85301f915fb76a15fb02f9012a" ON "guardians" ("school_id", "email") `);
        await queryRunner.query(`CREATE TABLE "student_guardians" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "school_id" uuid NOT NULL, "student_id" uuid NOT NULL, "guardian_id" uuid NOT NULL, "relationship" character varying(16) NOT NULL DEFAULT 'GUARDIAN', "is_primary_contact" boolean NOT NULL DEFAULT false, "is_emergency_contact" boolean NOT NULL DEFAULT false, "is_financially_responsible" boolean NOT NULL DEFAULT false, "can_pick_up" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_11ef78f5131711d8da1b14e3332" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_160bf4c447a9c01ef589e50263" ON "student_guardians" ("school_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8194052bdd62204f061dd44e0c" ON "student_guardians" ("student_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ec3cd56a2093be19f778af57c6" ON "student_guardians" ("guardian_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_442506db0982156f9f23155c59" ON "student_guardians" ("school_id", "guardian_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c16a10eff2caa58a1c5f0d4dd" ON "student_guardians" ("school_id", "student_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_aa0b42c8310d3fb35b846bdce5" ON "student_guardians" ("student_id", "guardian_id") `);
        await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "FK_aa8edc7905ad764f85924569647" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "FK_77329d8dd9e1d16f58ad7ad0b3a" FOREIGN KEY ("current_class_id") REFERENCES "school_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "FK_9742138f35918a5ad60f165bef2" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_6969e646aa55906ab338683340a" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_08caafd8a026a19ecf54db0e958" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_e0065a563e994ae10669b73188b" FOREIGN KEY ("session_id") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_bd53d62a3eced60e490d22c5d17" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_de802bf152edc2cdca3a4a80cf9" FOREIGN KEY ("level_id") REFERENCES "school_levels"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" ADD CONSTRAINT "FK_e875df488b1b297f25e3dff3039" FOREIGN KEY ("class_id") REFERENCES "school_classes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_documents" ADD CONSTRAINT "FK_8b0e086cbeca4ba69aadaac8541" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "guardians" ADD CONSTRAINT "FK_f7e300b647548abd1f0ae128ca7" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "guardians" ADD CONSTRAINT "FK_f1d05a3a2d70db0a25479b67189" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_guardians" ADD CONSTRAINT "FK_8194052bdd62204f061dd44e0c9" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "student_guardians" ADD CONSTRAINT "FK_ec3cd56a2093be19f778af57c63" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "student_guardians" DROP CONSTRAINT "FK_ec3cd56a2093be19f778af57c63"`);
        await queryRunner.query(`ALTER TABLE "student_guardians" DROP CONSTRAINT "FK_8194052bdd62204f061dd44e0c9"`);
        await queryRunner.query(`ALTER TABLE "guardians" DROP CONSTRAINT "FK_f1d05a3a2d70db0a25479b67189"`);
        await queryRunner.query(`ALTER TABLE "guardians" DROP CONSTRAINT "FK_f7e300b647548abd1f0ae128ca7"`);
        await queryRunner.query(`ALTER TABLE "student_documents" DROP CONSTRAINT "FK_8b0e086cbeca4ba69aadaac8541"`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_e875df488b1b297f25e3dff3039"`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_de802bf152edc2cdca3a4a80cf9"`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_bd53d62a3eced60e490d22c5d17"`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_e0065a563e994ae10669b73188b"`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_08caafd8a026a19ecf54db0e958"`);
        await queryRunner.query(`ALTER TABLE "student_enrollments" DROP CONSTRAINT "FK_6969e646aa55906ab338683340a"`);
        await queryRunner.query(`ALTER TABLE "students" DROP CONSTRAINT "FK_9742138f35918a5ad60f165bef2"`);
        await queryRunner.query(`ALTER TABLE "students" DROP CONSTRAINT "FK_77329d8dd9e1d16f58ad7ad0b3a"`);
        await queryRunner.query(`ALTER TABLE "students" DROP CONSTRAINT "FK_aa8edc7905ad764f85924569647"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa0b42c8310d3fb35b846bdce5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c16a10eff2caa58a1c5f0d4dd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_442506db0982156f9f23155c59"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec3cd56a2093be19f778af57c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8194052bdd62204f061dd44e0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_160bf4c447a9c01ef589e50263"`);
        await queryRunner.query(`DROP TABLE "student_guardians"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_85301f915fb76a15fb02f9012a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6244397e5bbd001c10b888afc0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_282adb3fb6de87eafedc729af7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1d05a3a2d70db0a25479b6718"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7e300b647548abd1f0ae128ca"`);
        await queryRunner.query(`DROP TABLE "guardians"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3561380cd4c3b64426f8323de"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb173deeb83f027b2b256338af"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b0e086cbeca4ba69aadaac854"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bb5d70352bbd80968b1b871531"`);
        await queryRunner.query(`DROP TABLE "student_documents"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0d56c5fe3a62c614f080d7cb8e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_336f02451afa699a58490bc9cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8cd5c8de83c3dcc339f28fe861"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e875df488b1b297f25e3dff303"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e0065a563e994ae10669b73188"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08caafd8a026a19ecf54db0e95"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6969e646aa55906ab338683340"`);
        await queryRunner.query(`DROP TABLE "student_enrollments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_670050a1751e1c95b2454323a4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b67c9f7352d815cf3981156802"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aaa70228cdda4826118fa1b037"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8594c4a4260e5c5f5ebea0711"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e72a01d029ea7ca28f4ae3e2f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa8edc7905ad764f8592456964"`);
        await queryRunner.query(`DROP TABLE "students"`);
    }

}
