# Guide to writing tests

Ref: <https://github.com/goldbergyoni/javascript-testing-best-practices#section-0%EF%B8%8F%E2%83%A3-the-golden-rule>

## Important notes

### Include 3 parts in each test name

(1) What is being tested? For example, the ProductsService.addNewProduct method

(2) Under what circumstances and scenario? For example, no price is passed to the method

(3) What is the expected result? For example, the new product is not approved

### Structure tests by the AAA pattern

1st A - Arrange: All the setup code to bring the system to the scenario the test aims to simulate.
2nd A - Act: Execute the unit under test. Usually 1 line of code
3rd A - Assert: Ensure that the received value satisfies the expectation. Usually 1 line of code


### Don’t catch errors, expect them


### Categorize tests under at least 2 levels

```js
// Unit under test
describe("Transfer service", () => {
  //Scenario
  describe("When no credit", () => {
    //Expectation
    test("Then the response status should decline", () => {});

    //Expectation
    test("Then it should send email to admin", () => {});
  });
});
```

### Avoid global test fixtures and seeds, add data per-test

### Choose a clear data clean-up strategy: After-all (recommended) or after-each

### Check integrations corner cases and chaos

When checking integrations, go beyond the happy and sad paths. Check not only errored responses (e.g., HTTP 500 error) but also network-level anomalies like slow and timed-out responses.


### Test 5 potential Outcomes

Our focus is on outcomes, things that are noticeable from the outside and might affect the user. These outcomes/reactions can be put in 5 categories:

• Response - The test invokes an action (e.g., via API) and gets a response. It's now concerned with checking the response data correctness, schema, and HTTP status

• A new state - After invoking an action, some publicly accessible data is probably modified

• External calls - After invoking an action, the app might call an external component via HTTP or any other transport. For example, a call to send SMS, email or charge a credit card

• Message queues - The outcome of a flow might be a message in a queue

• Observability - Some things must be monitored, like errors or remarkable business events. When a transaction fails, not only we expect the right response but also correct error handling and proper logging/metrics. This information goes directly to a very important user - The ops user (i.e., production SRE/admin)
