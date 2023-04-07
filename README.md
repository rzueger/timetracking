# Time tracking

## Getting started

Install dependencies:

```
npm install
```

Add file `.env.local` with the following content (replace '${placeholders}' with the actual values):

```
TOGGL_PROJECT_ID=${toggl project id}
TOGGL_USERNAME=${toggl username}
TOGGL_PASSWORD=${project id}
```

Call script:

```
node index.js ${month-arg in yyyy-mm}
```

e.g. `node index.js 2023-04`
