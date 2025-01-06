const moment = require('moment')
const { getEntriesByDay, getEnvVar, base64, getMonthArg, getDayArg, getEntriesForDay } = require("./utils");
const dotenv = require("dotenv");

dotenv.config({ path: '.env.local' })

const JIRA_BASE_URL = `https://${getEnvVar('JIRA_DOMAIN', true)}.atlassian.net/rest/api/3`
const TEMPO_BASE_URL = 'https://api.tempo.io/4'

const jiraAuthorization = `Basic ${base64(`${getEnvVar('JIRA_USERNAME', true)}:${getEnvVar('JIRA_API_TOKEN', true)}`)}`;
const tempoAuthorization = `Bearer ${getEnvVar('TEMPO_API_TOKEN', true)}`
const togglAuthorization = `Basic ${base64(`${getEnvVar('TOGGL_API_TOKEN', true)}:api_token`)}`;


function getDurationSeconds(startTime, endTime) {
    const format = 'HH:mm';

    const startMoment = moment(startTime, format);
    const endMoment = moment(endTime, format);

    let durationSeconds = endMoment.diff(startMoment, 'seconds');

    if (durationSeconds < 0) { // end time after midnight (add 24h in seconds)
        const secondsInDay = 24 * 60 * 60
        durationSeconds = secondsInDay + durationSeconds
    }

    return durationSeconds;
}

function getIssueName(description) {
    const match = description.match(/^([A-Z\d-]+)\s+/);

    if (match) {
        const firstWord = match[1];

        // Check if the first word consists of only uppercase letters, "-", and numbers
        const isValid = /^[A-Z\d-]+$/.test(firstWord);

        if (isValid) {
            return firstWord
        } else {
            throw new Error('No valid issue name found in the description: ' + description);
        }
    } else {
        throw new Error('No valid issue name found in the description: ' + description);
    }
}

async function get(url, authorization) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authorization
        }
    })
    if (response.ok) {
        return await response.json()
    }
    throw new Error("Failed to get: " + url)
}

async function post(url, authorization, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authorization
        },
        body: JSON.stringify(data)
    })
    if (!response.ok) {
        const json = await response.json()
        console.log(`Error response: ${response.status} ${response.statusText}`)
        console.log(json)
        throw new Error("Failed to post: " + url)
    }
}

async function getJiraAccountId() {
    const data = await get(`${JIRA_BASE_URL}/myself`, jiraAuthorization)
    if (!data.accountId) {
        throw new Error("No accountId on data: " + JSON.stringify(data))
    }
    return data.accountId
}

async function getIssueId(issueName) {
    const data = await get(`${JIRA_BASE_URL}/issue/${issueName}`, jiraAuthorization)
    if (!data.id) {
        throw new Error("No id on data: " + JSON.stringify(data))
    }
    return data.id
}

async function getTempoWorklogs(day, userId) {
    const data = await get(`${TEMPO_BASE_URL}//worklogs/user/${userId}?from=${day}&to=${day}`, tempoAuthorization)
    if (!data.results) {
        throw new Error("No result on data: " + JSON.stringify(data))
    }
    return data.results
}

async function saveTempoWorklog(jiraAccountId, recordInfo) {
    await post(`${TEMPO_BASE_URL}//worklogs`, tempoAuthorization, {
        authorAccountId: jiraAccountId,
        startDate: recordInfo.day,
        startTime: recordInfo.startTime,
        timeSpentSeconds: recordInfo.timeSpentSeconds,
        issueId: recordInfo.issueId,
        "attributes": [{ // todo: these attributes maybe don't work for all issue types
            "key": "_Leistungstyp_",
            "value": "TechnischeUmsetzung"
        }]
    })
}

async function getRecordInfo(day, record) {
    const { startTime, endTime, description } = record

    const timeSpentSeconds = getDurationSeconds(startTime, endTime)
    const issueName = getIssueName(description)
    const issueId = await getIssueId(issueName)
    const formattedStartTime = moment(startTime, 'HH:mm').format('HH:mm:ss')

    return {
        day,
        startTime: formattedStartTime,
        timeSpentSeconds,
        issueName,
        issueId
    }
}

function recordInfoStr(recordInfo) {
    return `Day: ${recordInfo.day}, Start time: ${recordInfo.startTime}, Time spent (seconds): ${recordInfo.timeSpentSeconds}, Issue: ${recordInfo.issueName}/${recordInfo.issueId}`
}

async function pushRecord(recordInfo, jiraAccountId, commit) {
    const infoStr = recordInfoStr(recordInfo)
    if (commit) {
        console.log(`Pushing: ${infoStr}`)
        await saveTempoWorklog(jiraAccountId, recordInfo)
    } else {
        console.log(`Would push: ${infoStr}`)
    }
}

function containsRecord(tempoWorklogs, record) {
    if (tempoWorklogs.length === 0) {
        return false
    }

    const recordStartTime = moment(record.startTime, 'HH:mm')

    const existingWorklog = tempoWorklogs.find(worklog => {
        const worklogStartTime = moment(worklog.startTime, 'HH:mm:ss')
        return worklogStartTime.isSame(recordStartTime)
    })

    if (existingWorklog) {
        const recordDuration = getDurationSeconds(record.startTime, record.endTime)
        if (recordDuration !== existingWorklog.timeSpentSeconds) {
            throw new Error(`Worklog entry with same start time found (${existingWorklog.startDate} ${existingWorklog.startTime}), but with duration ${existingWorklog.timeSpentSeconds} instead of ${recordDuration}`);
        }
        // todo: also check other fields like selected ticket
        return true
    }

    return false
}

async function pushDay(entry, jiraAccountId, commit) {
    let expectedTempoLogCount = 0

    if (entry.records.length > 0) {
        const tempoWorklogs = await getTempoWorklogs(entry.day, jiraAccountId);
        for (const record of entry.records) {
            const recordInfo = await getRecordInfo(entry.day, record)
            if (isNaN(recordInfo.timeSpentSeconds)) {
                console.log(`Record is ongoing: ${recordInfoStr(recordInfo)}. Skipping...`)
            } else if (recordInfo.timeSpentSeconds === 0) {
                console.log(`Record is has 0 seconds logged: ${recordInfoStr(recordInfo)}. Skipping...`)
            } else if (containsRecord(tempoWorklogs, record)) {
                console.log(`Record exists: ${recordInfoStr(recordInfo)}. Skipping...`)
                expectedTempoLogCount++
            } else {
                await pushRecord(recordInfo, jiraAccountId, commit)
                expectedTempoLogCount++
            }
        }
    }

    if (commit) {
        const tempoWorklogsAfterPush = await getTempoWorklogs(entry.day, jiraAccountId);
        if (tempoWorklogsAfterPush.length !== expectedTempoLogCount) {
            throw new Error(`Tempo has ${tempoWorklogsAfterPush.length} worklogs, but should have ${expectedTempoLogCount} on day ${entry.day}`)
        }
    }
}

async function pushToJira(params) {
    const { monthArg, dayArg, commit } = params

    const period = dayArg ? `for the day ${dayArg}` : `for the month ${monthArg}`
    console.log(commit
        ? `Pushing records to Jira ${period}`
        : `Logging what would be pushed to Jira ${period}`
    )

    const entries = dayArg ? await getEntriesForDay(dayArg, togglAuthorization) : await getEntriesByDay(monthArg, togglAuthorization)

    const jiraAccountId = await getJiraAccountId()

    for (const entry of entries) {
        await pushDay(entry, jiraAccountId, commit)
    }

    console.log('Completed!')
    if (!commit) {
        console.log(`This was a dry run. Run the following command to actually push to JIRA: node push-jira ${monthArg || dayArg} commit`)
    }
}

const showHelp = () => {
    console.log('**************************************')
    console.log('year-month\tPush all Toggle entries for the month and project (TOGGL_PROJECT_ID) to the Jira Tempo worklog\n')
    console.log('Example (logging what would be created without committing): node push-jira.js 2023-12\n')
    console.log('Example (with committing): node push-jira.js 2023-12 commit\n')
    console.log('h, help\tshow this help')
    console.log('Example: node push-jira.js h')
    console.log('**************************************')
}

function getCommitArg() {
    const args = process.argv.slice(2) // Remove the first two arguments
    const commitArg = args[1]

    return commitArg === 'commit'
}

async function pushWorklogs() {
    const monthArg = getMonthArg()
    const dayArg = getDayArg()

    const commit = getCommitArg()

    if (monthArg || dayArg) {
        const params = {
            monthArg,
            dayArg,
            commit
        };

        await pushToJira(params)
    } else {
        showHelp()
    }
}

pushWorklogs()
