const path = require('path');
const fs = require('fs');
const { question } = require('./utils');

const ENV_FILE = path.join(__dirname, '.env.local')

async function setup() {
  try {
    console.log('\x1b[101mToggl - Tempo Timetracking Setup\x1b[0m\n\n')

    if (fs.existsSync(ENV_FILE)) {
      console.error(`'${ENV_FILE}' file already exists. Delete file before start setup again.`)
      await question('Press any key to exit...')
      return
    }

    const togglApiToken = await question('Toggl API Token \x1b[90m(https://track.toggl.com/profile)\x1b[0m: ')
    const togglProjectId = await question('Toggl Project Id (optional): ')
    const jiraDomain = await question('Jira Subdomain \x1b[90m(e.g. toccoag)\x1b[0m: ')
    const jiraUsername = await question('Jira Username \x1b[90m(e.g. hmeier@tocco.ch)\x1b[0m: ')
    const jiraApiToken = await question('Jira API Token \x1b[90m(https://id.atlassian.com/manage-profile/security/api-tokens)\x1b[0m: ')
    const tempoApiToken = await question(`Tempo API Token \x1b[90m(https://${jiraDomain}.atlassian.net/plugins/servlet/ac/io.tempo.jira/tempo-app#!/configuration/api-integration)\x1b[0m: `)

    const env = `
TOGGL_API_TOKEN=${togglApiToken}
${togglProjectId ? `TOGGL_PROJECT_ID=${togglProjectId}` : ''}

JIRA_DOMAIN=${jiraDomain}
JIRA_USERNAME=${jiraUsername}
JIRA_API_TOKEN=${jiraApiToken}
TEMPO_API_TOKEN=${tempoApiToken}
`
    fs.writeFileSync(ENV_FILE, env)

    console.log(`\x1b[92m✨ Setup completed. Start pushing Toggl time entries to Tempo.\x1b[0m`)
    await question('Press ENTER to exit...')
  } catch (error) {
    console.error(`💥 Setup failed.`, error, error.stack)
    await question('Press ENTER to exit...')
  }
}

setup()
