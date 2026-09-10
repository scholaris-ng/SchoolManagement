import { ok, fail, validationFailure } from '../../support/api';

/**
 * Enrolling a student — the write journey the other forms follow.
 *
 * Covers the happy path, a client-side validation failure, and a server
 * rejection that must not look like a success.
 */
describe('Create a student', () => {
  /**
   * Every field `studentFormSchema` marks required. Filling fewer would leave
   * the form blocked on validation, and a spec waiting on a request the app was
   * right not to send looks like an app bug rather than a test bug.
   */
  const fillRequiredFields = (admissionNo = 'BFA/2026/117') => {
    cy.dataCy('field-admissionNo').type(admissionNo);
    cy.dataCy('field-gender').select('FEMALE');
    cy.dataCy('field-firstName').type('Chidi');
    cy.dataCy('field-lastName').type('Nwankwo');
    cy.dataCy('field-dateOfBirth').type('2013-05-14');
    cy.dataCy('field-currentClassId').select('e2e-class-1');
    cy.dataCy('field-admissionDate').type('2026-09-01');
  };

  beforeEach(() => {
    cy.visit('/sign-in');
    cy.login('admin');
    cy.interceptApi('GET', '/academics/levels', { body: ok([]) }, 'levels');
    cy.interceptApi(
      'GET',
      '/academics/classes*',
      {
        body: ok([
          {
            id: 'e2e-class-1',
            name: 'JSS 1 Gold',
            levelId: 'e2e-level-1',
            levelName: 'JSS 1',
            enrolledCount: 32,
          },
        ]),
      },
      'classes',
    );
    cy.interceptApi('GET', '/academics/houses', { body: ok([]) }, 'houses');

    cy.visit('/students/new');
    cy.wait('@classes');
  });

  it('creates the student and opens the new record', () => {
    cy.interceptApi(
      'POST',
      '/students',
      {
        body: ok({
          id: 'e2e-student-new',
          fullName: 'Chidi Nwankwo',
          admissionNo: 'BFA/2026/117',
        }),
      },
      'createStudent',
    );

    fillRequiredFields();
    cy.dataCy('form-submit').click();

    cy.wait('@createStudent').its('request.body.firstName').should('eq', 'Chidi');
    cy.contains('Student added').should('be.visible');
    cy.location('pathname').should('eq', '/students/e2e-student-new');
  });

  it('blocks submission and names the missing fields', () => {
    // Nothing is stubbed for POST: if the form let this through, the request
    // would hit the dead proxy and the assertion below would fail loudly.
    cy.dataCy('form-submit').click();

    cy.contains(/required/i).should('be.visible');
    cy.location('pathname').should('eq', '/students/new');
  });

  it('keeps the typed values on screen when the server rejects the record', () => {
    cy.interceptApi(
      'POST',
      '/students',
      {
        statusCode: 422,
        body: validationFailure([
          { field: 'admissionNo', message: 'That admission number is already in use.' },
        ]),
      },
      'rejectedStudent',
    );

    fillRequiredFields('BFA/2024/001');
    cy.dataCy('form-submit').click();

    cy.wait('@rejectedStudent');
    cy.dataCy('form-error').should('be.visible').and('contain', 'already in use');
    // The work is not thrown away on a failed save.
    cy.dataCy('field-firstName').should('have.value', 'Chidi');
    cy.location('pathname').should('eq', '/students/new');
  });

  it('reports a server outage rather than silently doing nothing', () => {
    cy.interceptApi(
      'POST',
      '/students',
      { statusCode: 500, body: fail('Something went wrong on our end.') },
      'brokenCreate',
    );

    fillRequiredFields('BFA/2026/118');
    cy.dataCy('form-submit').click();

    cy.wait('@brokenCreate');
    cy.dataCy('form-error').should('be.visible');
  });
});
