import { ok, fail } from '../../support/api';
import { sessionFor } from '../../support/session';

describe('Sign in', () => {
  beforeEach(() => {
    cy.visit('/sign-in');
  });

  it('rejects an empty form before it reaches the network', () => {
    // No stub is registered on purpose: a request here would hit the dead
    // proxy and fail, which is exactly what client-side validation prevents.
    cy.dataCy('sign-in-submit').click();
    cy.contains(/required|enter/i).should('be.visible');
    cy.location('pathname').should('eq', '/sign-in');
  });

  it('signs a school administrator in and lands on the dashboard', () => {
    cy.interceptApi('GET', '/auth/session', { body: ok(sessionFor('admin')) }, 'session');
    cy.interceptApi(
      'GET',
      '/notifications/unread-count',
      { body: ok({ notifications: 0, messages: 0 }) },
      'unreadCount',
    );
    cy.fixture('dashboard/admin').then((payload) => {
      cy.interceptApi('GET', '/dashboard/admin', { body: ok(payload) }, 'dashboard');
    });
    cy.interceptApi('GET', '/academics/terms*', { body: ok([]) }, 'terms');

    cy.dataCy('field-email').type('admin@e2e.test');
    cy.dataCy('field-password').type('correct-horse-battery');
    cy.dataCy('sign-in-submit').click();

    cy.wait('@session');
    cy.location('pathname').should('eq', '/');
    cy.dataCy('account-menu-trigger').should('be.visible');
  });

  it('shows the server error when the session call fails', () => {
    cy.interceptApi(
      'GET',
      '/auth/session',
      { statusCode: 403, body: fail('This account has no school membership.', 'FORBIDDEN') },
      'session',
    );

    cy.dataCy('field-email').type('nobody@e2e.test');
    cy.dataCy('field-password').type('correct-horse-battery');
    cy.dataCy('sign-in-submit').click();

    cy.wait('@session');
    cy.contains(/membership|access/i).should('be.visible');
  });
});
