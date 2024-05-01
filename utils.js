const moment = require('moment')

const BASE_URL = 'https://api.track.toggl.com/api/v9'

async function getEntries(startDate, endDate, projectId, authorization) {
    const response = await fetch(`${BASE_URL}/me/time_entries?start_date=${startDate}&end_date=${endDate}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authorization
        }
    })
    const entries = await response.json()

    return projectId ? entries.filter(entry => entry.project_id === projectId) : entries
}

const groupByDay = entries => {
    const days = {}

    entries.forEach(entry => {
        const date = moment(entry.start)
        const dateStr = date.format('YYYY-MM-DD')

        let day = days[dateStr]
        if (!day) {
            day = []
            days[dateStr] = day
        }

        const startTime = date.format('HH:mm')
        const endTime = moment(entry.stop).format('HH:mm')

        const record = {
            startTime,
            endTime,
            description: entry.description
        }

        day.push(record)
    })

    const ordered = []

    Object.keys(days).forEach(day => {
        const records = [...days[day]]
        records.sort((record1, record2) => (record1.startTime.localeCompare(record2.startTime)))
        ordered.push({
            day,
            records
        })
    })

    ordered.sort((day1, day2) => new Date(day1.day) - new Date(day2.day))

    return ordered
}

const addTimeBlocks = days => {
    days.forEach(day => {
        day.timeBlocks = []

        let currentTimeBlock = null
        let lastRecord = null

        day.records.forEach(record => {
            if (!currentTimeBlock) {
                currentTimeBlock = {
                    startTime: record.startTime,
                    endtime: null
                }
            } else if (lastRecord && lastRecord.endTime !== record.startTime) {
                currentTimeBlock.endTime = lastRecord.endTime
                day.timeBlocks.push(currentTimeBlock)

                currentTimeBlock = {
                    startTime: record.startTime
                }
            }

            lastRecord = record
        })

        if (currentTimeBlock) {
            currentTimeBlock.endTime = lastRecord.endTime
            day.timeBlocks.push(currentTimeBlock)
        }
    })
}

const getDuration = timeBlock => moment.duration(
    moment(timeBlock.endTime, 'HH:mm').diff(moment(timeBlock.startTime, 'HH:mm'))
)

const formatDuration = duration => moment.utc(duration.asMilliseconds()).format('HH:mm')

const getTotalDurationSum = day =>
    day.records.reduce((acc, record) => {
        const currentDurationSum = moment.duration(acc, 'hh:mm')
        const duration = getDuration(record)
        const newDurationSum = moment.duration(currentDurationSum.asMilliseconds() + duration.asMilliseconds())
        return formatDuration(newDurationSum)
    }, '00:00')

// monthArg: YYYY-MM
const getEntriesByDay = async (monthArg, authorization) => {
    const projectId = parseInt(getEnvVar('TOGGL_PROJECT_ID'), 10)

    const startDate = monthArg + '-01'
    const endDate = moment(startDate, 'YYYY-MM-DD').add(1, 'months').format('YYYY-MM-DD')

    const entries = await getEntries(startDate, endDate, projectId, authorization)
    const byDay = groupByDay(entries)
    addTimeBlocks(byDay)
    addDailyHoursTotal(byDay)

    return byDay
}


// Function to convert HH:MM to decimal with 2 decimal places
const timeToDecimal = timeStr => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const decimalTime = hours + minutes / 60;
    return Math.round(decimalTime * 100) / 100;
}

const addDailyHoursTotal = days => {
    days.forEach(day => {
        day.hoursTotal = getTotalDurationSum(day)
        day.hoursTotalDecimal = timeToDecimal(day.hoursTotal)
    })
}

const getEnvVar = (name, mandatory) => {
    const variable = process.env[name]
    if (!variable && mandatory) {
        throw new Error(`Variable ${name} is not set in the environment`)
    }
    return variable
}

const getArgs = () => process.argv.slice(2) // Remove the first two arguments

const getMonthArg = () => {
    const args = getArgs()
    const monthArg = args[0]

    // Check if the argument exists and is in the format 'yyyy-mm'
    if (monthArg && /^\d{4}-\d{2}$/.test(monthArg)) {
        return monthArg
    }
    return null
}

const base64 = str => Buffer.from(str).toString('base64')

module.exports = {
    getEntriesByDay,
    getEnvVar,
    getArgs,
    getMonthArg,
    base64
}