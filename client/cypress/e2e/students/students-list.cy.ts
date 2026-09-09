import { ok, fail, paged } from '../../support/api';

/**
 * The student register — the list every other list page is modelled on.
 *
 * Covers the happy path, a filter round-trip, an API failure and the
 * access-control rule that a parent cannot open the register at all.
 */
describe('Students list', () => {
  const stubSupporting = () => {
    cy.interceptApi('GET', '/academics/levels', { body: ok([]) }, 'levels');
    cy.interceptApi('GET', '/academics/classes*', { body: ok([]) }, 'classes');
  };

  describe('as a school administrator', () => {
    beforeEach(() => {
      cy.visit('/sign-in');
      cy.login('admin');
      stubSupporting();
      cy.fixture('students/list').then((rows) => {
        cy.interceptApi('GET', '/students*', { body: paged(rows) }, 'students');
      });
      cy.visit('/students');
      cy.wait('@students');
    });

    it('lists every student the API returned', () => {
      cy.dataCy('students-table-row').should('have.length', 3);
      cy.contains('Amara Okafor').should('be.visible');
      cy.contains('BFA/2024/002').should('be.visible');
    });

    it('sends a debounced search to the API and shows the narrowed result', () => {
      cy.fixture('students/list').then((rows) => {
        cy.interceptApi(
          'GET',
          '/students*',
          { body: paged([rows[0]]) },
          'searchedStudents',
        );
      });

      cy.dataCy('filter-search').type('Amara');

      // One request for the whole word, not one per keystroke: `useListQuery`
      // debounces the term before it reaches the query key.
      cy.wait('@searchedStudents').its('request.url').should('include', 'search=Amara');
      cy.dataCy('students-table-row').should('have.length', 1);
      cy.contains('Tunde Ayo Balogun').should('not.exist');
    });

    it('shows the empty state, with a way back, when a filter matches nothing', () => {
      cy.interceptApi('GET', '/students*', { body: paged([]) }, 'noStudents');

      cy.dataCy('filter-search').type('Nobody');
      cy.wait('@noStudents');

      cy.dataCy('students-table-empty').should('be.visible');
      cy.dataCy('students-list-clear-filters').should('be.visible');
    });

    it('surfaces an API failure instead of an empty table', () => {
      cy.interceptApi(
        'GET',
        '/students*',
        { statusCode: 500, body: fail('The register is temporarily unavailable.') },
        'brokenStudents',
      );

      cy.reload();
      cy.wait('@brokenStudents');

      cy.dataCy('students-table-error').should('be.visible');
      cy.dataCy('students-table-error-retry').should('be.visible');
    });
  });

  describe('access control', () => {
    it('does not offer "Add student" to a role without student.create', () => {
      cy.visit('/sign-in');
      cy.login('teacher');
      stubSupporting();
      cy.fixture('students/list').then((rows) => {
        cy.interceptApi('GET', '/students*', { body: paged(rows) }, 'students');
      });

      cy.visit('/students');
      cy.wait('@students');

      cy.dataCy('students-table-row').should('have.length', 3);
      cy.dataCy('students-list-add-student').should('not.exist');
      cy.dataCy('students-list-promote-class').should('not.exist');
    });

    it('keeps a parent out of the register entirely', () => {
      cy.visit('/sign-in');
      cy.login('parent');
      cy.interceptApi('GET', '/dashboard/parent', { body: ok({}) }, 'parentDashboard');

      cy.visit('/students');

      // A parent has `student.read` only for their own children, which the
      // register route does not grant: the guard redirects rather than
      // rendering a page the API would refuse to fill.
      cy.location('pathname').should('not.eq', '/students');
    });
  });
});
