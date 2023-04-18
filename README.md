# Time tracking

## Getting started

Install dependencies:

```
npm install
```

Add file `.env.local` with the following content (replace '${placeholders}' with the actual values):

```
TOGGL_API_TOKEN=${toggl api token}
TOGGL_PROJECT_ID=${toggl project id - optional}
```

Call script:

```
node index.js ${month-arg in yyyy-mm}
```

e.g. `node index.js 2023-04`
