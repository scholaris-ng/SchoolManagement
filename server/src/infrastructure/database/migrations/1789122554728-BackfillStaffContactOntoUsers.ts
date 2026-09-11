import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fills in the contact details an employee's account never received.
 *
 * Creating a staff member asks the administrator for a phone number and a
 * photograph, wrote both onto the employee row, and left the account it
 * created in the same breath empty. The new employee then opened their profile
 * to blank boxes and details the school already held.
 *
 * Only nulls are filled. Nothing already on an account is overwritten, so a
 * person who has since set their own number or picture keeps it. Names are
 * deliberately left alone: both sides may have been edited since, and there is
 * no way here to tell which one the school means.
 */
export class BackfillStaffContactOntoUsers1789122554728 implements MigrationInterface {
  name = 'BackfillStaffContactOntoUsers1789122554728';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A person on staff at two schools has two employee rows and could have a
    // different number on each. Either is a better answer than none, and from
    // here on the two are kept in step whichever side is edited.
    await queryRunner.query(`
      UPDATE users u
         SET phone = s.phone
        FROM staff s
       WHERE s.user_id = u.id
         AND s.deleted_at IS NULL
         AND u.deleted_at IS NULL
         AND u.phone IS NULL
    `);

    await queryRunner.query(`
      UPDATE users u
         SET photo_url = s.photo_url
        FROM staff s
       WHERE s.user_id = u.id
         AND s.deleted_at IS NULL
         AND u.deleted_at IS NULL
         AND u.photo_url IS NULL
         AND s.photo_url IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    /*
      Nothing to undo. The rows this filled are indistinguishable from ones a
      person set themselves, so blanking them again would throw away details
      that are now correct.
    */
  }
}
