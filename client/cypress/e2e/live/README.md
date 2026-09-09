# Live smoke specs

Specs in this folder are the **one** exception to the stub-first rule: they run
against a real deployment to prove it is up and serving.

They are:

- **opt-in** — skipped unless `CYPRESS_LIVE_EMAIL` and `CYPRESS_LIVE_PASSWORD`
  are set in the environment;
- **read-only** — they may sign in and read. Never add a POST, PATCH, PUT or
  DELETE here. Dev and production share a database on this project, so a write
  in a smoke test is a write to a real school's records;
- **run separately** — `npm run e2e` does not include them.

Guard every spec in this folder with the credential check:

```ts
const email = Cypress.env('LIVE_EMAIL')
const password = Cypress.env('LIVE_PASSWORD')

describe('Live smoke', { tags: ['live'] }, () => {
  before(function () {
    if (!email || !password) this.skip()
  })

  it('serves the dashboard to a signed-in user', () => {
    cy.loginByApi(email, password)
    cy.visit('/')
    cy.dataCy('account-menu-trigger').should('be.visible')
  })
})
```
