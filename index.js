const moment = require('moment')
const momentDurationFormatSetup = require("moment-duration-format");
const dotenv = require('dotenv')
const {base64, getEnvVar, getMonthArg, getEntriesByDay} = require('./utils')

// attach momentDuration plugin to moment
momentDurationFormatSetup(moment);

const BASE_URL = 'https://api.track.toggl.com/api/v9'

dotenv.config({path: '.env.local'})

const isCommand = (tokens) => {
    const args = process.argv.slice(2) // Remove the first two arguments
    const command = args[0]

    // Check if the argument exists and is in the format 'yyyy-mm'
    return !command || tokens.includes(command);
}

const authorization = `Basic ${base64(`${getEnvVar('TOGGL_API_TOKEN', true)}:api_token`)}`;

const getTaskBlocks = day =>
    day.records.reduce((acc, record) => {
        const duration = getDuration(record)

        const currentDurationSum = moment.duration(acc[record.description] || '00:00', 'hh:mm')
        const newDurationSum = moment.duration(currentDurationSum.asMilliseconds() + duration.asMilliseconds())

        acc[record.description] = formatDuration(newDurationSum)

        return acc
    }, {})

const getDuration = timeBlock => moment.duration(
    moment(timeBlock.endTime, 'HH:mm').diff(moment(timeBlock.startTime, 'HH:mm'))
)

const formatDuration = duration => moment.utc(duration.asMilliseconds()).format('HH:mm')

const getFormattedDuration = timeBlock => {
    const duration = getDuration(timeBlock)
    return formatDuration(duration)
}

const printEntries = byDay => {
    byDay.forEach(day => {
        console.log('**************************************')
        console.log(`${day.day} (${moment(day.day).format('dddd')})`)
        console.log('**************************************\n')

        day.records.forEach(record => {
            console.log(`${record.startTime} - ${record.endTime}: ${record.description}`)
        })

        console.log('---')

        day.timeBlocks.forEach(timeBlock => {
            const duration = getFormattedDuration(timeBlock)
            console.log(`${timeBlock.startTime} - ${timeBlock.endTime} (${duration})`)
        })

        console.log('---')

        const taskBlocks = getTaskBlocks(day)
        Object.keys(taskBlocks).forEach(description => {
            console.log(`${taskBlocks[description]}: ${description}`)
        })

        console.log('---')

        console.log(day.hoursTotal)
        console.log('\n')
    })
}

const printMonthSummary = byDay => {
    if (byDay.length > 0) {
        console.log('**************************************')
        console.log(`Summary for month ${moment(byDay[0].day).format('MMMM')} ${moment(byDay[0].day).format('YYYY')}`)
        console.log('**************************************\n')

        let totalWorkDuration = byDay.map(day => day.hoursTotal).reduce((sum, dayTotal) => sum + moment.duration(dayTotal).asMinutes(), 0)

        console.log(`Total work duration: ${moment.duration(totalWorkDuration, "minutes").format("HH:mm")}`)

        let averageWorkHoursPerDay = totalWorkDuration / byDay.length
        console.log(`Average work hours per day: ${moment.duration(averageWorkHoursPerDay, "minutes").format("HH:mm")}`)
    }
}

async function showEntries() {
    const monthArg = getMonthArg()

    const byDay = await getEntriesByDay(monthArg, authorization)
    printEntries(byDay)
    printMonthSummary(byDay)
}

const showHelp = () => {
    console.log('**************************************')
    console.log('year-month\tShow all entries and a summary for the month and project (TOGGL_PROJECT_ID)')
    console.log('Example: node index.js 2023-06\n')
    console.log('p, projects\tShow a list of your projects')
    console.log('Example: node index.js p\n')
    console.log('h, help\tshow this help')
    console.log('Example: node index.js h')
    console.log('**************************************')
}

async function showProjects() {
    const response = await fetch(`${BASE_URL}/me/projects`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authorization
        }
    })
    const entries = await response.json()

    console.log('**************************************')
    console.log('Your currently active projects:')
    entries.forEach(entry => {
        console.log("'" + entry.name + "' --> " + entry.id)
    })
    console.log('**************************************')
}

async function run() {
    if (getMonthArg() !== null) {
        await showEntries();
    } else if (isCommand("p", "projects")) {
        await showProjects();
    } else {
        showHelp()
    }
}

run()