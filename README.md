# cypress-focus-test

https://github.com/cypress-io/cypress/issues/5023

## PASS:

1. `yarn start`
2. Open another shell
3. `yarn cypress open`

(make sure browser window stays focused)

## FAIL:

1. `yarn start`
2. Open another shell
3. `yarn cypress run`

(or, use `cypress open` and make sure the browser window *isn't* focused)
